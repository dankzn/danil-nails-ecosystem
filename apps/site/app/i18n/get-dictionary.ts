import type { Dictionary } from "./dictionary";
import type { Locale } from "./locales";
import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";
import { fr } from "./dictionaries/fr";
import { ru } from "./dictionaries/ru";

const dictionaries: Record<Locale, Dictionary> = { ru, en, es, fr };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
