import React from "react";

export default async function TaxonomyBreadcrumb({ id }: { id: number }) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const r = await fetch(`${base}/api/taxonomy/lineage/${id}`, { cache: "no-store" });
  const items: Array<{id:number; canonical_name:string; rank:string; parent_id:number|null}> = await r.json();

  if (!items?.length) return null;
  const ordered = items.reverse(); // kökten → mevcut

  return (
    <nav className="text-sm text-gray-600">
      {ordered.map((x, i) => (
        <span key={x.id}>
          <a className="hover:underline" href={`/taxonomy/${x.id}`}>{x.canonical_name}</a>
          {i < ordered.length - 1 ? " / " : ""}
        </span>
      ))}
    </nav>
  );
}
