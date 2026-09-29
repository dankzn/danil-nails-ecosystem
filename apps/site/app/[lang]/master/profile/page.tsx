import { notFound } from "next/navigation";
import { MasterProfileView } from "../../../components/MasterProfileView";
import { getDictionary } from "../../../i18n/get-dictionary";
import { isLocale } from "../../../i18n/locales";

export default async function MasterProfilePage({
  params
}: PageProps<"/[lang]/master/profile">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <main>
      <MasterProfileView dict={dict} lang={lang} />
    </main>
  );
}
