import type { Dictionary } from "../i18n/dictionary";
import type { Locale } from "../i18n/locales";
import { LocaleSwitcher } from "./LocaleSwitcher";

export function SiteFooter({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const navLinks = [
    { href: `/${lang}/`, label: dict.nav.home },
    { href: `/${lang}/services/`, label: dict.nav.services },
    { href: `/${lang}/gallery/`, label: dict.nav.gallery },
    { href: `/${lang}/master/`, label: dict.nav.master },
    { href: `/${lang}/contact/`, label: dict.nav.contact }
  ];

  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-grid">
          <div className="footer-col footer-col-brand">
            <span className="footer-brand">Danil Nails Studio</span>
            <p className="footer-tagline">{dict.footer.tagline}</p>
          </div>

          <div className="footer-col">
            <span className="footer-col-label">{dict.footer.navLabel}</span>
            <ul className="footer-links">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-col">
            <span className="footer-col-label">{dict.footer.studioLabel}</span>
            <p className="footer-note">{dict.footer.studioCity}</p>
            <p className="footer-note footer-note-faint">{dict.footer.studioNote}</p>
          </div>

          <div className="footer-col">
            <span className="footer-col-label">{dict.footer.languageLabel}</span>
            <LocaleSwitcher current={lang} />
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} {dict.footer.rights}
          </span>
          <a href="#">{dict.footer.toTop}</a>
        </div>
      </div>
    </footer>
  );
}
