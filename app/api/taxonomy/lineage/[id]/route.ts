import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await sb.rpc("get_lineage", { tid: id });
  if (error) return NextResponse.json({ error: "lineage_err" }, { status: 500 });
  return NextResponse.json(data || []);
}
