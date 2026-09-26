import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { Button } from "../components/Button";
import { HeroCarousel } from "../components/HeroCarousel";
import { Reveal } from "../components/Reveal";
import { getDictionary } from "../i18n/get-dictionary";
import { isLocale } from "../i18n/locales";

function riseDelay(ms: number): CSSProperties {
  return { "--rise-delay": `${ms}ms` } as CSSProperties;
}

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <main id="top">
      <section className="hero hero-video">
        <HeroCarousel sources={["/videos/studio-1.mp4", "/videos/studio-2.mp4"]} />
        <div className="hero-overlay" aria-hidden="true" />
        <div className="wrap hero-video-content">
          <div className="hero-kicker-row">
            <Reveal>
              <span className="hero-eyebrow">
                <span className="dot" />
                {dict.hero.eyebrow}
              </span>
            </Reveal>
            <Reveal delay={80}>
              <span className="hero-folio">N&deg;01 &mdash; Moscow</span>
            </Reveal>
          </div>

          <h1 className="hero-title">
            {dict.hero.titleLines.map((line, index) => (
              <span className="line" key={line}>
                <span style={riseDelay(index * 90)}>{index === 1 ? <em>{line}</em> : line}</span>
              </span>
            ))}
          </h1>

          <div className="hero-rule" />

          <div className="hero-row">
            <Reveal delay={120}>
              <p className="hero-lede">{dict.hero.lede}</p>
              <div className="hero-actions">
                <Button variant="solid" href={`/${lang}/contact/`}>
                  {dict.hero.ctaPrimary}
                </Button>
                <Button href={`/${lang}/services/`}>{dict.hero.ctaSecondary}</Button>
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="hero-meta">
                {dict.hero.meta.map((item) => (
                  <div key={item.label}>
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <div className="index-strip">
        <div className="wrap">
          <div className="index-strip-track">
            {dict.marquee.map((item) => (
              <span className="index-strip-item" key={item}>
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      <section className="section">
        <div className="wrap">
          <Reveal>
            <p className="section-kicker">{dict.philosophy.kicker}</p>
            <h2 className="section-heading">
              {dict.philosophy.headingPre}
              <em>{dict.philosophy.headingEm}</em>
            </h2>
          </Reveal>
          <div className="philosophy-list">
            {dict.philosophy.items.map((item, index) => (
              <Reveal delay={index * 70} key={item.index}>
                <div className="philosophy-row">
                  <div className="philosophy-row-head">
                    <span className="philosophy-index">{item.index}</span>
                    <h3>{item.title}</h3>
                  </div>
                  <p>{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <Reveal>
            <p className="section-kicker">{dict.home.servicesKicker}</p>
            <h2 className="section-heading">
              {dict.home.servicesHeadingPre}
              <em>{dict.home.servicesHeadingEm}</em>
            </h2>
            <p className="section-lede">{dict.home.servicesLede}</p>
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

          <Reveal delay={100}>
            <div className="home-cta-row">
              <Button href={`/${lang}/services/`}>{dict.home.servicesCta}</Button>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section section-dark">
        <div className="wrap">
          <Reveal>
            <div className="contact-panel">
              <p className="section-kicker">{dict.home.contactKicker}</p>
              <h2 className="contact-heading">
                {dict.home.contactHeadingPre}
                <em>{dict.home.contactHeadingEm}</em>
              </h2>
              <p className="contact-lede">{dict.home.contactLede}</p>
              <div className="contact-actions">
                <Button variant="solid" href={`/${lang}/contact/`}>
                  {dict.home.contactCta}
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
