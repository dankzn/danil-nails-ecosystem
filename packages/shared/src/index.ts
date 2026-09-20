export const supportedLocales = ["ru", "en", "es"] as const;

export type SupportedLocale = (typeof supportedLocales)[number];

export const userRoles = ["owner", "admin", "master", "client"] as const;

export type UserRole = (typeof userRoles)[number];

export const appointmentStatuses = [
  "draft",
  "pending_admin_confirmation",
  "confirmed",
  "completed",
  "canceled",
  "rescheduled",
  "no_show"
] as const;

export type AppointmentStatus = (typeof appointmentStatuses)[number];

export const attendanceConfirmationStatuses = [
  "not_requested",
  "pending",
  "confirmed",
  "declined"
] as const;

export type AttendanceConfirmationStatus =
  (typeof attendanceConfirmationStatuses)[number];

export const supportedCurrencies = ["RUB", "EUR", "USD"] as const;

export type SupportedCurrency = (typeof supportedCurrencies)[number];

export const businessConfig = {
  brandName: "Danil Nails Studio",
  timezone: "Europe/Moscow",
  launchCity: "Moscow",
  futureMarket: "Spain",
  defaultLocale: "ru" satisfies SupportedLocale
} as const;

export const bookingRules = {
  bookingHorizonDays: 60,
  minimumLeadTimeMinutes: 120,
  slotIntervalMinutes: 30,
  lateCancellationWindowHours: 12,
  requirePrepaymentAfterNoShow: true,
  requirePrepaymentAfterLateCancellation: true,
  clientReminderMinutesBeforeAppointment: 60,
  adminTomorrowReminderTime: "12:00",
  scheduleReminderDaysBeforeMonth: 11,
  scheduleReminderTime: "10:00"
} as const;

export const initialServices = [
  {
    slug: "manicure-without-gel",
    name: {
      ru: "Маникюр без покрытия",
      en: "Manicure without polish",
      es: "Manicura sin esmalte"
    },
    defaultDurationMinutes: 60,
    prices: [
      { currency: "RUB", amountMinor: 100 },
      { currency: "EUR", amountMinor: 100 },
      { currency: "USD", amountMinor: 100 }
    ]
  },
  {
    slug: "manicure-with-gel",
    name: {
      ru: "Маникюр с покрытием",
      en: "Manicure with gel polish",
      es: "Manicura con esmalte semipermanente"
    },
    defaultDurationMinutes: 120,
    prices: [
      { currency: "RUB", amountMinor: 200 },
      { currency: "EUR", amountMinor: 200 },
      { currency: "USD", amountMinor: 200 }
    ]
  },
  {
    slug: "japanese-manicure",
    name: {
      ru: "Японский маникюр",
      en: "Japanese manicure",
      es: "Manicura japonesa"
    },
    defaultDurationMinutes: 75,
    prices: [
      { currency: "RUB", amountMinor: 300 },
      { currency: "EUR", amountMinor: 300 },
      { currency: "USD", amountMinor: 300 }
    ]
  }
] as const;
