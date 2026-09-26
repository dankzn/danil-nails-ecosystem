import type { CSSProperties } from "react";
import { CursorGlow } from "./components/CursorGlow";
import { MagneticButton } from "./components/MagneticButton";
import { Marquee } from "./components/Marquee";
import { Reveal } from "./components/Reveal";
import { SiteHeader } from "./components/SiteHeader";

function riseDelay(ms: number): CSSProperties {
  return { "--rise-delay": `${ms}ms` } as CSSProperties;
}

const services = [
  {
    title: "Маникюр без покрытия",
    duration: "60 мин",
    note: "Форма, кутикула, уход"
  },
  {
    title: "Маникюр с покрытием",
    duration: "120 мин",
    note: "Гель-лак, точный цвет"
  },
  {
    title: "Японский маникюр",
    duration: "75 мин",
    note: "Полировка и укрепление"
  }
];

const gallerySwatches = [
  { label: "Тёплый гранат", gradient: "linear-gradient(160deg, #d1466c, #5c1830)" },
  { label: "Молочный фарфор", gradient: "linear-gradient(160deg, #f2ece6, #cbb9ad)" },
  { label: "Глубокий графит", gradient: "linear-gradient(160deg, #3a353c, #0b0a0d)" },
  { label: "Шампань", gradient: "linear-gradient(160deg, #e7cf9e, #a9824c)" },
  { label: "Винный бархат", gradient: "linear-gradient(160deg, #7a1f3a, #26060f)" },
  { label: "Тёплый песок", gradient: "linear-gradient(160deg, #d8c3a5, #8f7657)" }
];

const philosophy = [
  {
    index: "01",
    title: "Один мастер",
    body: "Ни конвейера, ни очереди администраторов между вами и мастером — вы работаете напрямую с тем, кто делает маникюр."
  },
  {
    index: "02",
    title: "Ручная модерация записи",
    body: "Каждая запись подтверждается лично, а не автоматически — так мы держим расписание без накладок и лишней спешки."
  },
  {
    index: "03",
    title: "Стерильный протокол",
    body: "Инструмент обрабатывается между каждым клиентом по стандартному протоколу студии — это база, а не опция."
  }
];

export default function Home() {
  return (
    <>
      <CursorGlow />
      <SiteHeader bookingHref="#contact" />

      <main id="top">
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <Reveal>
                <span className="hero-eyebrow">
                  <span className="dot" />
                  Москва · приватная студия
                </span>
              </Reveal>

              <h1 className="hero-title">
                <span className="line">
                  <span style={riseDelay(0)}>Точность,</span>
                </span>
                <span className="line">
                  <span style={riseDelay(90)}>
                    которую <em>видно</em>
                  </span>
                </span>
                <span className="line">
                  <span style={riseDelay(180)}>на кончиках пальцев</span>
                </span>
              </h1>

              <Reveal delay={200}>
                <p className="hero-lede">
                  Danil Nails Studio — камерная студия маникюра в Москве. Один мастер,
                  внимание к деталям и расписание без спешки: на каждого клиента отведено
                  ровно столько времени, сколько нужно, чтобы сделать безупречно.
                </p>
              </Reveal>

              <Reveal delay={320}>
                <div className="hero-actions">
                  <MagneticButton href="#contact">Записаться</MagneticButton>
                  <MagneticButton className="magnetic-button-outline" href="#services">
                    Смотреть услуги
                  </MagneticButton>
                </div>
              </Reveal>

              <Reveal delay={420}>
                <div className="hero-meta">
                  <div>
                    <strong>1</strong>
                    <span>Мастер на смену</span>
                  </div>
                  <div>
                    <strong>60–120</strong>
                    <span>Минут на услугу</span>
                  </div>
                  <div>
                    <strong>100%</strong>
                    <span>Записей — с подтверждением</span>
                  </div>
                </div>
              </Reveal>
            </div>

            <div className="hero-visual" aria-hidden="true">
              <div className="polish-ring" />
              <div className="polish-blob" />
            </div>
          </div>

          <div className="hero-scroll-cue">
            <span className="line" />
            Листайте
          </div>
        </section>

        <Marquee
          items={[
            "Маникюр",
            "Покрытие гель-лаком",
            "Японский маникюр",
            "Стерильность",
            "Запись по подтверждению"
          ]}
        />

        <section className="section">
          <div className="wrap">
            <Reveal>
              <p className="section-kicker">Подход</p>
              <h2 className="section-heading">
                Три вещи, на которых <em>всё держится</em>
              </h2>
            </Reveal>
            <div className="philosophy-grid">
              {philosophy.map((item, index) => (
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

        <section className="section section-paper" id="services">
          <div className="wrap">
            <Reveal>
              <p className="section-kicker">Услуги</p>
              <h2 className="section-heading">
                Три формата, <em>без лишнего</em>
              </h2>
              <p className="section-lede">
                Стоимость уточняется на этапе записи — мы обновим прайс здесь, как только
                утвердим окончательный.
              </p>
            </Reveal>

            <div className="services-list">
              {services.map((service, index) => (
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
                    <span className="service-price">По записи</span>
                    <span className="service-arrow">→</span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="gallery">
          <div className="wrap">
            <Reveal>
              <p className="section-kicker">Работы</p>
              <h2 className="section-heading">
                Палитра, <em>которую мы любим</em>
              </h2>
              <p className="section-lede">
                Фотографии работ появятся здесь по мере съёмки. Пока — оттенки, с которыми
                чаще всего работает студия.
              </p>
            </Reveal>

            <div className="gallery-grid">
              {gallerySwatches.map((swatch, index) => (
                <Reveal as="div" delay={index * 60} key={swatch.label}>
                  <div className="gallery-tile" style={{ background: swatch.gradient }}>
                    <div className="gallery-tile-surface">
                      <span className="gallery-tile-label">{swatch.label}</span>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-paper" id="master">
          <div className="wrap">
            <Reveal>
              <p className="section-kicker">Мастер</p>
              <h2 className="section-heading">
                Один человек, <em>полная ответственность</em>
              </h2>
            </Reveal>

            <div className="master-block">
              <Reveal>
                <div className="master-portrait">
                  <span>ДА</span>
                </div>
              </Reveal>
              <Reveal delay={100}>
                <div>
                  <h3 className="master-name">Данил Афлиатов</h3>
                  <p className="master-role">Основатель и мастер маникюра</p>
                  <p className="master-bio">
                    Ведёт студию с самого запуска: сам принимает клиентов, сам следит за
                    расписанием и сам отвечает за качество каждой работы. По мере роста
                    студии здесь появятся другие мастера — пока вся ответственность
                    держится на одном имени.
                  </p>
                  <div className="master-facts">
                    <div>
                      <strong>Москва</strong>
                      <span>город работы</span>
                    </div>
                    <div>
                      <strong>3</strong>
                      <span>формата услуг</span>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section className="section" id="contact">
          <div className="wrap">
            <Reveal>
              <div className="contact-panel">
                <p className="section-kicker" style={{ justifyContent: "center" }}>
                  Запись
                </p>
                <h2 className="contact-heading">
                  Начнём с <em>сообщения</em>
                </h2>
                <p className="contact-lede">
                  Онлайн-запись и Telegram-бот подключаются следующим шагом — контакты
                  студии появятся здесь сразу после запуска.
                </p>
                <div className="contact-actions">
                  <span className="contact-soon">Форма записи — скоро</span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} Danil Nails Studio, Москва</span>
        <a href="#top">Наверх ↑</a>
      </footer>
    </>
  );
}
