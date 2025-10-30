import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logToSupabase } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rateLimit";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Basit rate limit (IP başına) için header tabanlı “soft” önlem:
const MAX_Q_LEN = 64;

export async function GET(req: Request) {
  try {
  // Rate limit: IP başına 20 istek/dakika (basit; prod için Vercel KV + Upstash önerilir)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  const rateCheck = checkRateLimit(ip, 20, 60_000);
  if (!rateCheck.allowed) {
    logToSupabase("warn", "/api/search: rate limit exceeded", { ip });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  let q = (searchParams.get("q") || "").trim();

  if (!q) return NextResponse.json([]);
  if (q.length > MAX_Q_LEN) q = q.slice(0, MAX_Q_LEN);

  // Önce ortak adlarda, sonra bilimsel adda arayalım
  // taxon_name.name ve taxon.canonical_name üzerinde trigram index var
  // Historically we attempted a single .or() with a nested relation filter
  // but PostgREST parsing can be fragile for joined field syntax. To be
  // robust, run two queries: (A) taxon_name.name ilike, (B) taxon.canonical_name ilike
  // then merge unique taxon_ids preserving the taxon_name row when present.
  const limit = 12;
  const { data: nameRows, error: nameErr } = await supabase
    .from("taxon_name")
    .select("taxon_id, name, lang, is_scientific, taxon:taxon_id(id, canonical_name, rank)")
    .ilike("name", `%${q}%`)
    .limit(limit);

  if (nameErr) {
    console.error("/api/search: supabase taxon_name query error:", nameErr);
    logToSupabase("error", "/api/search: taxon_name query failed", { error: nameErr, q });
    const safe = NextResponse.json([]);
    safe.headers.set("Cache-Control", "s-maxage=60, max-age=0");
    return safe;
  }

  const rows: any[] = Array.isArray(nameRows) ? [...nameRows] : [];

  if (rows.length < limit) {
    // fetch canonical names from taxon table to fill remaining slots
    const remaining = limit - rows.length;
    const { data: taxaRows, error: taxaErr } = await supabase
      .from("taxon")
      .select("id, canonical_name, rank")
      .ilike("canonical_name", `%${q}%`)
      .limit(remaining);

    if (taxaErr) {
      console.error("/api/search: supabase taxon canonical query error:", taxaErr);
      logToSupabase("error", "/api/search: taxon canonical query failed", { error: taxaErr, q });
      // continue with whatever we have from nameRows
    } else if (Array.isArray(taxaRows)) {
      for (const t of taxaRows) {
        rows.push({
          taxon_id: t.id,
          name: t.canonical_name,
          lang: null,
          is_scientific: true,
          taxon: { id: t.id, canonical_name: t.canonical_name, rank: t.rank },
        });
      }
    }
  }

  // Unique by taxon
  const map = new Map<number, { id: number; canonical: string; rank: string; display: string }>();
  for (const r of rows || []) {
    const taxonObj = Array.isArray(r.taxon) ? r.taxon[0] : r.taxon;
    map.set(r.taxon_id, {
      id: r.taxon_id,
      canonical: taxonObj?.canonical_name,
      rank: taxonObj?.rank,
      display: r.is_scientific ? `${r.name} (${taxonObj?.rank})` : `${r.name} – ${taxonObj?.canonical_name}`,
    });
  }

  const ids = Array.from(map.keys());
  if (!ids.length) {
    const res = NextResponse.json([]);
    res.headers.set("Cache-Control", "s-maxage=3600, stale-while-revalidate=3600, max-age=0");
    return res;
  }

  // İlk görseli alın (tek sorgu)
  const { data: pics, error: picsErr } = await supabase
    .from("media")
    .select("taxon_id, url, thumb_url")
    .in("taxon_id", ids)
    .eq("kind", "image");

  if (picsErr) {
    // Log and continue with no images rather than failing the whole request.
    console.error("/api/search: supabase media query error:", picsErr);
    logToSupabase("warn", "/api/search: media query failed", { error: picsErr, ids });
  }

  const firstPicByTaxon = new Map<number, { url?: string; thumb_url?: string }>();
  for (const p of pics || []) {
    if (!firstPicByTaxon.has(p.taxon_id)) {
      firstPicByTaxon.set(p.taxon_id, { url: p.url, thumb_url: p.thumb_url });
    }
  }

  const results = ids.map(id => ({
    ...map.get(id)!,
    thumb: firstPicByTaxon.get(id)?.thumb_url || firstPicByTaxon.get(id)?.url || null,
  }));

  const res = NextResponse.json(results);
  res.headers.set("Cache-Control", "s-maxage=3600, stale-while-revalidate=3600, max-age=0");
  return res;
  } catch (err) {
    // Catch-all to avoid unhandled exceptions returning empty 500 responses with no details.
    console.error("/api/search: unexpected error:", err);
    logToSupabase("error", "/api/search: unexpected error", { error: String(err) });
    const out = NextResponse.json([]);
    out.headers.set("Cache-Control", "s-maxage=60, max-age=0");
    return out;
  }
}
