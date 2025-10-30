// scripts/add_media.ts
import * as path from "path";
import { config } from "dotenv";
config({ path: path.join(__dirname, "..", ".env.local") });
import { createClient } from "@supabase/supabase-js";

/**
 * KULLANIM:
 * 1) .env.local dosyanı doldur
 * 2) 'taxonId' değerini düzenle
 * 3) npx tsx scripts/add_media.ts
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE!;
if (!supabaseUrl || !serviceRole) {
  console.error("Eksik env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE");
  process.exit(1);
}

// YAZMA için service_role kullanıyoruz (sunucu/betik)
const supabase = createClient(supabaseUrl, serviceRole);

async function main() {
  // TODO: Bu id'yi eklemek istediğin türün (taxon) id'siyle değiştir
  const taxonId = 1;

  // ÖRNEK GÖRSEL (Wikimedia)
  const url =
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Panthera_pardus_close_up.jpg/250px-Panthera_pardus_close_up.jpg";

  // İstersen küçük önizleme:
  const thumbUrl =
    "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Panthera_pardus_close_up.jpg/150px-Panthera_pardus_close_up.jpg";

  const mediaItem = {
    taxon_id: taxonId,
    kind: "image",
    url,
    thumb_url: thumbUrl,
    title: "Panthera pardus close up",
    author: "Charles J. Sharp",
    license: "CC BY-SA 4.0",
    source: "Wikimedia Commons",
  };

  // Güvenlik: taxon var mı?
  const { data: tx, error: txErr } = await supabase
    .from("taxon")
    .select("id, canonical_name")
    .eq("id", taxonId)
    .maybeSingle();

  if (txErr) {
    console.error("taxon kontrol hatası:", txErr);
    process.exit(1);
  }
  if (!tx) {
    console.error(`taxon bulunamadı: id=${taxonId} (önce taxon tablosuna ekleyin)`);
    process.exit(1);
  }

  // Aynı görsel zaten ekli mi?
  const { data: exists, error: existErr } = await supabase
    .from("media")
    .select("id")
    .eq("taxon_id", taxonId)
    .eq("url", url)
    .limit(1);

  if (existErr) {
    console.error("kontrol hatası:", existErr);
    process.exit(1);
  }
  if (exists && exists.length > 0) {
    console.log("Bu görsel zaten ekli, işlem yok.");
    process.exit(0);
  }

  // Ekle
  const { data, error } = await supabase.from("media").insert(mediaItem).select();
  if (error) {
    console.error("Ekleme hatası:", error);
    process.exit(1);
  }
  console.log("✅ Medya eklendi:", data);
}

main().catch((e) => {
  console.error("Betiğin çalışmasında hata:", e);
  process.exit(1);
});
