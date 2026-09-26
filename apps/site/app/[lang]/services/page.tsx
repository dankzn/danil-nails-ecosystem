import { notFound } from "next/navigation";
import { Reveal } from "../../components/Reveal";
import { getDictionary } from "../../i18n/get-dictionary";
import { isLocale } from "../../i18n/locales";

export default async function ServicesPage({ params }: PageProps<"/[lang]/services">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <main>
      <section className="section section-first">
        <div className="wrap">
          <Reveal>
            <p className="section-kicker">{dict.services.kicker}</p>
            <h1 className="section-heading">
              {dict.services.headingPre}
              <em>{dict.services.headingEm}</em>
            </h1>
            <p className="section-lede">{dict.services.lede}</p>
          </Reveal>

          <div className="services-list">
            {dict.services.items.map((service, index) => (
              <Reveal delay={index * 70} key={service.title}>
                <div className="service-row">
                  <span className="service-index">0{index + 1}</span>
                  <div>
                    <div className="service-name">{service.title}</div>
                    <div className="service-meta">
                      <span>{service.duration}</span>
                      <span>&middot;</span>
                      <span>{service.note}</span>
                    </div>
                  </div>
                  <span className="service-price">{dict.services.priceLabel}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
