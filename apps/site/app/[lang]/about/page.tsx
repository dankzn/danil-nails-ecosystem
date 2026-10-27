import { notFound } from "next/navigation";
import { Reveal } from "../../components/Reveal";
import { getDictionary } from "../../i18n/get-dictionary";
import { isLocale } from "../../i18n/locales";

export default async function AboutPage({ params }: PageProps<"/[lang]/about">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <main>
      <section className="section section-first">
        <div className="wrap">
          <Reveal>
            <p className="section-kicker">{dict.about.kicker}</p>
            <h1 className="section-heading">
              {dict.about.headingPre}
              <em>{dict.about.headingEm}</em>
            </h1>
            <p className="section-lede">{dict.about.lede}</p>
          </Reveal>

          <div className="philosophy-principles">
            {dict.about.staff.map((member, index) => (
              <Reveal delay={index * 70} key={member.title}>
                <div className="philosophy-principle">
                  <span className="philosophy-principle-index">{member.index}</span>
                  <div className="philosophy-principle-body">
                    <h3>{member.title}</h3>
                    <p>{member.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
