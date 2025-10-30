// scripts/seed_taxa.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!  // write
);

async function upsertTaxon() {
  // Örnek: Panthera pardus
  const { data: existing } = await supabase
    .from("taxon")
    .select("id")
    .eq("canonical_name", "Panthera pardus")
    .limit(1);

  let taxonId: number | null = existing?.[0]?.id ?? null;

  if (!taxonId) {
    const { data, error } = await supabase
      .from("taxon")
      .insert({ canonical_name: "Panthera pardus", rank: "species" })
      .select()
      .single();
    if (error) throw error;
    taxonId = data.id;
  }

  // Ortak adlar
  const names = [
    { taxon_id: taxonId, name: "Panthera pardus", lang: "la", is_scientific: true,  source: "seed" },
    { taxon_id: taxonId, name: "Anadolu parsı",   lang: "tr", is_scientific: false, source: "seed" },
    { taxon_id: taxonId, name: "Leopard",         lang: "en", is_scientific: false, source: "seed" }
  ];

  await supabase.from("taxon_name").upsert(names, { onConflict: "taxon_id,name" });
  console.log("Seed OK. taxon_id=", taxonId);
  return taxonId!;
}

async function main() {
  const taxonId = await upsertTaxon();

  // Basit IUCN örneği (elle). Sonra API ile dolduracağız.
  await supabase.from("taxon_status").upsert({
    taxon_id: taxonId,
    iucn_category: "VU",           // örnek: Hassas (Vulnerable)
    population_trend: "decreasing",
    assessed_at: "2024-01-01",
    source_url: "https://www.iucnredlist.org/"
  }, { onConflict: "taxon_id" });

  console.log("IUCN dummy status eklendi");

  // İstersen burada add_media.ts’teki görseli de otomatik ekleyebilirsin.
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
