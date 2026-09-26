import { notFound } from "next/navigation";
import { Reveal } from "../../components/Reveal";
import { AccountView } from "../../components/AccountView";
import { getDictionary } from "../../i18n/get-dictionary";
import { isLocale } from "../../i18n/locales";

export default async function AccountPage({ params }: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <main>
      <section className="section section-first">
        <div className="wrap">
          <Reveal>
            <p className="section-kicker">{dict.account.kicker}</p>
            <h1 className="section-heading">{dict.account.heading}</h1>
          </Reveal>

          <Reveal delay={100}>
            <AccountView dict={dict.account} lang={lang} />
          </Reveal>
        </div>
      </section>
    </main>
  );
}
