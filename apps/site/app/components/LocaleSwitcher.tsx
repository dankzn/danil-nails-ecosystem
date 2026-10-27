"use client";

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { usePathname } from "next/navigation";
import { locales, localeNames, type Locale } from "../i18n/locales";

function swapLocale(pathname: string, search: string, nextLocale: Locale): string {
  const segments = pathname.split("/").filter(Boolean);
  segments[0] = nextLocale;
  return `/${segments.join("/")}/${search}`;
}

// Best-effort href for the initial render/no-JS case. The real navigation
// happens in handleLocaleClick below, computed fresh from the live
// window.location at click time — not from this pre-rendered value, and
// not from React state set in an effect — because on the deployed static
// export, relying on hydration-timed state here was still dropping the
// query string (?id=... on a master profile) on click in production, even
// though it worked in every local/incognito repro. Reading location
// directly inside the click handler sidesteps whatever hydration/caching
// timing caused that and is the one thing guaranteed to see the real,
// current URL.
function useSearchString() {
  const [search, setSearch] = useState("");
  useEffect(() => {
    setSearch(window.location.search);
  }, []);
  return search;
}

function handleLocaleClick(event: ReactMouseEvent<HTMLAnchorElement>, nextLocale: Locale) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
    return; // let the browser handle "open in new tab" etc. via the href
  }
  event.preventDefault();
  window.location.href = swapLocale(
    window.location.pathname,
    window.location.search,
    nextLocale
  );
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
          onClick={(event) => handleLocaleClick(event, locale)}
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
                onClick={(event) => {
                  setIsOpen(false);
                  handleLocaleClick(event, locale);
                }}
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
