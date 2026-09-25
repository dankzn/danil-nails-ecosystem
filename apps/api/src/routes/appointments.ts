import {
  AppointmentStatus,
  AttendanceConfirmationStatus,
  BookingSource,
  Currency,
  PaymentMethod,
  UserRole,
  type DatabaseClient
} from "@danil-nails/db";
import { bookingRules, businessConfig } from "@danil-nails/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  findAvailableSlots,
  isDateWithinBookingHorizon
} from "../availability.js";
import { authorize } from "../auth/session.js";

const appointmentStatuses = ["confirmed", "canceled", "no_show"] as const;
const paymentMethods = [
  "online_acquiring",
  "cash",
  "phone_transfer"
] as const;
const attendanceStatuses = [
  "not_requested",
  "pending",
  "confirmed",
  "declined"
] as const;
const activeAppointmentStatuses: AppointmentStatus[] = [
  AppointmentStatus.draft,
  AppointmentStatus.pending_admin_confirmation,
  AppointmentStatus.confirmed
];

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const listQuerySchema = z.object({
  date: z.string().regex(datePattern).optional(),
  staffId: z.string().cuid().optional()
});
const rescheduleAvailabilityQuerySchema = z.object({
  date: z.string().regex(datePattern),
  staffId: z.string().cuid().optional(),
  serviceId: z.string().cuid().optional()
});
const createAppointmentSchema = z.object({
  clientId: z.string().cuid(),
  staffId: z.string().cuid(),
  serviceId: z.string().cuid(),
  startsAt: z.iso.datetime(),
  clientComment: z.string().trim().max(2000).nullable().optional(),
  internalNote: z.string().trim().max(4000).nullable().optional()
});
const statusUpdateSchema = z.object({
  status: z.enum(appointmentStatuses),
  note: z.string().trim().max(1000).nullable().optional(),
  cancellationReason: z.string().trim().max(1000).nullable().optional(),
  canceledBy: z.enum(["client", "studio"]).optional()
});
const attendanceUpdateSchema = z.object({
  status: z.enum(attendanceStatuses)
});
const rescheduleSchema = z.object({
  startsAt: z.iso.datetime(),
  staffId: z.string().cuid().optional(),
  serviceId: z.string().cuid().optional(),
  requestedBy: z.enum(["client", "studio"]).default("studio"),
  note: z.string().trim().max(1000).nullable().optional()
});
const closePaymentSchema = z.object({
  method: z.enum(paymentMethods),
  amountMinor: z.number().int().positive(),
  externalTransactionId: z.string().trim().max(200).nullable().optional()
});
const closeAppointmentSchema = z.object({
  payments: z.array(closePaymentSchema).max(10).default([]),
  note: z.string().trim().max(1000).nullable().optional(),
  adjustmentReason: z.string().trim().max(1000).nullable().optional()
});
const reopenAppointmentSchema = z.object({
  reason: z.string().trim().min(1).max(1000)
});
const idSchema = z.object({ id: z.string().cuid() });

const appointmentInclude = {
  client: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      telegramUsername: true,
      requiresPrepayment: true
    }
  },
  service: {
    select: {
      id: true,
      titleRu: true,
      durationMinutes: true,
      bufferAfterMinutes: true
    }
  },
  staff: { select: { id: true, displayName: true, userId: true } },
  createdBy: {
    select: {
      email: true,
      staffProfile: { select: { displayName: true } }
    }
  },
  closedBy: {
    select: {
      email: true,
      staffProfile: { select: { displayName: true } }
    }
  },
  payments: {
    where: { voidedAt: null },
    orderBy: { occurredAt: "asc" },
    select: {
      id: true,
      method: true,
      amountMinor: true,
      currency: true,
      externalTransactionId: true,
      occurredAt: true,
      receivedBy: {
        select: {
          email: true,
          staffProfile: { select: { displayName: true } }
        }
      }
    }
  }
} as const;

function sendInvalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid_appointment_payload" });
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

function rangeForMoscowDate(date: string) {
  const startsAt = new Date(`${date}T00:00:00+03:00`);
  return {
    startsAt,
    endsAt: new Date(startsAt.getTime() + 24 * 60 * 60 * 1000)
  };
}

function appointmentEnd(startsAt: Date, durationMinutes: number) {
  return new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
}

export function requiresPrepaymentPenalty(options: {
  action: "canceled" | "no_show" | "rescheduled";
  appointmentStartsAt: Date;
  initiatedBy?: "client" | "studio";
  now?: Date;
}) {
  if (options.action === "no_show") return true;
  if (options.initiatedBy !== "client") return false;

  const now = options.now ?? new Date();
  const cutoff = bookingRules.lateCancellationWindowHours * 60 * 60 * 1000;
  return options.appointmentStartsAt.getTime() - now.getTime() <= cutoff;
}

export function evaluateAppointmentClose(options: {
  priceMinor: number;
  payments: Array<{ amountMinor: number }>;
  adjustmentReason?: string | null | undefined;
}):
  | { ok: true }
  | { ok: false; error: "appointment_payment_mismatch" | "appointment_payment_required" } {
  if (options.priceMinor > 0 && options.payments.length === 0) {
    return { ok: false, error: "appointment_payment_required" };
  }
  const totalMinor = options.payments.reduce(
    (sum, payment) => sum + payment.amountMinor,
    0
  );
  const isBalanced = totalMinor === options.priceMinor;
  if (!isBalanced && !options.adjustmentReason) {
    return { ok: false, error: "appointment_payment_mismatch" };
  }
  return { ok: true };
}

async function conflictingAppointment(
  database: DatabaseClient,
  staffId: string,
  startsAt: Date,
  endsAt: Date,
  excludedAppointmentId?: string
) {
  return database.appointment.findFirst({
    where: {
      staffId,
      status: { in: activeAppointmentStatuses },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludedAppointmentId ? { id: { not: excludedAppointmentId } } : {})
    },
    select: { id: true }
  });
}

function canManageAppointment(
  user: { id: string; role: UserRole },
  staffUserId: string
) {
  return (
    user.role === UserRole.owner ||
    user.role === UserRole.admin ||
    (user.role === UserRole.master && user.id === staffUserId)
  );
}

export function registerAppointmentRoutes(
  server: FastifyInstance,
  database: DatabaseClient | null
) {
  const staffGuard = authorize(database, [
    UserRole.owner,
    UserRole.admin,
    UserRole.master
  ]);
  const adminGuard = authorize(database, [UserRole.owner, UserRole.admin]);
  const ownerGuard = authorize(database, [UserRole.owner]);

  server.get(
    "/v1/admin/booking-options",
    { preHandler: adminGuard },
    async () => {
      const [clients, services, staff] = await Promise.all([
        database!.client.findMany({
          select: {
            id: true,
            fullName: true,
            phone: true,
            requiresPrepayment: true
          },
          orderBy: [{ fullName: "asc" }, { phone: "asc" }],
          take: 250
        }),
        database!.service.findMany({
          where: { isActive: true },
          select: {
            id: true,
            titleRu: true,
            durationMinutes: true,
            bufferAfterMinutes: true
          },
          orderBy: { titleRu: "asc" }
        }),
        database!.staffProfile.findMany({
          where: { isBookable: true },
          select: { id: true, displayName: true },
          orderBy: { displayName: "asc" }
        })
      ]);

      return { clients, services, staff };
    }
  );

  server.get(
    "/v1/admin/appointments",
    { preHandler: staffGuard },
    async (request, reply) => {
      const query = listQuerySchema.safeParse(request.query);
      if (!query.success) return sendInvalidPayload(reply);

      const date = query.data.date ?? moscowDateKey();
      const range = rangeForMoscowDate(date);
      let staffId = query.data.staffId;

      if (request.crmUser!.role === UserRole.master) {
        const profile = await database!.staffProfile.findUnique({
          where: { userId: request.crmUser!.id },
          select: { id: true }
        });
        if (!profile) return reply.code(403).send({ error: "staff_profile_required" });
        staffId = profile.id;
      }

      const appointments = await database!.appointment.findMany({
        where: {
          startsAt: { gte: range.startsAt, lt: range.endsAt },
          ...(staffId ? { staffId } : {})
        },
        include: appointmentInclude,
        orderBy: { startsAt: "asc" }
      });

      return { date, timezone: businessConfig.timezone, appointments };
    }
  );

  server.post(
    "/v1/admin/appointments",
    { preHandler: adminGuard },
    async (request, reply) => {
      const input = createAppointmentSchema.safeParse(request.body);
      if (!input.success) return sendInvalidPayload(reply);

      const startsAt = new Date(input.data.startsAt);
      const [client, service, staff] = await Promise.all([
        database!.client.findUnique({ where: { id: input.data.clientId } }),
        database!.service.findFirst({
          where: { id: input.data.serviceId, isActive: true },
          include: { prices: { where: { currency: Currency.RUB }, take: 1 } }
        }),
        database!.staffProfile.findFirst({
          where: { id: input.data.staffId, isBookable: true }
        })
      ]);

      if (!client) return reply.code(404).send({ error: "client_not_found" });
      if (!service) return reply.code(404).send({ error: "service_not_found" });
      if (!staff) return reply.code(404).send({ error: "staff_not_found" });

      if (!isDateWithinBookingHorizon(moscowDateKey(startsAt))) {
        return reply.code(409).send({ error: "appointment_slot_unavailable" });
      }
      const availability = await findAvailableSlots(database!, {
        staffId: staff.id,
        serviceId: service.id,
        date: moscowDateKey(startsAt)
      });
      if (
        !availability.ok ||
        !availability.slots.some(
          (slot) => slot.startsAt.getTime() === startsAt.getTime()
        )
      ) {
        return reply.code(409).send({ error: "appointment_slot_unavailable" });
      }

      const endsAt = appointmentEnd(startsAt, service.durationMinutes);
      if (
        await conflictingAppointment(
          database!,
          staff.id,
          startsAt,
          endsAt
        )
      ) {
        return reply.code(409).send({ error: "appointment_time_conflict" });
      }

      const appointment = await database!.$transaction(async (transaction) => {
        const created = await transaction.appointment.create({
          data: {
            clientId: client.id,
            staffId: staff.id,
            serviceId: service.id,
            source: BookingSource.admin_manual,
            createdByUserId: request.crmUser!.id,
            priceMinor: service.prices[0]?.amountMinor ?? 0,
            currency: Currency.RUB,
            startsAt,
            endsAt,
            ...(input.data.clientComment !== undefined
              ? { clientComment: input.data.clientComment }
              : {}),
            ...(input.data.internalNote !== undefined
              ? { internalNote: input.data.internalNote }
              : {})
          }
        });
        await transaction.appointmentEvent.create({
          data: {
            appointmentId: created.id,
            toStatus: created.status,
            actorUserId: request.crmUser!.id,
            note: "Создана администратором"
          }
        });
        return transaction.appointment.findUniqueOrThrow({
          where: { id: created.id },
          include: appointmentInclude
        });
      });

      return reply.code(201).send({ appointment });
    }
  );

  server.patch(
    "/v1/admin/appointments/:id/status",
    { preHandler: staffGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = statusUpdateSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);

      const current = await database!.appointment.findUnique({
        where: { id: parameters.data.id },
        include: { staff: { select: { userId: true } } }
      });
      if (!current) return reply.code(404).send({ error: "appointment_not_found" });
      if (
        !canManageAppointment(request.crmUser!, current.staff.userId)
      ) {
        return reply.code(403).send({ error: "insufficient_permissions" });
      }

      const status = AppointmentStatus[input.data.status];
      const now = new Date();
      const penalize = requiresPrepaymentPenalty({
        action: input.data.status === "no_show" ? "no_show" : "canceled",
        appointmentStartsAt: current.startsAt,
        ...(input.data.canceledBy
          ? { initiatedBy: input.data.canceledBy }
          : {}),
        now
      });

      const appointment = await database!.$transaction(async (transaction) => {
        const updated = await transaction.appointment.update({
          where: { id: current.id },
          data: {
            status,
            ...(status === AppointmentStatus.confirmed
              ? { adminConfirmedAt: now }
              : {}),
            ...(status === AppointmentStatus.canceled
              ? {
                  canceledAt: now,
                  cancellationReason: input.data.cancellationReason ?? null
                }
              : {})
          }
        });
        await transaction.appointmentEvent.create({
          data: {
            appointmentId: current.id,
            fromStatus: current.status,
            toStatus: status,
            actorUserId: request.crmUser!.id,
            ...(input.data.note !== undefined ? { note: input.data.note } : {})
          }
        });
        if (penalize) {
          await transaction.client.update({
            where: { id: current.clientId },
            data: {
              requiresPrepayment: true,
              prepaymentReason:
                status === AppointmentStatus.no_show
                  ? "Неявка на запись"
                  : "Поздняя отмена клиентом"
            }
          });
        }
        return transaction.appointment.findUniqueOrThrow({
          where: { id: updated.id },
          include: appointmentInclude
        });
      });

      return { appointment };
    }
  );

  server.patch(
    "/v1/admin/appointments/:id/attendance",
    { preHandler: staffGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = attendanceUpdateSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);

      const current = await database!.appointment.findUnique({
        where: { id: parameters.data.id },
        include: { staff: { select: { userId: true } } }
      });
      if (!current) return reply.code(404).send({ error: "appointment_not_found" });
      if (
        !canManageAppointment(request.crmUser!, current.staff.userId)
      ) {
        return reply.code(403).send({ error: "insufficient_permissions" });
      }

      const status = AttendanceConfirmationStatus[input.data.status];
      const now = new Date();
      const appointment = await database!.appointment.update({
        where: { id: current.id },
        data: {
          attendanceConfirmationStatus: status,
          ...(status === AttendanceConfirmationStatus.pending
            ? { attendanceConfirmationRequestedAt: now }
            : {}),
          ...(status === AttendanceConfirmationStatus.confirmed
            ? { clientConfirmedAt: now }
            : {})
        },
        include: appointmentInclude
      });

      return { appointment };
    }
  );

  server.get(
    "/v1/admin/appointments/:id/availability",
    { preHandler: adminGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const query = rescheduleAvailabilityQuerySchema.safeParse(request.query);
      if (!parameters.success || !query.success) return sendInvalidPayload(reply);

      const current = await database!.appointment.findUnique({
        where: { id: parameters.data.id },
        select: { id: true, staffId: true, serviceId: true }
      });
      if (!current) return reply.code(404).send({ error: "appointment_not_found" });
      if (!isDateWithinBookingHorizon(query.data.date)) {
        return sendInvalidPayload(reply);
      }

      const availability = await findAvailableSlots(database!, {
        staffId: query.data.staffId ?? current.staffId,
        serviceId: query.data.serviceId ?? current.serviceId,
        date: query.data.date,
        excludeAppointmentId: current.id
      });
      if (!availability.ok) {
        return reply.code(404).send({ error: availability.error });
      }

      return {
        date: query.data.date,
        timezone: businessConfig.timezone,
        staff: availability.staff,
        service: availability.service,
        slots: availability.slots
      };
    }
  );

  server.post(
    "/v1/admin/appointments/:id/reschedule",
    { preHandler: adminGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = rescheduleSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);

      const current = await database!.appointment.findUnique({
        where: { id: parameters.data.id }
      });
      if (!current) return reply.code(404).send({ error: "appointment_not_found" });

      const staffId = input.data.staffId ?? current.staffId;
      const serviceId = input.data.serviceId ?? current.serviceId;
      const [staff, service] = await Promise.all([
        database!.staffProfile.findFirst({
          where: { id: staffId, isBookable: true }
        }),
        database!.service.findFirst({
          where: { id: serviceId, isActive: true },
          include: { prices: { where: { currency: current.currency }, take: 1 } }
        })
      ]);
      if (!staff) return reply.code(404).send({ error: "staff_not_found" });
      if (!service) return reply.code(404).send({ error: "service_not_found" });

      const startsAt = new Date(input.data.startsAt);
      if (!isDateWithinBookingHorizon(moscowDateKey(startsAt))) {
        return reply.code(409).send({ error: "appointment_slot_unavailable" });
      }
      const availability = await findAvailableSlots(database!, {
        staffId: staff.id,
        serviceId: service.id,
        date: moscowDateKey(startsAt),
        excludeAppointmentId: current.id
      });
      if (
        !availability.ok ||
        !availability.slots.some(
          (slot) => slot.startsAt.getTime() === startsAt.getTime()
        )
      ) {
        return reply.code(409).send({ error: "appointment_slot_unavailable" });
      }

      const endsAt = appointmentEnd(startsAt, service.durationMinutes);
      if (
        await conflictingAppointment(
          database!,
          staff.id,
          startsAt,
          endsAt,
          current.id
        )
      ) {
        return reply.code(409).send({ error: "appointment_time_conflict" });
      }

      const penalize = requiresPrepaymentPenalty({
        action: "rescheduled",
        appointmentStartsAt: current.startsAt,
        initiatedBy: input.data.requestedBy
      });

      const appointment = await database!.$transaction(async (transaction) => {
        await transaction.appointment.update({
          where: { id: current.id },
          data: { status: AppointmentStatus.rescheduled }
        });
        await transaction.appointmentEvent.create({
          data: {
            appointmentId: current.id,
            fromStatus: current.status,
            toStatus: AppointmentStatus.rescheduled,
            actorUserId: request.crmUser!.id,
            ...(input.data.note !== undefined ? { note: input.data.note } : {})
          }
        });
        const created = await transaction.appointment.create({
          data: {
            clientId: current.clientId,
            staffId,
            serviceId,
            source: current.source,
            createdByUserId: current.createdByUserId,
            priceMinor:
              serviceId === current.serviceId
                ? current.priceMinor
                : service.prices[0]?.amountMinor ?? 0,
            currency: current.currency,
            startsAt,
            endsAt,
            clientComment: current.clientComment,
            internalNote: current.internalNote
          }
        });
        await transaction.appointmentEvent.create({
          data: {
            appointmentId: created.id,
            toStatus: created.status,
            actorUserId: request.crmUser!.id,
            note: `Перенос записи ${current.id}`
          }
        });
        if (penalize) {
          await transaction.client.update({
            where: { id: current.clientId },
            data: {
              requiresPrepayment: true,
              prepaymentReason: "Поздний перенос клиентом"
            }
          });
        }
        return transaction.appointment.findUniqueOrThrow({
          where: { id: created.id },
          include: appointmentInclude
        });
      });

      return reply.code(201).send({ appointment });
    }
  );

  server.post(
    "/v1/admin/appointments/:id/close",
    { preHandler: adminGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = closeAppointmentSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);

      const current = await database!.appointment.findUnique({
        where: { id: parameters.data.id }
      });
      if (!current) return reply.code(404).send({ error: "appointment_not_found" });
      if (!activeAppointmentStatuses.includes(current.status)) {
        return reply.code(409).send({ error: "appointment_not_closable" });
      }

      const evaluation = evaluateAppointmentClose({
        priceMinor: current.priceMinor,
        payments: input.data.payments,
        adjustmentReason: input.data.adjustmentReason
      });
      if (!evaluation.ok) {
        return reply.code(409).send({ error: evaluation.error });
      }

      const now = new Date();
      const appointment = await database!.$transaction(async (transaction) => {
        if (input.data.payments.length) {
          await transaction.payment.createMany({
            data: input.data.payments.map((payment) => ({
              appointmentId: current.id,
              method: PaymentMethod[payment.method],
              amountMinor: payment.amountMinor,
              currency: current.currency,
              externalTransactionId: payment.externalTransactionId ?? null,
              receivedByUserId: request.crmUser!.id,
              occurredAt: now
            }))
          });
        }
        const updated = await transaction.appointment.update({
          where: { id: current.id },
          data: {
            status: AppointmentStatus.completed,
            completedAt: now,
            closedByUserId: request.crmUser!.id
          }
        });
        await transaction.appointmentEvent.create({
          data: {
            appointmentId: current.id,
            fromStatus: current.status,
            toStatus: AppointmentStatus.completed,
            actorUserId: request.crmUser!.id,
            note:
              input.data.adjustmentReason ??
              input.data.note ??
              "Запись закрыта с фиксацией оплаты"
          }
        });
        return transaction.appointment.findUniqueOrThrow({
          where: { id: updated.id },
          include: appointmentInclude
        });
      });

      return { appointment };
    }
  );

  server.post(
    "/v1/admin/appointments/:id/reopen",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = reopenAppointmentSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return sendInvalidPayload(reply);

      const current = await database!.appointment.findUnique({
        where: { id: parameters.data.id }
      });
      if (!current) return reply.code(404).send({ error: "appointment_not_found" });
      if (current.status !== AppointmentStatus.completed) {
        return reply.code(409).send({ error: "appointment_not_completed" });
      }

      const appointment = await database!.$transaction(async (transaction) => {
        await transaction.payment.updateMany({
          where: { appointmentId: current.id, voidedAt: null },
          data: { voidedAt: new Date() }
        });
        const updated = await transaction.appointment.update({
          where: { id: current.id },
          data: {
            status: AppointmentStatus.confirmed,
            completedAt: null,
            closedByUserId: null
          }
        });
        await transaction.appointmentEvent.create({
          data: {
            appointmentId: current.id,
            fromStatus: current.status,
            toStatus: AppointmentStatus.confirmed,
            actorUserId: request.crmUser!.id,
            note: input.data.reason
          }
        });
        return transaction.appointment.findUniqueOrThrow({
          where: { id: updated.id },
          include: appointmentInclude
        });
      });

      return { appointment };
    }
  );
}
