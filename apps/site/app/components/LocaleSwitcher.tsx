"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { locales, localeNames, type Locale } from "../i18n/locales";

function swapLocale(pathname: string, nextLocale: Locale): string {
  const segments = pathname.split("/").filter(Boolean);
  segments[0] = nextLocale;
  return `/${segments.join("/")}/`;
}

export function LocaleSwitcher({
  current,
  variant = "inline"
}: {
  current: Locale;
  variant?: "inline" | "compact";
}) {
  const pathname = usePathname() ?? `/${current}/`;

  if (variant === "compact") {
    return <CompactLocaleSwitcher current={current} pathname={pathname} />;
  }

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

function CompactLocaleSwitcher({
  current,
  pathname
}: {
  current: Locale;
  pathname: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div className="locale-dropdown" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="locale-dropdown-trigger"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        {current.toUpperCase()}
        <span aria-hidden="true" className="locale-dropdown-caret">
          ▾
        </span>
      </button>
      {isOpen ? (
        <ul className="locale-dropdown-menu" role="listbox">
          {locales.map((locale) => (
            <li key={locale}>
              <a
                aria-current={locale === current ? "true" : undefined}
                className={`locale-dropdown-item${locale === current ? " locale-dropdown-item-active" : ""}`}
                href={swapLocale(pathname, locale)}
                onClick={() => setIsOpen(false)}
                role="option"
              >
                {localeNames[locale]}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
