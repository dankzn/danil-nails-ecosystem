import { notFound } from "next/navigation";
import { Reveal } from "../../components/Reveal";
import { getDictionary } from "../../i18n/get-dictionary";
import { isLocale } from "../../i18n/locales";

const swatches = ["#a3401f", "#ece2d0", "#3a352c", "#8a6a3a", "#5c2418", "#c9ad84"];

export default async function GalleryPage({ params }: PageProps<"/[lang]/gallery">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <main>
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
              <Reveal delay={index * 60} key={swatch.label}>
                <div className="gallery-tile">
                  <div
                    className="gallery-swatch"
                    style={{ background: swatches[index % swatches.length] }}
                  />
                  <span className="gallery-tile-label">{swatch.label}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
