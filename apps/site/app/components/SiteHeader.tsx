"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "../i18n/dictionary";
import type { Locale } from "../i18n/locales";
import { Button } from "./Button";
import { LocaleSwitcher } from "./LocaleSwitcher";

export function SiteHeader({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const [isFixed, setIsFixed] = useState(false);

  useEffect(() => {
    function onScroll() {
      setIsFixed(window.scrollY > 40);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: `/${lang}/services/`, label: dict.nav.services },
    { href: `/${lang}/gallery/`, label: dict.nav.gallery },
    { href: `/${lang}/master/`, label: dict.nav.master },
    { href: `/${lang}/contact/`, label: dict.nav.contact }
  ];

  return (
    <>
      <header className={`site-header${isFixed ? " site-header-fixed" : ""}`}>
        <a className="site-brand" href={`/${lang}/`}>
          <span className="site-brand-mark">Danil Nails</span>
          <span className="site-brand-copy">Studio</span>
        </a>
        <nav className="site-nav" aria-label="Site sections">
          {links.map((link) => (
            <a href={link.href} key={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="site-header-actions">
          <LocaleSwitcher current={lang} />
          <Button className="header-cta" href={`/${lang}/contact/`}>
            {dict.nav.cta}
          </Button>
        </div>
      </header>
      {isFixed ? <div aria-hidden="true" style={{ height: 82 }} /> : null}
    </>
  );
}
