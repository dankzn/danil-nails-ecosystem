"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "../i18n/dictionary";
import type { Locale } from "../i18n/locales";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { MagneticButton } from "./MagneticButton";

export function SiteHeader({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.scrollY > 24);
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
    <header className={`site-header${isScrolled ? " site-header-scrolled" : ""}`}>
      <a className="site-brand" href={`/${lang}/`}>
        <span className="site-brand-mark">DN</span>
        <span className="site-brand-copy">
          Danil Nails
          <em>Studio</em>
        </span>
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
        <MagneticButton className="site-header-cta" href={`/${lang}/contact/`}>
          {dict.nav.cta}
        </MagneticButton>
      </div>
    </header>
  );
}
