-- CleanupData
-- These four titles were only ever injected as suggestions by the API
-- (never a real reference list) and are being retired in favor of a
-- dictionary built entirely from tags an admin actually chooses to create.
-- Deleting the tag rows cascades to ClientPrivateTagAssignment, so any
-- client currently carrying one of these labels loses that assignment too.
DELETE FROM "ClientPrivateTag"
WHERE lower(title) IN ('скандальный', 'требовательный', 'доебистый', 'лапочка');
