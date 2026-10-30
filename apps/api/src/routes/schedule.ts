import { UserRole, type DatabaseClient } from "@danil-nails/db";
import { businessConfig } from "@danil-nails/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { authorize } from "../auth/session.js";
import { resolveDisplayRanges, weekdayForDate } from "../availability.js";
import { activeAppointmentStatuses } from "./appointments.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const scheduleQuerySchema = z.object({
  staffId: z.string().cuid().optional(),
  from: z.string().regex(datePattern).optional(),
  to: z.string().regex(datePattern).optional()
});
const dayOverviewQuerySchema = z.object({
  date: z.string().regex(datePattern)
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
const monthOverviewQuerySchema = z.object({
  from: z.string().regex(datePattern),
  to: z.string().regex(datePattern)
});
const dayOverrideSchema = z.object({
  staffId: z.string().cuid(),
  date: z.string().regex(datePattern),
  ranges: z
    .array(
      z.object({
        startsAt: z.string().regex(timePattern),
        endsAt: z.string().regex(timePattern)
      })
    )
    .max(2)
});

type ScheduleUser = {
  id: string;
  role: UserRole;
};

function timeToMinutes(value: string) {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

// An appointment is "covered" when it fits entirely inside one of the new
// ranges. Used to refuse a day-override (including "make day off", which
// passes an empty ranges array) that would silently strand an existing
// appointment outside working hours instead of making the admin move it.
export function findAppointmentOutsideRanges(
  appointments: Array<{ startsAt: Date; endsAt: Date }>,
  ranges: Array<{ startsAt: Date; endsAt: Date }>
) {
  return appointments.find(
    (appointment) =>
      !ranges.some(
        (range) =>
          appointment.startsAt >= range.startsAt && appointment.endsAt <= range.endsAt
      )
  );
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

function timeToDate(date: string, time: string) {
  return new Date(`${date}T${time}:00+03:00`);
}

function datesBetween(from: string, to: string) {
  const dates: string[] = [];
  for (
    let cursor = dateAtMoscowMidnight(from);
    cursor <= dateAtMoscowMidnight(to);
    cursor = new Date(cursor.getTime() + 86400000)
  ) {
    dates.push(moscowDateKey(cursor));
  }
  return dates;
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

  server.get(
    "/v1/admin/schedule/day-overview",
    { preHandler: staffGuard },
    async (request, reply) => {
      const query = dayOverviewQuerySchema.safeParse(request.query);
      if (!query.success) return sendInvalidPayload(reply);

      const date = query.data.date;
      const dayStart = dateAtMoscowMidnight(date);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const weekday = weekdayForDate(date);

      const staffList =
        request.crmUser!.role === UserRole.master
          ? await database!.staffProfile.findMany({
              where: { userId: request.crmUser!.id, isBookable: true },
              select: { id: true }
            })
          : await database!.staffProfile.findMany({
              where: { isBookable: true },
              select: { id: true }
            });

      const staff = await Promise.all(
        staffList.map(async ({ id: staffId }) => {
          const [workingHours, exceptions] = await Promise.all([
            database!.workingHour.findMany({
              where: { staffId, weekday, isActive: true },
              select: { startsAt: true, endsAt: true }
            }),
            database!.scheduleException.findMany({
              where: {
                staffId,
                startsAt: { lt: dayEnd },
                endsAt: { gt: dayStart }
              },
              select: { startsAt: true, endsAt: true, isBookable: true }
            })
          ]);

          return {
            staffId,
            ranges: resolveDisplayRanges({ date, workingHours, exceptions })
          };
        })
      );

      return { date, timezone: businessConfig.timezone, staff };
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

  server.get(
    "/v1/admin/schedule/month-overview",
    { preHandler: staffGuard },
    async (request, reply) => {
      const query = monthOverviewQuerySchema.safeParse(request.query);
      if (!query.success) return sendInvalidPayload(reply);

      const { from, to } = query.data;
      const rangeStart = dateAtMoscowMidnight(from);
      const rangeEnd = new Date(dateAtMoscowMidnight(to).getTime() + 86400000);
      const spanDays = Math.round(
        (rangeEnd.getTime() - rangeStart.getTime()) / 86400000
      );
      if (rangeStart >= rangeEnd || spanDays > 62) {
        return sendInvalidPayload(reply);
      }

      const staffSelect = {
        id: true,
        displayName: true,
        photo: { select: { updatedAt: true } },
        positions: {
          orderBy: { order: "asc" as const },
          take: 1,
          select: { position: { select: { titleRu: true } } }
        }
      };
      const staffList =
        request.crmUser!.role === UserRole.master
          ? await database!.staffProfile.findMany({
              where: { userId: request.crmUser!.id, isBookable: true },
              select: staffSelect,
              orderBy: { displayName: "asc" }
            })
          : await database!.staffProfile.findMany({
              where: { isBookable: true },
              select: staffSelect,
              orderBy: { displayName: "asc" }
            });

      const staffIds = staffList.map((profile) => profile.id);
      const [workingHours, exceptions] = await Promise.all([
        database!.workingHour.findMany({
          where: { staffId: { in: staffIds }, isActive: true },
          select: { staffId: true, weekday: true, startsAt: true, endsAt: true }
        }),
        database!.scheduleException.findMany({
          where: {
            staffId: { in: staffIds },
            startsAt: { lt: rangeEnd },
            endsAt: { gt: rangeStart }
          },
          select: { staffId: true, startsAt: true, endsAt: true, isBookable: true }
        })
      ]);

      const workingHoursByStaff = new Map<string, typeof workingHours>();
      for (const entry of workingHours) {
        const list = workingHoursByStaff.get(entry.staffId) ?? [];
        list.push(entry);
        workingHoursByStaff.set(entry.staffId, list);
      }
      const exceptionsByStaff = new Map<string, typeof exceptions>();
      for (const entry of exceptions) {
        const list = exceptionsByStaff.get(entry.staffId) ?? [];
        list.push(entry);
        exceptionsByStaff.set(entry.staffId, list);
      }

      const days = datesBetween(from, to);
      const entries: Record<
        string,
        Record<string, Array<{ startsAt: Date; endsAt: Date }>>
      > = {};

      for (const staff of staffList) {
        const staffWorkingHours = workingHoursByStaff.get(staff.id) ?? [];
        const staffExceptions = exceptionsByStaff.get(staff.id) ?? [];
        const byDate: Record<string, Array<{ startsAt: Date; endsAt: Date }>> = {};

        for (const date of days) {
          const weekday = weekdayForDate(date);
          byDate[date] = resolveDisplayRanges({
            date,
            workingHours: staffWorkingHours.filter(
              (entry) => entry.weekday === weekday
            ),
            exceptions: staffExceptions
          });
        }

        entries[staff.id] = byDate;
      }

      return {
        timezone: businessConfig.timezone,
        from,
        to,
        days,
        staff: staffList.map(({ photo, positions, ...profile }) => ({
          ...profile,
          photoUrl: photo
            ? `/v1/staff/${profile.id}/photo?v=${photo.updatedAt.getTime()}`
            : null,
          positionTitle: positions[0]?.position.titleRu ?? null
        })),
        entries
      };
    }
  );

  server.put(
    "/v1/admin/schedule/day",
    { preHandler: staffGuard },
    async (request, reply) => {
      const input = dayOverrideSchema.safeParse(request.body);
      if (!input.success) return sendInvalidPayload(reply);

      const sortedRanges = [...input.data.ranges].sort(
        (left, right) => timeToMinutes(left.startsAt) - timeToMinutes(right.startsAt)
      );
      for (let index = 0; index < sortedRanges.length; index += 1) {
        const current = sortedRanges[index]!;
        const previous = sortedRanges[index - 1];
        if (timeToMinutes(current.startsAt) >= timeToMinutes(current.endsAt)) {
          return sendInvalidPayload(reply);
        }
        if (previous && timeToMinutes(current.startsAt) < timeToMinutes(previous.endsAt)) {
          return sendInvalidPayload(reply);
        }
      }

      const selection = await selectStaff(
        database!,
        request.crmUser!,
        input.data.staffId,
        reply
      );
      if (!selection) return;

      const { date } = input.data;
      const dayStart = dateAtMoscowMidnight(date);
      const dayEnd = new Date(dayStart.getTime() + 86400000);

      const spanningException = await database!.scheduleException.findFirst({
        where: {
          staffId: selection.selected.id,
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
          OR: [{ startsAt: { lt: dayStart } }, { endsAt: { gt: dayEnd } }]
        },
        select: { id: true }
      });
      if (spanningException) {
        return reply.code(409).send({ error: "schedule_exception_spans_multiple_days" });
      }

      const newRanges = sortedRanges.map((range) => ({
        startsAt: timeToDate(date, range.startsAt),
        endsAt: timeToDate(date, range.endsAt)
      }));
      const dayAppointments = await database!.appointment.findMany({
        where: {
          staffId: selection.selected.id,
          startsAt: { lt: dayEnd },
          endsAt: { gt: dayStart },
          status: { in: activeAppointmentStatuses }
        },
        select: { id: true, startsAt: true, endsAt: true }
      });
      const uncoveredAppointment = findAppointmentOutsideRanges(
        dayAppointments,
        newRanges
      );
      if (uncoveredAppointment) {
        return reply.code(409).send({ error: "schedule_day_has_appointments" });
      }

      const ranges = await database!.$transaction(async (transaction) => {
        await transaction.scheduleException.deleteMany({
          where: {
            staffId: selection.selected.id,
            startsAt: { gte: dayStart },
            endsAt: { lte: dayEnd }
          }
        });

        await transaction.scheduleException.create({
          data: {
            staffId: selection.selected.id,
            startsAt: dayStart,
            endsAt: dayEnd,
            isBookable: false,
            reason: null
          }
        });

        for (const range of sortedRanges) {
          await transaction.scheduleException.create({
            data: {
              staffId: selection.selected.id,
              startsAt: timeToDate(date, range.startsAt),
              endsAt: timeToDate(date, range.endsAt),
              isBookable: true,
              reason: null
            }
          });
        }

        const [workingHours, dayExceptions] = await Promise.all([
          transaction.workingHour.findMany({
            where: {
              staffId: selection.selected.id,
              weekday: weekdayForDate(date),
              isActive: true
            },
            select: { startsAt: true, endsAt: true }
          }),
          transaction.scheduleException.findMany({
            where: {
              staffId: selection.selected.id,
              startsAt: { lt: dayEnd },
              endsAt: { gt: dayStart }
            },
            select: { startsAt: true, endsAt: true, isBookable: true }
          })
        ]);

        return resolveDisplayRanges({ date, workingHours, exceptions: dayExceptions });
      });

      return { date, ranges };
    }
  );
}
