"use client";

import { useEffect, useState } from "react";
import { MagneticButton } from "./MagneticButton";

const links = [
  { href: "#services", label: "Услуги" },
  { href: "#gallery", label: "Работы" },
  { href: "#master", label: "Мастер" },
  { href: "#contact", label: "Контакты" }
];

export function SiteHeader({ bookingHref }: { bookingHref: string }) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header${isScrolled ? " site-header-scrolled" : ""}`}>
      <a className="site-brand" href="#top">
        <span className="site-brand-mark">DN</span>
        <span className="site-brand-copy">
          Danil Nails
          <em>Studio</em>
        </span>
      </a>
      <nav className="site-nav" aria-label="Разделы сайта">
        {links.map((link) => (
          <a href={link.href} key={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
      <MagneticButton className="site-header-cta" href={bookingHref}>
        Записаться
      </MagneticButton>
    </header>
  );
}
