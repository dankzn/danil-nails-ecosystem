export const locales = ["ru", "en", "es", "fr"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ru";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

export const localeNames: Record<Locale, string> = {
  ru: "Русский",
  en: "English",
  es: "Español",
  fr: "Français"
};
