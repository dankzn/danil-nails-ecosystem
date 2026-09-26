import { notFound } from "next/navigation";
import { Reveal } from "../../components/Reveal";
import { getDictionary } from "../../i18n/get-dictionary";
import { isLocale } from "../../i18n/locales";

export default async function MasterPage({ params }: PageProps<"/[lang]/master">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <main>
      <section className="section section-first">
        <div className="wrap">
          <Reveal>
            <p className="section-kicker">{dict.master.kicker}</p>
            <h1 className="section-heading">
              {dict.master.headingPre}
              <em>{dict.master.headingEm}</em>
            </h1>
          </Reveal>

          <div className="master-block">
            <Reveal>
              <div className="master-portrait">
                <span>ДА</span>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div>
                <h2 className="master-name">{dict.master.name}</h2>
                <p className="master-role">{dict.master.role}</p>
                <p className="master-bio">{dict.master.bio}</p>
                <div className="master-facts">
                  {dict.master.facts.map((fact) => (
                    <div key={fact.label}>
                      <strong>{fact.value}</strong>
                      <span>{fact.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </main>
  );
}
