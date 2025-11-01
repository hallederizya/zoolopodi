import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// .env.local dosyasını yükle
const envPath = path.resolve(process.cwd(), ".env.local");
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE!;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Environment variables eksik!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function monitor() {
  console.log("\n📊 Medya Ekleme İzleme Raporu");
  console.log("═".repeat(60));

  // Checkpoint dosyasını oku
  let checkpoint = { processedIds: [] };
  try {
    const fs = await import("fs");
    const checkpointData = fs.readFileSync(".add_media_checkpoint.json", "utf-8");
    checkpoint = JSON.parse(checkpointData);
  } catch {
    // Checkpoint yoksa devam et
  }

  // Toplam istatistikler
  const { count: totalSpecies } = await supabase
    .from("taxon")
    .select("*", { count: "exact", head: true })
    .eq("rank", "SPECIES");

  // Medyası olan türleri say
  const { data: mediaIds } = await supabase
    .from("media")
    .select("taxon_id");

  const uniqueTaxonIds = new Set(mediaIds?.map((m) => m.taxon_id) || []);
  const withMedia = uniqueTaxonIds.size;

  const { count: totalMedia } = await supabase
    .from("media")
    .select("*", { count: "exact", head: true });

  const { count: approvedMedia } = await supabase
    .from("media")
    .select("*", { count: "exact", head: true })
    .eq("approved", true);

  const { count: unapprovedMedia } = await supabase
    .from("media")
    .select("*", { count: "exact", head: true })
    .eq("approved", false);

  const coverage = totalSpecies ? ((withMedia || 0) / totalSpecies) * 100 : 0;
  const processedCount = checkpoint.processedIds?.length || 0;
  const processedPercent = totalSpecies ? (processedCount / totalSpecies) * 100 : 0;
  const remaining = (totalSpecies || 0) - processedCount;

  console.log(`\n🔢 İlerleme:`);
  console.log(`  Toplam tür sayısı: ${totalSpecies?.toLocaleString()}`);
  console.log(`  İşlenen tür: ${processedCount.toLocaleString()} (${processedPercent.toFixed(1)}%)`);
  console.log(`  Kalan tür: ${remaining.toLocaleString()}`);

  console.log(`\n📸 Medya İstatistikleri:`);
  console.log(`  Medyası olan tür: ${withMedia?.toLocaleString() || 0}`);
  console.log(`  Toplam medya: ${totalMedia?.toLocaleString() || 0}`);
  console.log(`  Medya kapsama: ${coverage.toFixed(2)}%`);
  console.log(`  Onaylı medya: ${approvedMedia?.toLocaleString() || 0}`);
  console.log(`  Onaysız medya: ${unapprovedMedia?.toLocaleString() || 0}`);

  // Kaynaklara göre breakdown
  const { data: sourceBreakdown } = await supabase
    .from("media")
    .select("source");

  if (sourceBreakdown && sourceBreakdown.length > 0) {
    const sources: Record<string, number> = {};
    sourceBreakdown.forEach((m) => {
      if (m.source) {
        sources[m.source] = (sources[m.source] || 0) + 1;
      }
    });

    console.log(`\n📌 Kaynaklara göre:`);
    Object.entries(sources)
      .sort((a, b) => b[1] - a[1])
      .forEach(([source, count]) => {
        console.log(`  ${source}: ${count}`);
      });
  }

  // Son eklenen medyalar
  const { data: recentMedia } = await supabase
    .from("media")
    .select("id, taxon_id, source, approved, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (recentMedia && recentMedia.length > 0) {
    console.log(`\n🆕 Son eklenen 10 medya:`);
    for (const media of recentMedia) {
      const { data: taxon } = await supabase
        .from("taxon")
        .select("canonical_name")
        .eq("id", media.taxon_id)
        .single();

      const status = media.approved ? "✓" : "⋯";
      const time = new Date(media.created_at).toLocaleString("tr-TR");
      console.log(`  ${status} ${taxon?.canonical_name || "Unknown"} (${media.source}) - ${time}`);
    }
  }

  // Tahmini tamamlanma süresi
  if (processedCount > 100 && remaining > 0) {
    const now = Date.now();
    try {
      const fs = await import("fs");
      const stats = fs.statSync(".add_media_checkpoint.json");
      const checkpointTime = stats.mtimeMs;
      const elapsed = (now - checkpointTime) / 1000; // saniye
      const rate = processedCount / elapsed; // tür/saniye
      const remainingSeconds = remaining / rate;
      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);

      console.log(`\n⏱️  Tahmini Tamamlanma:`);
      console.log(`  Hız: ${(rate * 60).toFixed(1)} tür/dakika`);
      console.log(`  Kalan süre: ~${hours}s ${minutes}dk`);
    } catch {
      // İstatistik hesaplanamadıysa devam et
    }
  }

  console.log("\n" + "═".repeat(60));
}

// Her 30 saniyede bir çalıştır
async function loop() {
  while (true) {
    await monitor();
    console.log("\n⏳ 30 saniye sonra güncellenecek...\n");
    await new Promise((resolve) => setTimeout(resolve, 30000));
  }
}

loop();
