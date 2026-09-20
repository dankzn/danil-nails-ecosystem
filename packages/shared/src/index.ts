export const supportedLocales = ["ru", "en", "es"] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export const userRoles = ["owner", "admin", "master", "client"] as const;

export type UserRole = (typeof userRoles)[number];

export const appointmentStatuses = [
  "draft",
  "pending_admin_confirmation",
  "pending_client_confirmation",
  "confirmed",
  "completed",
  "canceled",
  "rescheduled",
  "no_show"
] as const;

export type AppointmentStatus = (typeof appointmentStatuses)[number];

export const businessConfig = {
  brandName: "Danil Nails Studio",
  timezone: "Europe/Moscow",
  launchCity: "Moscow",
  futureMarket: "Spain",
  defaultLocale: "ru" satisfies SupportedLocale
} as const;

export const initialServices = [
  {
    slug: "manicure-with-gel",
    name: {
      ru: "Маникюр с покрытием",
      en: "Manicure with gel polish",
      es: "Manicura con esmalte semipermanente"
    },
    defaultDurationMinutes: 120
  },
  {
    slug: "manicure-without-gel",
    name: {
      ru: "Маникюр без покрытия",
      en: "Manicure without polish",
      es: "Manicura sin esmalte"
    },
    defaultDurationMinutes: 60
  },
  {
    slug: "japanese-manicure",
    name: {
      ru: "Японский маникюр",
      en: "Japanese manicure",
      es: "Manicura japonesa"
    },
    defaultDurationMinutes: 75
  }
] as const;

