import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addCommonsImage, enrichInatDistribution, fetchIucnByName, upsertIucnStatus } from "@/lib/enrich";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const { data: tx } = await supabase.from("taxon").select("id, canonical_name").eq("id", id).single();
  if (!tx) return NextResponse.json({ error: "not found" }, { status: 404 });

  const results: any = { id, name: tx.canonical_name };

  // IUCN
  try {
    const info = await fetchIucnByName(tx.canonical_name);
    if (info) { await upsertIucnStatus(tx.id, info); results.iucn = info.category || null; }
  } catch (e:any) { results.iucn_error = e.message; }

  // Commons
  try {
    const r = await addCommonsImage(tx.id, tx.canonical_name);
    results.commons = r;
  } catch (e:any) { results.commons_error = e.message; }

  // iNat
  try {
    await enrichInatDistribution(tx.id, tx.canonical_name, 3, 1, 1500);
    results.inat = "ok";
  } catch (e:any) { results.inat_error = e.message; }

  return NextResponse.json(results);
}
