import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logToSupabase } from "@/lib/logger";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isFinite(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

    const [{ data: tx }, { data: names }, { data: status }, { data: pics }, { data: dist }, { data: refs }] = await Promise.all([
      supabase.from("taxon").select("*").eq("id", id).single(),
      supabase.from("taxon_name").select("name, lang, is_scientific").eq("taxon_id", id).order("is_scientific", { ascending: false }),
      supabase.from("taxon_status").select("*").eq("taxon_id", id).limit(1),
      supabase.from("media").select("*").eq("taxon_id", id).order("id", { ascending: true }).limit(12),
      supabase.from("distribution").select("source, geojson").eq("taxon_id", id).limit(1),
      supabase.from("refs").select("citation, url, source").eq("taxon_id", id).order("id", { ascending: true }),
    ]);

    if (!tx) {
      logToSupabase("warn", `/api/taxon/${id}: not found`, { id });
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    const res = NextResponse.json({
      taxon: tx,
      names: names || [],
      status: status?.[0] || null,
      media: pics || [],
      distribution: dist?.[0] || null,
      refs: refs || [],
    });
    res.headers.set("Cache-Control", "s-maxage=86400, stale-while-revalidate=86400, max-age=0");
    return res;
  } catch (err) {
    console.error("/api/taxon/[id]: unexpected error:", err);
    logToSupabase("error", "/api/taxon/[id]: unexpected error", { error: String(err) });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}