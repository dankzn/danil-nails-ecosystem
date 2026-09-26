import { notFound } from "next/navigation";
import { Reveal } from "../../components/Reveal";
import { getDictionary } from "../../i18n/get-dictionary";
import { isLocale } from "../../i18n/locales";

const gradients = [
  "linear-gradient(160deg, #d1466c, #5c1830)",
  "linear-gradient(160deg, #f2ece6, #cbb9ad)",
  "linear-gradient(160deg, #3a353c, #0b0a0d)",
  "linear-gradient(160deg, #e7cf9e, #a9824c)",
  "linear-gradient(160deg, #7a1f3a, #26060f)",
  "linear-gradient(160deg, #d8c3a5, #8f7657)"
];

export default async function GalleryPage({ params }: PageProps<"/[lang]/gallery">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <main className="inner-page">
      <section className="section section-first">
        <div className="wrap">
          <Reveal>
            <p className="section-kicker">{dict.gallery.kicker}</p>
            <h1 className="section-heading">
              {dict.gallery.headingPre}
              <em>{dict.gallery.headingEm}</em>
            </h1>
            <p className="section-lede">{dict.gallery.lede}</p>
          </Reveal>

          <div className="gallery-grid">
            {dict.gallery.items.map((swatch, index) => (
              <Reveal as="div" delay={index * 60} key={swatch.label}>
                <div className="gallery-tile" style={{ background: gradients[index % gradients.length] }}>
                  <div className="gallery-tile-surface">
                    <span className="gallery-tile-label">{swatch.label}</span>
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
