import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const taxon_id = Number(b?.taxon_id);
  if (!Number.isFinite(taxon_id)) return NextResponse.json({ error: "bad taxon_id" }, { status: 400 });

  const row = { taxon_id, citation: b?.citation || null, url: b?.url || null, source: b?.source || null };
  const { error } = await sb.from("refs").insert(row);
  if (error) return NextResponse.json({ error: "insert_err" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
