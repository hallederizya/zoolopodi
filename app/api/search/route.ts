import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const MAX_Q_LEN = 64;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  let q = (searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json([]);
  if (q.length > MAX_Q_LEN) q = q.slice(0, MAX_Q_LEN);

  const { data, error } = await sb.rpc("search_taxa", { q, limit_n: 12 });
  if (error) return NextResponse.json([], { status: 500 });

  const ids = (data || []).map((x: any) => x.taxon_id);
    // 3) Her takson için thumbnail (media tablosundan)
  const { data: pics } = await sb.from("media").select("taxon_id, url, thumb_url").in("taxon_id", ids).eq("kind", "image").eq("approved", true);
  const firstPic = new Map<number, string>();
  for (const p of pics || []) if (!firstPic.has(p.taxon_id)) firstPic.set(p.taxon_id, p.thumb_url || p.url);

  const results = (data || []).map((x: any) => ({
    id: x.taxon_id,
    display: x.display ?? x.canonical,
    canonical: x.canonical,
    rank: x.rank,
    score: x.score,
    thumb: firstPic.get(x.taxon_id) || null,
  }));

  const res = NextResponse.json(results);
  res.headers.set("Cache-Control", "s-maxage=3600, stale-while-revalidate=3600, max-age=0");
  return res;
}
