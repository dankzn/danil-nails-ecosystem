const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

if (process.env.NODE_ENV === "production" && !configuredApiUrl) {
  throw new Error("NEXT_PUBLIC_API_URL is required for the production CRM build");
}

export const apiUrl = (configuredApiUrl || "http://localhost:4000").replace(/\/+$/, "");
