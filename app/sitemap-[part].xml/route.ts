import { createClient } from "@supabase/supabase-js";

const CHUNK = 1000;

export async function GET(_: Request, { params }: { params: { part: string } }) {
  const part = Number(params.part);
  if (!Number.isFinite(part) || part < 1) {
    return new Response("bad part", { status: 400 });
  }

  const from = (part - 1) * CHUNK;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data, error } = await supabase
    .from("taxon")
    .select("id")
    .order("id", { ascending: true })
    .range(from, from + CHUNK - 1);

  if (error) return new Response("err", { status: 500 });

  const base = process.env.NEXT_PUBLIC_SITE_URL!;
  const urls = (data || []).map((t: any) => `<url><loc>${base}/taxon/${t.id}</loc></url>`).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ${urls}\n  </urlset>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}
