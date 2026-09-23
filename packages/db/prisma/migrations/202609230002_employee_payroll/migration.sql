CREATE TYPE "BookingSource" AS ENUM ('online', 'admin_manual');
CREATE TYPE "PayrollStatus" AS ENUM ('accrued', 'partially_paid', 'paid', 'adjustment_due');
CREATE TYPE "PayrollEntryType" AS ENUM ('master_commission', 'admin_commission', 'fixed_salary', 'review_bonus', 'cleaning', 'bonus', 'deduction', 'adjustment');

ALTER TABLE "Appointment"
ADD COLUMN "source" "BookingSource" NOT NULL DEFAULT 'online',
ADD COLUMN "createdByUserId" TEXT,
ADD COLUMN "priceMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'RUB',
ADD COLUMN "completedAt" TIMESTAMP(3);

UPDATE "Appointment" AS appointment
SET
  "priceMinor" = COALESCE(price."amountMinor", 0),
  "currency" = 'RUB',
  "completedAt" = CASE
    WHEN appointment."status" = 'completed' THEN appointment."updatedAt"
    ELSE NULL
  END
FROM "ServicePrice" AS price
WHERE price."serviceId" = appointment."serviceId"
  AND price."currency" = 'RUB';

WITH creators AS (
  SELECT DISTINCT ON (event."appointmentId")
    event."appointmentId",
    event."actorUserId"
  FROM "AppointmentEvent" AS event
  WHERE event."actorUserId" IS NOT NULL
    AND event."note" LIKE 'Создана администратором%'
  ORDER BY event."appointmentId", event."createdAt" ASC
)
UPDATE "Appointment" AS appointment
SET
  "source" = 'admin_manual',
  "createdByUserId" = creators."actorUserId"
FROM creators
WHERE creators."appointmentId" = appointment."id";

CREATE TABLE "EmployeeCompensationRule" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "masterCommissionBps" INTEGER NOT NULL DEFAULT 0,
  "adminBookingCommissionBps" INTEGER NOT NULL DEFAULT 0,
  "fixedMonthlyMinor" INTEGER NOT NULL DEFAULT 0,
  "currency" "Currency" NOT NULL DEFAULT 'RUB',
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeCompensationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmployeePayroll" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "currency" "Currency" NOT NULL DEFAULT 'RUB',
  "status" "PayrollStatus" NOT NULL DEFAULT 'accrued',
  "masterCommissionBpsSnapshot" INTEGER NOT NULL DEFAULT 0,
  "adminCommissionBpsSnapshot" INTEGER NOT NULL DEFAULT 0,
  "fixedMonthlyMinorSnapshot" INTEGER NOT NULL DEFAULT 0,
  "appointmentCommissionMinor" INTEGER NOT NULL DEFAULT 0,
  "fixedMinor" INTEGER NOT NULL DEFAULT 0,
  "adjustmentsMinor" INTEGER NOT NULL DEFAULT 0,
  "totalAccruedMinor" INTEGER NOT NULL DEFAULT 0,
  "totalPaidMinor" INTEGER NOT NULL DEFAULT 0,
  "accruedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeePayroll_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollEntry" (
  "id" TEXT NOT NULL,
  "payrollId" TEXT NOT NULL,
  "appointmentId" TEXT,
  "type" "PayrollEntryType" NOT NULL,
  "description" TEXT NOT NULL,
  "sourceAmountMinor" INTEGER,
  "rateBps" INTEGER,
  "amountMinor" INTEGER NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollPayment" (
  "id" TEXT NOT NULL,
  "payrollId" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "method" TEXT,
  "note" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeCompensationRule_staffId_effectiveFrom_key" ON "EmployeeCompensationRule"("staffId", "effectiveFrom");
CREATE INDEX "EmployeeCompensationRule_staffId_effectiveFrom_effectiveTo_idx" ON "EmployeeCompensationRule"("staffId", "effectiveFrom", "effectiveTo");
CREATE UNIQUE INDEX "EmployeePayroll_staffId_periodStart_currency_key" ON "EmployeePayroll"("staffId", "periodStart", "currency");
CREATE INDEX "EmployeePayroll_periodStart_status_idx" ON "EmployeePayroll"("periodStart", "status");
CREATE UNIQUE INDEX "PayrollEntry_payrollId_appointmentId_type_key" ON "PayrollEntry"("payrollId", "appointmentId", "type");
CREATE INDEX "PayrollEntry_payrollId_type_idx" ON "PayrollEntry"("payrollId", "type");
CREATE INDEX "PayrollPayment_payrollId_paidAt_idx" ON "PayrollPayment"("payrollId", "paidAt");
CREATE INDEX "Appointment_createdByUserId_source_completedAt_idx" ON "Appointment"("createdByUserId", "source", "completedAt");
CREATE INDEX "Appointment_completedAt_status_idx" ON "Appointment"("completedAt", "status");

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeeCompensationRule" ADD CONSTRAINT "EmployeeCompensationRule_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeCompensationRule" ADD CONSTRAINT "EmployeeCompensationRule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeePayroll" ADD CONSTRAINT "EmployeePayroll_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeePayroll" ADD CONSTRAINT "EmployeePayroll_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "EmployeePayroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "EmployeePayroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollPayment" ADD CONSTRAINT "PayrollPayment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
