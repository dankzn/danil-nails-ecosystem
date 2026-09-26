"use client";

import { usePathname } from "next/navigation";
import { locales, localeNames, type Locale } from "../i18n/locales";

function swapLocale(pathname: string, nextLocale: Locale): string {
  const segments = pathname.split("/").filter(Boolean);
  segments[0] = nextLocale;
  return `/${segments.join("/")}/`;
}

export function LocaleSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname() ?? `/${current}/`;

  return (
    <div className="locale-switcher" aria-label="Language">
      {locales.map((locale) => (
        <a
          key={locale}
          href={swapLocale(pathname, locale)}
          className={`locale-switcher-item${locale === current ? " locale-switcher-item-active" : ""}`}
          aria-current={locale === current ? "true" : undefined}
          title={localeNames[locale]}
        >
          {locale.toUpperCase()}
        </a>
      ))}
    </div>
  );
}
