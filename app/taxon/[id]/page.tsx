// app/taxon/[id]/page.tsx
import { headers } from "next/headers";
import IucnBadge from "@/app/components/IucnBadge";
import StatusBadge from "@/app/components/StatusBadge";
import DistributionMap from "@/app/components/DistributionMap";
import MediaAttribution from "@/app/components/MediaAttribution";
import Image from "next/image";
import { ViewTracker } from "@/app/components/ViewTracker";
import ReferencesBox from "@/app/components/ReferencesBox";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const url = `${base}/taxon/${params.id}`;
  const og = `${base}/taxon/${params.id}/opengraph-image`;
  return {
    title: "Zoolopodi",
    openGraph: { type: "article", url, images: [{ url: og, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [og] }
  };
}

type TaxonData = {
  distribution: any;
  taxon: { canonical_name: string; rank: string };
  names: Array<{ name: string; lang: string; is_scientific: boolean }>;
  status: { iucn_category?: string; population_trend?: string } | null;
  media: Array<{ url: string; title: string; author: string; license: string }>;
  refs?: Array<{ citation?: string; url?: string; source?: string }>;
  descriptions?: Array<{ source?: string; title?: string; content: string; url?: string }>;
};

export const revalidate = 86400; // 1 gün: SSG sayfaları bu sıklıkta yenilenir

export async function generateStaticParams() {
  const list = await (await import("@/lib/popular")).getPopularTaxa(200);
  return list;
}

async function getSimilar(id: number) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const r = await fetch(`${base}/api/taxon/${id}/similar`, { cache: "no-store" });
  return r.json();
}

// DİKKAT: params artık Promise! -> await ile çöz
export default async function TaxonPage({ params }: { params: Promise<{ id: string }> }) {
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
  const similar = await getSimilar(Number(id));

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <ViewTracker taxonId={Number(id)} />
      
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{data.taxon?.canonical_name}</h1>
          {!!data.status?.iucn_category && (
            <div className="mt-2">
              <StatusBadge code={data.status.iucn_category} />
              {data.status.population_trend && (
                <span className="ml-3 text-sm text-gray-600">
                  Popülasyon: {data.status.population_trend}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <section className="mt-4">
        <h2 className="font-semibold mb-2">Adlar</h2>
        <div className="space-y-2">
          {/* Bilimsel adlar üstte kalın */}
          {data.names?.filter((n) => n.is_scientific).map((n, i) => (
            <div key={`sci-${i}`} className="font-bold text-lg">
              {n.name} <span className="text-sm text-gray-600 font-normal italic">(bilimsel)</span>
            </div>
          ))}
          {/* Yerel/ortak adlar altında, daha küçük */}
          <ul className="list-disc ml-6 space-y-1">
            {data.names?.filter((n) => !n.is_scientific).map((n, i) => (
              <li key={`vern-${i}`} className="text-gray-700">
                {n.name} {n.lang && n.lang !== "und" ? `(${n.lang})` : ""}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {!!data.media?.length && (
        <section className="mt-6">
          <h2 className="font-semibold mb-2">Görseller</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {data.media.map((m, i) => (
              <figure key={i}>
                <Image
                  src={m.url}
                  alt={m.title || data.taxon.canonical_name}
                  width={800}
                  height={600}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="w-full h-auto rounded"
                  placeholder="empty"
                />
                <MediaAttribution item={m} />
              </figure>
            ))}
          </div>
        </section>
      )}

      {!!data.descriptions?.length && (
        <section className="mt-6">
          <h2 className="font-semibold mb-2">Açıklama</h2>
          {data.descriptions.map((d, i) => (
            <article key={i} className="prose prose-sm max-w-none mb-4">
              {d.title && <h3 className="mt-0 font-medium">{d.title}</h3>}
              <p className="text-gray-700">{d.content}</p>
              {d.url && (
                <a className="text-blue-600 text-sm" href={d.url} target="_blank" rel="noreferrer">
                  Kaynak: {d.source || 'EOL'}
                </a>
              )}
            </article>
          ))}
        </section>
      )}

      {data.distribution?.geojson && (
        <section className="mt-6">
          <h2 className="font-semibold mb-2">Dağılım (iNaturalist örneklem)</h2>
          <DistributionMap fc={data.distribution.geojson as any} />
        </section>
      )}

      {!!similar?.length && (
        <section className="mt-8">
          <h2 className="font-semibold mb-2">Benzer türler</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {similar.map((s: any) => (
              <a key={s.id} href={`/taxon/${s.id}`} className="border rounded overflow-hidden hover:shadow">
                {s.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.thumb} alt={s.canonical_name} className="w-full h-28 object-cover" />
                ) : (
                  <div className="w-full h-28 bg-gray-100" />
                )}
                <div className="p-2 text-sm">{s.canonical_name}</div>
              </a>
            ))}
          </div>
        </section>
      )}

      <ReferencesBox items={data.refs || []} />
    </main>
  );
}
