import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { HeroBlob } from "../components/HeroBlob";
import { MagneticButton } from "../components/MagneticButton";
import { Marquee } from "../components/Marquee";
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
      <section className="hero">
        <HeroBlob />

        <div className="wrap hero-content">
          <Reveal>
            <span className="hero-eyebrow">
              <span className="dot" />
              {dict.hero.eyebrow}
            </span>
          </Reveal>

          <h1 className="hero-title">
            {dict.hero.titleLines.map((line, index) => (
              <span className="line" key={line}>
                <span style={riseDelay(index * 90)}>{index === 1 ? <em>{line}</em> : line}</span>
              </span>
            ))}
          </h1>

          <Reveal delay={200}>
            <p className="hero-lede">{dict.hero.lede}</p>
          </Reveal>

          <Reveal delay={320}>
            <div className="hero-actions">
              <MagneticButton href={`/${lang}/contact/`}>{dict.hero.ctaPrimary}</MagneticButton>
              <MagneticButton className="magnetic-button-outline" href={`/${lang}/services/`}>
                {dict.hero.ctaSecondary}
              </MagneticButton>
            </div>
          </Reveal>

          <Reveal delay={420}>
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

        <div className="hero-scroll-cue">
          <span className="line" />
          {dict.hero.scrollCue}
        </div>
      </section>

      <Marquee items={dict.marquee} />

      <section className="section">
        <div className="wrap">
          <Reveal>
            <p className="section-kicker">{dict.philosophy.kicker}</p>
            <h2 className="section-heading">
              {dict.philosophy.headingPre}
              <em>{dict.philosophy.headingEm}</em>
            </h2>
          </Reveal>
          <div className="philosophy-grid">
            {dict.philosophy.items.map((item, index) => (
              <Reveal as="div" delay={index * 80} key={item.index}>
                <div className="philosophy-card">
                  <div className="philosophy-index">{item.index}</div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-paper">
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
              <Reveal as="div" delay={index * 70} key={service.title}>
                <div className="service-row">
                  <span className="service-index">0{index + 1}</span>
                  <div>
                    <div className="service-name">{service.title}</div>
                    <div className="service-meta">
                      <span>{service.duration}</span>
                      <span>·</span>
                      <span>{service.note}</span>
                    </div>
                  </div>
                  <span className="service-price">{dict.services.priceLabel}</span>
                  <span className="service-arrow">→</span>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={100}>
            <div className="home-cta-row">
              <MagneticButton className="magnetic-button-outline" href={`/${lang}/services/`}>
                {dict.home.servicesCta}
              </MagneticButton>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <Reveal>
            <div className="contact-panel">
              <p className="section-kicker" style={{ justifyContent: "center" }}>
                {dict.home.contactKicker}
              </p>
              <h2 className="contact-heading">
                {dict.home.contactHeadingPre}
                <em>{dict.home.contactHeadingEm}</em>
              </h2>
              <p className="contact-lede">{dict.home.contactLede}</p>
              <div className="contact-actions">
                <MagneticButton href={`/${lang}/contact/`}>{dict.home.contactCta}</MagneticButton>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
