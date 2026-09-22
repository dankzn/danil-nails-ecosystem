import { UserRole, type DatabaseClient } from "@danil-nails/db";
import { businessConfig } from "@danil-nails/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { authorize } from "../auth/session.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const scheduleQuerySchema = z.object({
  staffId: z.string().cuid().optional(),
  from: z.string().regex(datePattern).optional(),
  to: z.string().regex(datePattern).optional()
});
const workingHoursSchema = z.object({
  staffId: z.string().cuid().optional(),
  workingHours: z
    .array(
      z.object({
        weekday: z.number().int().min(1).max(7),
        startsAt: z.string().regex(timePattern),
        endsAt: z.string().regex(timePattern)
      })
    )
    .max(35)
});
const exceptionSchema = z.object({
  staffId: z.string().cuid().optional(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  reason: z.string().trim().max(240).nullable().optional(),
  isBookable: z.boolean().default(false)
});
const idSchema = z.object({ id: z.string().cuid() });

type ScheduleUser = {
  id: string;
  role: UserRole;
};

function timeToMinutes(value: string) {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function hasInvalidWorkingHours(
  entries: Array<{ weekday: number; startsAt: string; endsAt: string }>
) {
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    const intervals = entries
      .filter((entry) => entry.weekday === weekday)
      .map((entry) => ({
        startsAt: timeToMinutes(entry.startsAt),
        endsAt: timeToMinutes(entry.endsAt)
      }))
      .sort((left, right) => left.startsAt - right.startsAt);

    for (let index = 0; index < intervals.length; index += 1) {
      const current = intervals[index]!;
      const previous = intervals[index - 1];
      if (current.startsAt >= current.endsAt) return true;
      if (previous && current.startsAt < previous.endsAt) return true;
    }
  }

  return false;
}

function moscowDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: businessConfig.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateAtMoscowMidnight(date: string) {
  return new Date(`${date}T00:00:00+03:00`);
}

async function availableStaff(database: DatabaseClient, user: ScheduleUser) {
  if (user.role === UserRole.master) {
    return database.staffProfile.findMany({
      where: { userId: user.id },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" }
    });
  }

  return database.staffProfile.findMany({
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" }
  });
}

async function selectStaff(
  database: DatabaseClient,
  user: ScheduleUser,
  requestedStaffId: string | undefined,
  reply: FastifyReply
) {
  const staff = await availableStaff(database, user);
  if (staff.length === 0) {
    reply.code(403).send({ error: "staff_profile_required" });
    return null;
  }

  const selected = requestedStaffId
    ? staff.find((profile) => profile.id === requestedStaffId)
    : staff[0];
  if (!selected) {
    reply.code(403).send({ error: "insufficient_permissions" });
    return null;
  }

  return { staff, selected };
}

function sendInvalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid_schedule_payload" });
}

export function registerScheduleRoutes(
  server: FastifyInstance,
  database: DatabaseClient | null
) {
  const staffGuard = authorize(database, [
    UserRole.owner,
    UserRole.admin,
    UserRole.master
  ]);

  server.get(
    "/v1/admin/schedule",
    { preHandler: staffGuard },
    async (request, reply) => {
      const query = scheduleQuerySchema.safeParse(request.query);
      if (!query.success) return sendInvalidPayload(reply);

      const selection = await selectStaff(
        database!,
        request.crmUser!,
        query.data.staffId,
        reply
      );
      if (!selection) return;

      const today = moscowDateKey();
      const from = query.data.from ?? today;
      const defaultEnd = new Date(dateAtMoscowMidnight(from).getTime());
      defaultEnd.setUTCDate(defaultEnd.getUTCDate() + 120);
      const to = query.data.to ?? moscowDateKey(defaultEnd);
      const rangeStart = dateAtMoscowMidnight(from);
      const rangeEnd = new Date(dateAtMoscowMidnight(to).getTime() + 86400000);

      if (rangeStart >= rangeEnd) return sendInvalidPayload(reply);

      const [workingHours, exceptions] = await Promise.all([
        database!.workingHour.findMany({
          where: { staffId: selection.selected.id, isActive: true },
          orderBy: [{ weekday: "asc" }, { startsAt: "asc" }]
        }),
        database!.scheduleException.findMany({
          where: {
            staffId: selection.selected.id,
            startsAt: { lt: rangeEnd },
            endsAt: { gt: rangeStart }
          },
          orderBy: { startsAt: "asc" }
        })
      ]);

      return {
        timezone: businessConfig.timezone,
        staff: selection.staff,
        selectedStaffId: selection.selected.id,
        workingHours,
        exceptions
      };
    }
  );

  server.put(
    "/v1/admin/schedule/working-hours",
    { preHandler: staffGuard },
    async (request, reply) => {
      const input = workingHoursSchema.safeParse(request.body);
      if (!input.success || hasInvalidWorkingHours(input.data.workingHours)) {
        return sendInvalidPayload(reply);
      }

      const selection = await selectStaff(
        database!,
        request.crmUser!,
        input.data.staffId,
        reply
      );
      if (!selection) return;

      const workingHours = await database!.$transaction(async (transaction) => {
        await transaction.workingHour.deleteMany({
          where: { staffId: selection.selected.id }
        });
        if (input.data.workingHours.length > 0) {
          await transaction.workingHour.createMany({
            data: input.data.workingHours.map((entry) => ({
              ...entry,
              staffId: selection.selected.id
            }))
          });
        }
        return transaction.workingHour.findMany({
          where: { staffId: selection.selected.id, isActive: true },
          orderBy: [{ weekday: "asc" }, { startsAt: "asc" }]
        });
      });

      return { workingHours };
    }
  );

  server.post(
    "/v1/admin/schedule/exceptions",
    { preHandler: staffGuard },
    async (request, reply) => {
      const input = exceptionSchema.safeParse(request.body);
      if (!input.success) return sendInvalidPayload(reply);

      const startsAt = new Date(input.data.startsAt);
      const endsAt = new Date(input.data.endsAt);
      const duration = endsAt.getTime() - startsAt.getTime();
      if (duration <= 0 || duration > 93 * 86400000) {
        return sendInvalidPayload(reply);
      }

      const selection = await selectStaff(
        database!,
        request.crmUser!,
        input.data.staffId,
        reply
      );
      if (!selection) return;

      const overlap = await database!.scheduleException.findFirst({
        where: {
          staffId: selection.selected.id,
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt }
        },
        select: { id: true }
      });
      if (overlap) {
        return reply.code(409).send({ error: "schedule_exception_conflict" });
      }

      const exception = await database!.scheduleException.create({
        data: {
          staffId: selection.selected.id,
          startsAt,
          endsAt,
          reason: input.data.reason ?? null,
          isBookable: input.data.isBookable
        }
      });

      return reply.code(201).send({ exception });
    }
  );

  server.delete(
    "/v1/admin/schedule/exceptions/:id",
    { preHandler: staffGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      if (!parameters.success) return sendInvalidPayload(reply);

      const exception = await database!.scheduleException.findUnique({
        where: { id: parameters.data.id },
        select: { id: true, staffId: true }
      });
      if (!exception) {
        return reply.code(404).send({ error: "schedule_exception_not_found" });
      }

      const selection = await selectStaff(
        database!,
        request.crmUser!,
        exception.staffId,
        reply
      );
      if (!selection) return;

      await database!.scheduleException.delete({ where: { id: exception.id } });
      return reply.code(204).send();
    }
  );
}
