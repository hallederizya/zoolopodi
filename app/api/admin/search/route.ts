import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json([]);

  const { data, error } = await supabase
    .from("taxon_name")
    .select("taxon_id, name, is_scientific, taxon:taxon_id(id, canonical_name)")
    .ilike("name", `%${q}%`)
    .limit(20);

  if (error) return NextResponse.json([], { status: 500 });

  const uniq = new Map<number, any>();
  for (const r of data || []) {
    const taxon = Array.isArray(r.taxon) ? r.taxon[0] : r.taxon;
    if (taxon) {
      uniq.set(r.taxon_id, { id: r.taxon_id, canonical: taxon.canonical_name });
    }
  }
  return NextResponse.json(Array.from(uniq.values()));
}
