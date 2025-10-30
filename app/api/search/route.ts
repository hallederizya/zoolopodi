import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Basit rate limit (IP başına) için header tabanlı “soft” önlem:
const MAX_Q_LEN = 64;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  let q = (searchParams.get("q") || "").trim();

  if (!q) return NextResponse.json([]);
  if (q.length > MAX_Q_LEN) q = q.slice(0, MAX_Q_LEN);

  // Önce ortak adlarda, sonra bilimsel adda arayalım
  // taxon_name.name ve taxon.canonical_name üzerinde trigram index var
  const { data, error } = await supabase
    .from("taxon_name")
    .select("taxon_id, name, lang, is_scientific, taxon:taxon_id(id, canonical_name, rank)")
    .or(`name.ilike.%${q}%,taxon.canonical_name.ilike.%${q}%`)
    .limit(10);

  if (error) return NextResponse.json([], { status: 500 });

  const unique = new Map<number, any>();
  for (const r of data || []) {
    // r.taxon may be returned as an array (when select joins produce arrays) or an object
    const taxonObj = Array.isArray(r.taxon) ? r.taxon[0] : r.taxon;
    unique.set(r.taxon_id, {
      id: r.taxon_id,
      display: r.is_scientific
        ? `${r.name} (${taxonObj?.rank ?? ""})`
        : `${r.name} – ${taxonObj?.canonical_name ?? ""}`,
      canonical: taxonObj?.canonical_name ?? null,
      rank: taxonObj?.rank ?? null,
    });
  }

  // Cache: 1 gün (CDN), kullanıcıda 0 (hep yeni)
  const res = NextResponse.json(Array.from(unique.values()));
  res.headers.set("Cache-Control", "s-maxage=86400, stale-while-revalidate=86400, max-age=0");
  return res;
}
