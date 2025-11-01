import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await sb.rpc("get_similar_species", { tid: id, limit_n: 8 });
  if (error) return NextResponse.json([], { status: 500 });
  // add thumbnails
  const ids = (data || []).map((x: any) => x.id);
  if (!ids.length) return NextResponse.json([]);
  const { data: pics } = await sb.from("media").select("taxon_id, url, thumb_url").in("taxon_id", ids).eq("kind", "image").eq("approved", true);
  const firstPic = new Map<number, string>();
  for (const p of pics || []) if (!firstPic.has(p.taxon_id)) firstPic.set(p.taxon_id, p.thumb_url || p.url);
  const enriched = (data || []).map((x: any) => ({ ...x, thumb: firstPic.get(x.id) || null }));
  return NextResponse.json(enriched);
}
