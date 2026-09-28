import { notFound } from "next/navigation";
import { MasterSection } from "../../components/MasterSection";
import { getDictionary } from "../../i18n/get-dictionary";
import { isLocale } from "../../i18n/locales";

export default async function MasterPage({ params }: PageProps<"/[lang]/master">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <main>
      <MasterSection lang={lang} master={dict.master} teamHeading={dict.team.heading} />
    </main>
  );
}
