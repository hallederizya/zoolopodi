import { createClient } from "@supabase/supabase-js";

// Return a flattened sitemap (URL list) so /sitemap.xml works even in environments
// where having both `app/sitemap.ts` and a route-based sitemap is tricky.
export default async function sitemap() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch a reasonably large range; if the table is huge you should implement
  // cursored pagination or use the per-part routes in production.
  const { data, error } = await supabase.from("taxon").select("id").range(0, 99999);
  if (error) return [];

  return (data || []).map((t: any) => ({ url: `${process.env.NEXT_PUBLIC_SITE_URL}/taxon/${t.id}` }));
}
