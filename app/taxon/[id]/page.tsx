// app/taxon/[id]/page.tsx
import { headers } from "next/headers";
import IucnBadge from "@/app/components/IucnBadge";

type TaxonData = {
  taxon: { canonical_name: string; rank: string };
  names: Array<{ name: string; lang: string; is_scientific: boolean }>;
  status: { iucn_category?: string } | null;
  media: Array<{ url: string; title: string; author: string; license: string }>;
};

// DİKKAT: params artık Promise! -> await ile çöz
export default async function TaxonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;            // <-- önemli satır

  // Güvenilir base URL oluştur (dev: http, prod: https)
  const h = headers();
  const host = (await h).get("host");
  const isProd = !!process.env.VERCEL;
  const base = `${isProd ? "https" : "http"}://${host}`;

  const res = await fetch(`${base}/api/taxon/${id}`, { cache: "no-store" });
  if (!res.ok) {
    // isteğe bağlı: hata/404 durumu
    return (
      <main className="p-6">
        <h1 className="text-xl font-semibold">Tür bulunamadı</h1>
        <p>ID: {id}</p>
      </main>
    );
  }

  const data: TaxonData = await res.json();

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">{data.taxon?.canonical_name}</h1>

      <IucnBadge cat={data.status?.iucn_category} />

      <section className="mt-4">
        <h2 className="font-semibold">Adlar</h2>
        <ul className="list-disc ml-6">
          {data.names?.map((n, i) => (
            <li key={i}>
              {n.name} {n.lang !== "und" ? `(${n.lang})` : ""}
            </li>
          ))}
        </ul>
      </section>

      {!!data.media?.length && (
        <section className="mt-4">
          <h2 className="font-semibold mb-2">Görseller</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.media.map((m, i) => (
              <figure key={i}>
                <img
                  src={m.url}
                  alt={m.title || data.taxon.canonical_name}
                  className="w-full h-auto rounded"
                />
                <figcaption className="text-xs mt-1">
                  {m.title || "Görsel"} — {m.author} — {m.license}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
