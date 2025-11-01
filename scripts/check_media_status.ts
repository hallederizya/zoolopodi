// scripts/check_media_status.ts
// Medya durumunu raporla
import * as path from "path";
import { config } from "dotenv";
config({ path: path.join(__dirname, "..", ".env.local") });
import { createClient } from "@supabase/supabase-js";

const SB_SERVICE = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

async function main() {
  console.log("📊 Medya Durumu Raporu\n");

  // 1. Toplam tür sayısı
  const { count: totalSpecies } = await SB_SERVICE
    .from("taxon")
    .select("*", { count: "exact", head: true })
    .eq("rank", "species");

  console.log(`Toplam tür: ${totalSpecies}`);

  // 2. Medyası olan türler
  const { count: mediaCount } = await SB_SERVICE
    .from("media")
    .select("taxon_id", { count: "exact", head: true });

  const { data: uniqueTaxa } = await SB_SERVICE
    .from("media")
    .select("taxon_id");

  const uniqueCount = new Set(uniqueTaxa?.map(m => m.taxon_id)).size;

  console.log(`Medyası olan tür: ${uniqueCount}`);
  console.log(`Toplam medya: ${mediaCount}`);
  console.log(`Medya kapsama: ${((uniqueCount / (totalSpecies || 1)) * 100).toFixed(1)}%`);

  // 3. Onaylı medya
  const { count: approvedCount } = await SB_SERVICE
    .from("media")
    .select("*", { count: "exact", head: true })
    .eq("approved", true);

  console.log(`\nOnaylı medya: ${approvedCount}`);
  console.log(`Onaysız medya: ${(mediaCount || 0) - (approvedCount || 0)}`);

  // 4. Kaynaklara göre
  const { data: sources } = await SB_SERVICE
    .from("media")
    .select("source");

  const sourceStats = sources?.reduce((acc, m) => {
    const s = m.source || "Unknown";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("\n📸 Kaynaklara göre:");
  Object.entries(sourceStats || {}).forEach(([source, count]) => {
    console.log(`  ${source}: ${count}`);
  });

  // 5. Popüler türlerden örnekler (medyası olmayanlar)
  const popularGenera = ["Panthera", "Canis", "Felis", "Ursus", "Elephas", "Loxodonta", "Aquila", "Falco"];
  
  console.log("\n🔍 Popüler cinslerde medyası olmayan türler:");
  for (const genus of popularGenera) {
    const { data: species } = await SB_SERVICE
      .from("taxon")
      .select("id, canonical_name")
      .eq("rank", "species")
      .like("canonical_name", `${genus}%`)
      .limit(20);

    if (!species || species.length === 0) continue;

    for (const sp of species) {
      const { data: media } = await SB_SERVICE
        .from("media")
        .select("id")
        .eq("taxon_id", sp.id)
        .limit(1);

      if (!media || media.length === 0) {
        console.log(`  ❌ ${sp.canonical_name} (ID: ${sp.id})`);
      }
    }
  }
}

main().catch(console.error);
