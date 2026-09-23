import {
  Currency,
  PayrollEntryType,
  PayrollStatus,
  Prisma,
  UserRole,
  type DatabaseClient
} from "@danil-nails/db";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { authorize } from "../auth/session.js";
import {
  currentMonthKey,
  payrollDisplayStatus,
  payrollPeriod,
  payrollPreview
} from "../payroll/calculation.js";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const idSchema = z.object({ id: z.string().cuid() });
const entryIdSchema = z.object({ id: z.string().cuid(), entryId: z.string().cuid() });
const payrollQuerySchema = z.object({ month: monthSchema.default(currentMonthKey()) });
const compensationSchema = z.object({
  month: monthSchema,
  masterCommissionBps: z.number().int().min(0).max(10_000),
  adminBookingCommissionBps: z.number().int().min(0).max(10_000),
  fixedMonthlyMinor: z.number().int().nonnegative(),
  currency: z.enum(["RUB", "EUR", "USD"])
});
const accrueSchema = z.object({ month: monthSchema });
const adjustmentSchema = z.object({
  month: monthSchema,
  type: z.enum(["review_bonus", "cleaning", "bonus", "deduction", "adjustment"]),
  description: z.string().trim().min(2).max(300),
  amountMinor: z.number().int().positive(),
  occurredAt: z.iso.date()
});
const paymentSchema = z.object({
  month: monthSchema,
  amountMinor: z.number().int().positive(),
  paidAt: z.iso.date(),
  method: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional()
});

const autoEntryTypes: PayrollEntryType[] = [
  PayrollEntryType.master_commission,
  PayrollEntryType.admin_commission,
  PayrollEntryType.fixed_salary
];

function invalid(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid_payroll_payload" });
}

function optionalText(value: string | null | undefined) {
  return value?.trim() || null;
}

function dateValue(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}

function serializedContext(context: NonNullable<Awaited<ReturnType<typeof payrollPreview>>>) {
  const payroll = context.payroll;
  return {
    month: context.month,
    rule: {
      id: context.rule.id,
      masterCommissionBps: context.rule.masterCommissionBps,
      adminBookingCommissionBps: context.rule.adminBookingCommissionBps,
      fixedMonthlyMinor: context.rule.fixedMonthlyMinor,
      currency: context.rule.currency
    },
    preview: context.preview,
    payroll: payroll
      ? {
          ...payroll,
          remainingMinor: Math.max(
            payroll.totalAccruedMinor - payroll.totalPaidMinor,
            0
          ),
          displayStatus: payrollDisplayStatus(payroll)
        }
      : null
  };
}

async function recalculatePayroll(
  transaction: Prisma.TransactionClient,
  payrollId: string
) {
  const [entries, payments, current] = await Promise.all([
    transaction.payrollEntry.findMany({ where: { payrollId } }),
    transaction.payrollPayment.findMany({ where: { payrollId } }),
    transaction.employeePayroll.findUniqueOrThrow({ where: { id: payrollId } })
  ]);
  const appointmentCommissionMinor = entries
    .filter(
      (entry) =>
        entry.type === PayrollEntryType.master_commission ||
        entry.type === PayrollEntryType.admin_commission
    )
    .reduce((total, entry) => total + entry.amountMinor, 0);
  const fixedMinor = entries
    .filter((entry) => entry.type === PayrollEntryType.fixed_salary)
    .reduce((total, entry) => total + entry.amountMinor, 0);
  const adjustmentsMinor = entries
    .filter((entry) => !autoEntryTypes.includes(entry.type))
    .reduce((total, entry) => total + entry.amountMinor, 0);
  const totalAccruedMinor = appointmentCommissionMinor + fixedMinor + adjustmentsMinor;
  const totalPaidMinor = payments.reduce(
    (total, payment) => total + payment.amountMinor,
    0
  );

  let status: PayrollStatus = PayrollStatus.accrued;
  if (totalPaidMinor > 0 && totalPaidMinor < totalAccruedMinor) {
    status =
      current.status === PayrollStatus.paid ||
      current.status === PayrollStatus.adjustment_due
        ? PayrollStatus.adjustment_due
        : PayrollStatus.partially_paid;
  } else if (totalPaidMinor === totalAccruedMinor && totalAccruedMinor > 0) {
    status = PayrollStatus.paid;
  } else if (totalPaidMinor > totalAccruedMinor) {
    status = PayrollStatus.adjustment_due;
  }

  return transaction.employeePayroll.update({
    where: { id: payrollId },
    data: {
      appointmentCommissionMinor,
      fixedMinor,
      adjustmentsMinor,
      totalAccruedMinor,
      totalPaidMinor,
      status,
      paidAt:
        status === PayrollStatus.paid
          ? payments.sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())[0]
              ?.paidAt ?? new Date()
          : null
    }
  });
}

export function registerPayrollRoutes(
  server: FastifyInstance,
  database: DatabaseClient | null
) {
  const ownerGuard = authorize(database, [UserRole.owner]);

  server.get(
    "/v1/owner/employees/:id/payroll",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const query = payrollQuerySchema.safeParse(request.query);
      if (!parameters.success || !query.success) return invalid(reply);
      const context = await payrollPreview(database!, parameters.data.id, query.data.month);
      if (!context) return reply.code(404).send({ error: "employee_not_found" });
      return serializedContext(context);
    }
  );

  server.put(
    "/v1/owner/employees/:id/compensation",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = compensationSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return invalid(reply);
      const exists = await database!.staffProfile.findUnique({
        where: { id: parameters.data.id },
        select: { id: true }
      });
      if (!exists) return reply.code(404).send({ error: "employee_not_found" });
      const { periodStart } = payrollPeriod(input.data.month);
      const lockedPayroll = await database!.employeePayroll.findFirst({
        where: {
          staffId: exists.id,
          periodStart
        },
        select: { totalPaidMinor: true }
      });
      if (lockedPayroll && lockedPayroll.totalPaidMinor > 0) {
        return reply.code(409).send({ error: "paid_payroll_is_locked" });
      }
      const rule = await database!.employeeCompensationRule.upsert({
        where: {
          staffId_effectiveFrom: {
            staffId: exists.id,
            effectiveFrom: periodStart
          }
        },
        update: {
          masterCommissionBps: input.data.masterCommissionBps,
          adminBookingCommissionBps: input.data.adminBookingCommissionBps,
          fixedMonthlyMinor: input.data.fixedMonthlyMinor,
          currency: Currency[input.data.currency],
          createdByUserId: request.crmUser!.id
        },
        create: {
          staffId: exists.id,
          effectiveFrom: periodStart,
          masterCommissionBps: input.data.masterCommissionBps,
          adminBookingCommissionBps: input.data.adminBookingCommissionBps,
          fixedMonthlyMinor: input.data.fixedMonthlyMinor,
          currency: Currency[input.data.currency],
          createdByUserId: request.crmUser!.id
        }
      });
      return { rule };
    }
  );

  server.post(
    "/v1/owner/employees/:id/payroll/accrue",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = accrueSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return invalid(reply);
      const context = await payrollPreview(database!, parameters.data.id, input.data.month);
      if (!context) return reply.code(404).send({ error: "employee_not_found" });
      if (context.payroll && context.payroll.totalPaidMinor > 0) {
        return reply.code(409).send({ error: "paid_payroll_is_locked" });
      }

      await database!.$transaction(async (transaction) => {
        const payroll = context.payroll
          ? await transaction.employeePayroll.update({
              where: { id: context.payroll.id },
              data: {
                currency: context.rule.currency,
                status: PayrollStatus.accrued,
                masterCommissionBpsSnapshot: context.rule.masterCommissionBps,
                adminCommissionBpsSnapshot:
                  context.rule.adminBookingCommissionBps,
                fixedMonthlyMinorSnapshot: context.rule.fixedMonthlyMinor,
                accruedAt: new Date(),
                createdByUserId: request.crmUser!.id
              }
            })
          : await transaction.employeePayroll.create({
              data: {
                staffId: context.staff.id,
                periodStart: context.range.periodStart,
                periodEnd: context.range.periodEnd,
                currency: context.rule.currency,
                status: PayrollStatus.accrued,
                masterCommissionBpsSnapshot: context.rule.masterCommissionBps,
                adminCommissionBpsSnapshot:
                  context.rule.adminBookingCommissionBps,
                fixedMonthlyMinorSnapshot: context.rule.fixedMonthlyMinor,
                createdByUserId: request.crmUser!.id
              }
            });

        await transaction.payrollEntry.deleteMany({
          where: { payrollId: payroll.id, type: { in: autoEntryTypes } }
        });
        const entries = [
          ...context.preview.entries.map((entry) => ({
            ...entry,
            payrollId: payroll.id,
            createdByUserId: request.crmUser!.id
          })),
          ...(context.rule.fixedMonthlyMinor > 0
            ? [
                {
                  payrollId: payroll.id,
                  appointmentId: null,
                  type: PayrollEntryType.fixed_salary,
                  description: "Фиксированная часть",
                  sourceAmountMinor: null,
                  rateBps: null,
                  amountMinor: context.rule.fixedMonthlyMinor,
                  occurredAt: context.range.periodStart,
                  createdByUserId: request.crmUser!.id
                }
              ]
            : [])
        ];
        if (entries.length) await transaction.payrollEntry.createMany({ data: entries });
        await recalculatePayroll(transaction, payroll.id);
      });

      const updated = await payrollPreview(database!, parameters.data.id, input.data.month);
      return serializedContext(updated!);
    }
  );

  server.post(
    "/v1/owner/employees/:id/payroll/entries",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = adjustmentSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return invalid(reply);
      const { periodStart } = payrollPeriod(input.data.month);
      const payroll = await database!.employeePayroll.findFirst({
        where: { staffId: parameters.data.id, periodStart }
      });
      if (!payroll) return reply.code(409).send({ error: "payroll_not_accrued" });

      await database!.$transaction(async (transaction) => {
        await transaction.payrollEntry.create({
          data: {
            payrollId: payroll.id,
            type: PayrollEntryType[input.data.type],
            description: input.data.description,
            amountMinor:
              input.data.type === "deduction"
                ? -input.data.amountMinor
                : input.data.amountMinor,
            occurredAt: dateValue(input.data.occurredAt),
            createdByUserId: request.crmUser!.id
          }
        });
        await recalculatePayroll(transaction, payroll.id);
      });
      const updated = await payrollPreview(database!, parameters.data.id, input.data.month);
      return reply.code(201).send(serializedContext(updated!));
    }
  );

  server.delete(
    "/v1/owner/employees/:id/payroll/entries/:entryId",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = entryIdSchema.safeParse(request.params);
      const query = payrollQuerySchema.safeParse(request.query);
      if (!parameters.success || !query.success) return invalid(reply);
      const { periodStart } = payrollPeriod(query.data.month);
      const payroll = await database!.employeePayroll.findFirst({
        where: { staffId: parameters.data.id, periodStart }
      });
      if (!payroll) return reply.code(404).send({ error: "payroll_not_found" });
      const result = await database!.$transaction(async (transaction) => {
        const removed = await transaction.payrollEntry.deleteMany({
          where: {
            id: parameters.data.entryId,
            payrollId: payroll.id,
            type: { notIn: autoEntryTypes }
          }
        });
        if (!removed.count) return false;
        await recalculatePayroll(transaction, payroll.id);
        return true;
      });
      if (!result) return reply.code(404).send({ error: "payroll_entry_not_found" });
      return reply.code(204).send();
    }
  );

  server.post(
    "/v1/owner/employees/:id/payroll/payments",
    { preHandler: ownerGuard },
    async (request, reply) => {
      const parameters = idSchema.safeParse(request.params);
      const input = paymentSchema.safeParse(request.body);
      if (!parameters.success || !input.success) return invalid(reply);
      const { periodStart } = payrollPeriod(input.data.month);
      const payroll = await database!.employeePayroll.findFirst({
        where: { staffId: parameters.data.id, periodStart }
      });
      if (!payroll) return reply.code(409).send({ error: "payroll_not_accrued" });
      const remaining = payroll.totalAccruedMinor - payroll.totalPaidMinor;
      if (remaining <= 0 || input.data.amountMinor > remaining) {
        return reply.code(409).send({ error: "invalid_payroll_payment_amount" });
      }

      await database!.$transaction(async (transaction) => {
        await transaction.payrollPayment.create({
          data: {
            payrollId: payroll.id,
            amountMinor: input.data.amountMinor,
            paidAt: dateValue(input.data.paidAt),
            method: optionalText(input.data.method),
            note: optionalText(input.data.note),
            createdByUserId: request.crmUser!.id
          }
        });
        await recalculatePayroll(transaction, payroll.id);
      });
      const updated = await payrollPreview(database!, parameters.data.id, input.data.month);
      return reply.code(201).send(serializedContext(updated!));
    }
  );
}
