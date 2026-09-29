"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { locales, localeNames, type Locale } from "../i18n/locales";

function swapLocale(pathname: string, search: string, nextLocale: Locale): string {
  const segments = pathname.split("/").filter(Boolean);
  segments[0] = nextLocale;
  return `/${segments.join("/")}/${search}`;
}

// Query params (e.g. ?id=... on a master profile, ?staff=... on the
// booking form) live only in the browser's location, not in `usePathname`,
// so read them directly rather than pulling in `useSearchParams` — the
// same trade-off this codebase already makes in BookingForm, avoiding
// that hook's Suspense-boundary requirement under `output: "export"`.
function useSearchString() {
  const [search, setSearch] = useState("");
  useEffect(() => {
    setSearch(window.location.search);
  }, []);
  return search;
}

export function LocaleSwitcher({
  current,
  variant = "inline"
}: {
  current: Locale;
  variant?: "inline" | "compact";
}) {
  const pathname = usePathname() ?? `/${current}/`;
  const search = useSearchString();

  if (variant === "compact") {
    return <CompactLocaleSwitcher current={current} pathname={pathname} search={search} />;
  }

  return (
    <div className="locale-switcher" aria-label="Language">
      {locales.map((locale) => (
        <a
          key={locale}
          href={swapLocale(pathname, search, locale)}
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
  pathname,
  search
}: {
  current: Locale;
  pathname: string;
  search: string;
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
                href={swapLocale(pathname, search, locale)}
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
