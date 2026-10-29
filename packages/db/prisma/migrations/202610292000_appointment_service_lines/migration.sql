-- Extra service line items for multi-service appointments (DIKIDI parity).
-- The primary service stays on Appointment.serviceId; additional services
-- attached to the same appointment live here.
CREATE TABLE "AppointmentService" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "durationMinutes" INTEGER NOT NULL,
    "priceMinor" INTEGER NOT NULL,
    "discountAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentService_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppointmentService_appointmentId_position_idx"
ON "AppointmentService"("appointmentId", "position");

ALTER TABLE "AppointmentService"
ADD CONSTRAINT "AppointmentService_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppointmentService"
ADD CONSTRAINT "AppointmentService_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
