import { notFound } from "next/navigation";
import { Reveal } from "../../components/Reveal";
import { RegisterForm } from "../../components/RegisterForm";
import { getDictionary } from "../../i18n/get-dictionary";
import { isLocale } from "../../i18n/locales";

export default async function RegisterPage({ params }: PageProps<"/[lang]/register">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <main>
      <section className="section section-first">
        <div className="wrap">
          <Reveal>
            <p className="section-kicker">{dict.register.kicker}</p>
            <h1 className="section-heading">
              {dict.register.headingPre}
              <em>{dict.register.headingEm}</em>
            </h1>
            <p className="section-lede">{dict.register.lede}</p>
          </Reveal>

          <Reveal delay={100}>
            <RegisterForm dict={dict.register} />
          </Reveal>
        </div>
      </section>
    </main>
  );
}
