import { AppointmentStatus, type DatabaseClient } from "@danil-nails/db";
import { bookingRules, businessConfig } from "@danil-nails/shared";

type TimeRange = {
  startsAt: Date;
  endsAt: Date;
};

type ScheduleExceptionRange = TimeRange & {
  isBookable: boolean;
};

type AppointmentRange = TimeRange & {
  bufferAfterMinutes: number;
};

export type AvailableSlot = {
  startsAt: Date;
  endsAt: Date;
};

function timeToDate(date: string, time: string) {
  return new Date(`${date}T${time}:00+03:00`);
}

function overlaps(left: TimeRange, right: TimeRange) {
  return left.startsAt < right.endsAt && left.endsAt > right.startsAt;
}

function mergeRanges(ranges: TimeRange[]) {
  const sorted = [...ranges].sort(
    (left, right) => left.startsAt.getTime() - right.startsAt.getTime()
  );
  const merged: TimeRange[] = [];

  for (const range of sorted) {
    const previous = merged.at(-1);
    if (!previous || range.startsAt > previous.endsAt) {
      merged.push({ ...range });
      continue;
    }
    if (range.endsAt > previous.endsAt) previous.endsAt = range.endsAt;
  }

  return merged;
}

function weekdayForDate(date: string) {
  const weekday = new Date(`${date}T12:00:00.000Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function moscowDateKey(date = new Date()) {
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

export function isDateWithinBookingHorizon(date: string, now = new Date()) {
  const today = timeToDate(moscowDateKey(now), "00:00");
  const requestedDate = timeToDate(date, "00:00");
  const horizonEnd = new Date(
    today.getTime() + bookingRules.bookingHorizonDays * 86400000
  );
  return requestedDate >= today && requestedDate <= horizonEnd;
}

export function buildAvailableSlots(options: {
  date: string;
  workingHours: Array<{ startsAt: string; endsAt: string }>;
  exceptions: ScheduleExceptionRange[];
  appointments: AppointmentRange[];
  durationMinutes: number;
  bufferAfterMinutes: number;
  now?: Date;
  minimumLeadTimeMinutes?: number;
  slotIntervalMinutes?: number;
}) {
  const slotIntervalMinutes =
    options.slotIntervalMinutes ?? bookingRules.slotIntervalMinutes;
  const minimumLeadTimeMinutes =
    options.minimumLeadTimeMinutes ?? bookingRules.minimumLeadTimeMinutes;
  const dayStart = timeToDate(options.date, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const earliestStart = new Date(
    (options.now ?? new Date()).getTime() + minimumLeadTimeMinutes * 60000
  );
  const availableRanges = mergeRanges([
    ...options.workingHours.map((range) => ({
      startsAt: timeToDate(options.date, range.startsAt),
      endsAt: timeToDate(options.date, range.endsAt)
    })),
    ...options.exceptions
      .filter((exception) => exception.isBookable)
      .map(({ startsAt, endsAt }) => ({
        startsAt: startsAt < dayStart ? dayStart : startsAt,
        endsAt: endsAt > dayEnd ? dayEnd : endsAt
      }))
      .filter((range) => range.startsAt < range.endsAt)
  ]);
  const blockedRanges: TimeRange[] = [
    ...options.exceptions
      .filter((exception) => !exception.isBookable)
      .map(({ startsAt, endsAt }) => ({ startsAt, endsAt })),
    ...options.appointments.map((appointment) => ({
      startsAt: appointment.startsAt,
      endsAt: new Date(
        appointment.endsAt.getTime() + appointment.bufferAfterMinutes * 60000
      )
    }))
  ];
  const intervalMs = slotIntervalMinutes * 60000;
  const occupiedDurationMs =
    (options.durationMinutes + options.bufferAfterMinutes) * 60000;
  const serviceDurationMs = options.durationMinutes * 60000;
  const slots: AvailableSlot[] = [];

  for (const range of availableRanges) {
    const offset = Math.max(0, range.startsAt.getTime() - dayStart.getTime());
    let cursor = new Date(
      dayStart.getTime() + Math.ceil(offset / intervalMs) * intervalMs
    );

    while (cursor.getTime() + occupiedDurationMs <= range.endsAt.getTime()) {
      const occupiedRange = {
        startsAt: cursor,
        endsAt: new Date(cursor.getTime() + occupiedDurationMs)
      };
      if (
        cursor >= earliestStart &&
        !blockedRanges.some((blocked) => overlaps(occupiedRange, blocked))
      ) {
        slots.push({
          startsAt: new Date(cursor),
          endsAt: new Date(cursor.getTime() + serviceDurationMs)
        });
      }
      cursor = new Date(cursor.getTime() + intervalMs);
    }
  }

  return slots;
}

export async function findAvailableSlots(
  database: DatabaseClient,
  input: {
    staffId: string;
    serviceId: string;
    date: string;
    now?: Date;
    excludeAppointmentId?: string;
  }
) {
  const dayStart = timeToDate(input.date, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const weekday = weekdayForDate(input.date);
  const [staff, service] = await Promise.all([
    database.staffProfile.findFirst({
      where: { id: input.staffId, isBookable: true },
      select: { id: true, displayName: true }
    }),
    database.service.findFirst({
      where: { id: input.serviceId, isActive: true },
      select: {
        id: true,
        titleRu: true,
        durationMinutes: true,
        bufferAfterMinutes: true
      }
    })
  ]);

  if (!staff) return { ok: false as const, error: "staff_not_found" as const };
  if (!service) {
    return { ok: false as const, error: "service_not_found" as const };
  }

  const [workingHours, exceptions, appointments] = await Promise.all([
    database.workingHour.findMany({
      where: { staffId: staff.id, weekday, isActive: true },
      select: { startsAt: true, endsAt: true },
      orderBy: { startsAt: "asc" }
    }),
    database.scheduleException.findMany({
      where: {
        staffId: staff.id,
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart }
      },
      select: { startsAt: true, endsAt: true, isBookable: true }
    }),
    database.appointment.findMany({
      where: {
        staffId: staff.id,
        ...(input.excludeAppointmentId
          ? { id: { not: input.excludeAppointmentId } }
          : {}),
        status: {
          notIn: [
            AppointmentStatus.canceled,
            AppointmentStatus.rescheduled,
            AppointmentStatus.no_show
          ]
        },
        startsAt: { lt: dayEnd },
        endsAt: { gt: new Date(dayStart.getTime() - 4 * 60 * 60 * 1000) }
      },
      select: {
        startsAt: true,
        endsAt: true,
        service: { select: { bufferAfterMinutes: true } }
      }
    })
  ]);

  const slots = buildAvailableSlots({
    date: input.date,
    workingHours,
    exceptions,
    appointments: appointments.map((appointment) => ({
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      bufferAfterMinutes: appointment.service.bufferAfterMinutes
    })),
    durationMinutes: service.durationMinutes,
    bufferAfterMinutes: service.bufferAfterMinutes,
    ...(input.now ? { now: input.now } : {})
  });

  return { ok: true as const, staff, service, slots };
}
