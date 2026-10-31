import type { Locale } from "./locales";

// Each language's own name, in its own script — shown in the language
// picker regardless of the site's current UI locale (the same convention
// most language switchers use, so a visitor can always recognize their own
// language even if the page around it is in a different one).
export const languageNames: Record<Locale, string> = {
  ru: "Русский",
  en: "English",
  es: "Español",
  fr: "Français"
};
