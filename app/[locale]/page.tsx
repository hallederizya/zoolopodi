import { useTranslations } from "next-intl";
import SearchBox from "@/app/components/SearchBox";

export default function Home() {
  const t = useTranslations();
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">{t("site.title")}</h1>
      <SearchBox placeholderKey="search.placeholder" />
    </main>
  );
}
