import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CursorGlow } from "../components/CursorGlow";
import { SetHtmlLang } from "../components/SetHtmlLang";
import { SiteHeader } from "../components/SiteHeader";
import { getDictionary } from "../i18n/get-dictionary";
import { isLocale, locales } from "../i18n/locales";

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = getDictionary(lang);
  return {
    title: dict.meta.title,
    description: dict.meta.description
  };
}

export default async function LangLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <>
      <SetHtmlLang lang={lang} />
      <CursorGlow />
      <SiteHeader lang={lang} dict={dict} />
      {children}
      <footer className="site-footer">
        <span>
          © {new Date().getFullYear()} {dict.footer.rights}
        </span>
        <a href={`/${lang}/`}>{dict.footer.toTop}</a>
      </footer>
    </>
  );
}
