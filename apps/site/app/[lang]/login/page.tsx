import { notFound } from "next/navigation";
import { Reveal } from "../../components/Reveal";
import { LoginForm } from "../../components/LoginForm";
import { getDictionary } from "../../i18n/get-dictionary";
import { isLocale } from "../../i18n/locales";

export default async function LoginPage({ params }: PageProps<"/[lang]/login">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <main>
      <section className="section section-first">
        <div className="wrap">
          <Reveal>
            <p className="section-kicker">{dict.login.kicker}</p>
            <h1 className="section-heading">
              {dict.login.headingPre}
              <em>{dict.login.headingEm}</em>
            </h1>
            <p className="section-lede">{dict.login.lede}</p>
          </Reveal>

          <Reveal delay={100}>
            <LoginForm dict={dict.login} lang={lang} />
          </Reveal>
        </div>
      </section>
    </main>
  );
}
