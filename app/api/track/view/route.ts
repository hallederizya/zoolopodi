import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);

export async function POST(req: Request) {
  const body = await req.json().catch(()=> ({}));
  const id = Number(body?.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok:false }, { status: 400 });
  const { error } = await supabase.rpc("inc_taxon_view", { tid: id });
  if (error) return NextResponse.json({ ok:false }, { status: 500 });
  return NextResponse.json({ ok:true });
}
