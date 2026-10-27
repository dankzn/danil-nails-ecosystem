import { apiUrl } from "./api-url";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string
  ) {
    super(code);
  }
}

const apiRequestTimeoutMs = 15_000;

export async function apiRequest<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener("abort", forwardAbort, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), apiRequestTimeoutMs);

  if (init.body && !(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }

  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...init,
      credentials: "include",
      headers,
      signal: controller.signal
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const code =
        typeof payload === "object" &&
        payload !== null &&
        "error" in payload &&
        typeof payload.error === "string"
          ? payload.error
          : "request_failed";
      throw new ApiError(response.status, code);
    }

    return payload as T;
  } catch (error) {
    if (controller.signal.aborted && !init.signal?.aborted) {
      throw new ApiError(504, "request_timeout");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
    init.signal?.removeEventListener("abort", forwardAbort);
  }
}
