import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const limit = Number(new URL(req.url).searchParams.get("limit") || 200);
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await sb.rpc("get_children", { pid: id, limit_n: limit });
  if (error) return NextResponse.json({ error: "children_err" }, { status: 500 });
  return NextResponse.json(data || []);
}
