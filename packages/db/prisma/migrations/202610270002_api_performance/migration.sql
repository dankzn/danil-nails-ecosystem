-- Speed up availability checks and the serialized conflict check used when
-- two clients try to book the same master at the same time.
CREATE INDEX "Appointment_staffId_status_startsAt_endsAt_idx"
ON "Appointment"("staffId", "status", "startsAt", "endsAt");
