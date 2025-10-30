import TaxonomyBreadcrumb from "@/app/components/TaxonomyBreadcrumb";

export const revalidate = 3600;

async function getChildren(id: number) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const r = await fetch(`${base}/api/taxonomy/children/${id}?limit=500`, { cache: "no-store" });
  return r.json();
}

async function getTaxon(id: number) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const r = await fetch(`${base}/api/taxon/${id}`, { cache: "no-store" });
  return r.json();
}

export default async function TaxonomyPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [tx, children] = await Promise.all([getTaxon(id), getChildren(id)]);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold">{tx?.taxon?.canonical_name}</h1>
      <div className="mt-1"><TaxonomyBreadcrumb id={id} /></div>

      <section className="mt-6">
        <h2 className="font-semibold mb-2">Alt taksonlar</h2>
        {!children?.length ? (
          <div className="text-sm text-gray-500">Alt takson bulunamadı.</div>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {children.map((c:any) => (
              <li key={c.id} className="border rounded p-3 hover:shadow">
                <div className="text-sm text-gray-500">{c.rank}</div>
                <a className="text-base font-medium hover:underline" href={`/taxonomy/${c.id}`}>{c.canonical_name}</a>
                <div className="text-xs mt-1">
                  <a className="text-blue-600 hover:underline" href={`/taxon/${c.id}`}>Tür sayfası</a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
