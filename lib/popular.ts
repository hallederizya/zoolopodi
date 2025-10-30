import { createClient } from "@supabase/supabase-js";

export async function getPopularTaxa(limit = 200) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  // MVP: ilk id'ler; ileride view_count'a göre gerçek popülerlik kullanılacak
  const { data } = await supabase
    .from("taxon")
    .select("id")
    .order("id", { ascending: true })
    .limit(limit);

  return (data || []).map((t: any) => ({ id: String(t.id) }));
}
