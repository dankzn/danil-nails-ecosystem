import { notFound } from "next/navigation";
import { Reveal } from "../../components/Reveal";
import { getDictionary } from "../../i18n/get-dictionary";
import { isLocale } from "../../i18n/locales";

export default async function ContactPage({ params }: PageProps<"/[lang]/contact">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <main className="inner-page">
      <section className="section section-first">
        <div className="wrap">
          <Reveal>
            <div className="contact-panel">
              <p className="section-kicker" style={{ justifyContent: "center" }}>
                {dict.contact.kicker}
              </p>
              <h1 className="contact-heading">
                {dict.contact.headingPre}
                <em>{dict.contact.headingEm}</em>
              </h1>
              <p className="contact-lede">{dict.contact.lede}</p>
              <div className="contact-actions">
                <span className="contact-soon">{dict.contact.soon}</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
