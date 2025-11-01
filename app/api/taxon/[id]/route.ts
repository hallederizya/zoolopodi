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

    const [
      { data: tx, error: txErr }, 
      { data: names, error: namesErr }, 
      { data: status, error: statusErr }, 
      { data: pics, error: mediaErr }, 
      { data: dist, error: distErr }, 
      { data: refs, error: refsErr }, 
      { data: descs, error: descsErr }
    ] = await Promise.all([
      supabase.from("taxon").select("*").eq("id", id).single(),
      supabase.from("taxon_name").select("name, lang, is_scientific").eq("taxon_id", id).order("is_scientific", { ascending: false }),
      supabase.from("taxon_status").select("*").eq("taxon_id", id).limit(1),
      supabase.from("media").select("*").eq("taxon_id", id).eq("approved", true).order("id", { ascending: true }).limit(12),
      supabase.from("distribution").select("source, geojson").eq("taxon_id", id).limit(1),
      supabase.from("refs").select("citation, url, source").eq("taxon_id", id).order("id", { ascending: true }),
      supabase.from("taxon_descriptions").select("source, title, content, url").eq("taxon_id", id).order("id", { ascending: true }),
    ]);

    // Log errors for debugging
    if (txErr) console.error(`[taxon/${id}] taxon error:`, txErr);
    if (namesErr) console.error(`[taxon/${id}] names error:`, namesErr);
    if (statusErr) console.error(`[taxon/${id}] status error:`, statusErr);
    if (mediaErr) console.error(`[taxon/${id}] media error:`, mediaErr);
    if (distErr) console.error(`[taxon/${id}] distribution error:`, distErr);
    if (refsErr) console.error(`[taxon/${id}] refs error:`, refsErr);
    if (descsErr) console.error(`[taxon/${id}] descriptions error:`, descsErr);

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
      descriptions: descs || [],
    });
    res.headers.set("Cache-Control", "s-maxage=86400, stale-while-revalidate=86400, max-age=0");
    return res;
  } catch (err) {
    console.error("/api/taxon/[id]: unexpected error:", err);
    logToSupabase("error", "/api/taxon/[id]: unexpected error", { error: String(err) });
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}