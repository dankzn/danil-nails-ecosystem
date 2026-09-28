import { environment } from "../config.js";

export class StorageNotConfiguredError extends Error {
  constructor() {
    super("storage_not_configured");
  }
}

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isAllowedPhotoMimeType(mimeType: string) {
  return allowedMimeTypes.has(mimeType);
}

function extensionForMimeType(mimeType: string) {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

export function isStorageConfigured() {
  return Boolean(environment.SUPABASE_URL && environment.SUPABASE_SERVICE_ROLE_KEY);
}

// Uses Supabase Storage's REST API directly instead of the @supabase/supabase-js
// SDK: uploading one file per request doesn't need the SDK's client/session
// machinery, and this keeps the dependency footprint down.
export async function uploadStaffPhoto(
  staffProfileId: string,
  data: Buffer,
  mimeType: string
) {
  const { SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey } = environment;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new StorageNotConfiguredError();
  }

  const bucket = environment.SUPABASE_STAFF_PHOTOS_BUCKET;
  const path = `${staffProfileId}-${Date.now()}.${extensionForMimeType(mimeType)}`;

  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": mimeType,
      "x-upsert": "true"
    },
    body: new Uint8Array(data)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`supabase_storage_upload_failed: ${response.status} ${body}`);
  }

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}
