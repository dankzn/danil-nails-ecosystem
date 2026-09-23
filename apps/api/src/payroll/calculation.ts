import {
  AppointmentStatus,
  BookingSource,
  Currency,
  PayrollEntryType,
  UserRole,
  type DatabaseClient
} from "@danil-nails/db";

export const defaultMasterCommissionBps = 4600;
export const defaultAdminCommissionBps = 1300;

export function commissionAmount(sourceAmountMinor: number, rateBps: number) {
  return Math.round((sourceAmountMinor * rateBps) / 10_000);
}

export function currentMonthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  if (!year || !month) throw new Error("Unable to determine the payroll month");
  return `${year}-${month}`;
}

export function payrollPeriod(month: string) {
  const [year = 0, monthNumber = 0] = month.split("-").map(Number);
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const paddedNextMonth = String(nextMonth).padStart(2, "0");

  return {
    periodStart: new Date(`${month}-01T00:00:00.000Z`),
    periodEnd: new Date(`${nextYear}-${paddedNextMonth}-01T00:00:00.000Z`),
    completedFrom: new Date(`${month}-01T00:00:00+03:00`),
    completedTo: new Date(`${nextYear}-${paddedNextMonth}-01T00:00:00+03:00`)
  };
}

function defaultRule(role: UserRole) {
  return {
    id: null,
    masterCommissionBps:
      role === UserRole.master || role === UserRole.owner
        ? defaultMasterCommissionBps
        : 0,
    adminBookingCommissionBps:
      role === UserRole.admin ? defaultAdminCommissionBps : 0,
    fixedMonthlyMinor: 0,
    currency: Currency.RUB
  };
}

export async function payrollPreview(
  database: DatabaseClient,
  staffId: string,
  month: string
) {
  const range = payrollPeriod(month);
  const staff = await database.staffProfile.findUnique({
    where: { id: staffId },
    select: {
      id: true,
      displayName: true,
      userId: true,
      user: { select: { role: true } }
    }
  });
  if (!staff) return null;

  const savedRule = await database.employeeCompensationRule.findFirst({
    where: {
      staffId,
      effectiveFrom: { lte: range.periodStart },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: range.periodStart } }]
    },
    orderBy: { effectiveFrom: "desc" }
  });
  const rule = savedRule ?? defaultRule(staff.user.role);

  const appointments = await database.appointment.findMany({
    where: {
      status: AppointmentStatus.completed,
      completedAt: { gte: range.completedFrom, lt: range.completedTo },
      currency: rule.currency,
      OR: [
        ...(rule.masterCommissionBps > 0 ? [{ staffId }] : []),
        ...(rule.adminBookingCommissionBps > 0
          ? [
              {
                createdByUserId: staff.userId,
                source: BookingSource.admin_manual
              }
            ]
          : [])
      ]
    },
    select: {
      id: true,
      staffId: true,
      createdByUserId: true,
      source: true,
      priceMinor: true,
      currency: true,
      completedAt: true,
      startsAt: true,
      client: { select: { fullName: true, phone: true } },
      service: { select: { titleRu: true } },
      staff: { select: { displayName: true } }
    },
    orderBy: { completedAt: "asc" }
  });

  const entries = appointments.flatMap((appointment) => {
    const result = [];
    const occurredAt = appointment.completedAt ?? appointment.startsAt;
    const clientName = appointment.client.fullName ?? appointment.client.phone;

    if (appointment.staffId === staff.id && rule.masterCommissionBps > 0) {
      result.push({
        appointmentId: appointment.id,
        type: PayrollEntryType.master_commission,
        description: `${appointment.service.titleRu} · ${clientName}`,
        sourceAmountMinor: appointment.priceMinor,
        rateBps: rule.masterCommissionBps,
        amountMinor: commissionAmount(
          appointment.priceMinor,
          rule.masterCommissionBps
        ),
        occurredAt
      });
    }

    if (
      appointment.createdByUserId === staff.userId &&
      appointment.source === BookingSource.admin_manual &&
      rule.adminBookingCommissionBps > 0
    ) {
      result.push({
        appointmentId: appointment.id,
        type: PayrollEntryType.admin_commission,
        description: `${appointment.service.titleRu} · ${clientName} · мастер ${appointment.staff.displayName}`,
        sourceAmountMinor: appointment.priceMinor,
        rateBps: rule.adminBookingCommissionBps,
        amountMinor: commissionAmount(
          appointment.priceMinor,
          rule.adminBookingCommissionBps
        ),
        occurredAt
      });
    }

    return result;
  });

  const commissionMinor = entries.reduce(
    (total, entry) => total + entry.amountMinor,
    0
  );

  const payroll = await database.employeePayroll.findFirst({
    where: { staffId, periodStart: range.periodStart },
    include: {
      entries: { orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }] },
      payments: { orderBy: { paidAt: "desc" } }
    }
  });

  return {
    month,
    staff,
    range,
    rule,
    preview: {
      entries,
      commissionMinor,
      fixedMinor: rule.fixedMonthlyMinor,
      totalMinor: commissionMinor + rule.fixedMonthlyMinor,
      currency: rule.currency
    },
    payroll
  };
}

export function payrollDisplayStatus(payroll: {
  status: string;
  totalAccruedMinor: number;
  totalPaidMinor: number;
} | null) {
  if (!payroll) return "not_accrued" as const;
  return payroll.status;
}
