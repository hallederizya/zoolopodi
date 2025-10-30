import { createClient } from "@supabase/supabase-js";

export default async function sitemap() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.from("taxon").select("id").limit(100);
  return (data || []).map((t: any) => ({
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/taxon/${t.id}`,
    lastModified: new Date(),
  }));
}
