"use client";

import { useEffect } from "react";
import type { Locale } from "../i18n/locales";

export function SetHtmlLang({ lang }: { lang: Locale }) {
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return null;
}
