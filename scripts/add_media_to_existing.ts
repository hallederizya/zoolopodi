// scripts/add_media_to_existing.ts
// Mevcut türlere Wikimedia Commons'tan görsel ekler
import { createClient } from "@supabase/supabase-js";
import { addAnyImage } from "@/lib/enrich";
import fs from "node:fs";

const SB_SERVICE = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Args {
  limit?: number;
  concurrency: number;
  checkpoint: string;
  offset: number;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const out: Args = { concurrency: 1, checkpoint: ".add_media_checkpoint.json", offset: 0 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--limit" && args[i + 1]) out.limit = Number(args[++i]);
    if (args[i] === "--concurrency" && args[i + 1]) out.concurrency = Math.max(1, Number(args[++i]));
    if (args[i] === "--checkpoint" && args[i + 1]) out.checkpoint = args[++i];
    if (args[i] === "--offset" && args[i + 1]) out.offset = Number(args[++i]);
  }
  return out;
}

function loadCheckpoint(file: string): Record<number, boolean> {
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    return data.done || {};
  } catch {
    return {};
  }
}

function saveCheckpoint(file: string, done: Record<number, boolean>) {
  fs.writeFileSync(file, JSON.stringify({ done }, null, 2));
}

async function main() {
  const opts = parseArgs();
  const checkpoint = loadCheckpoint(opts.checkpoint);

  console.log(`Mevcut türlere Wikimedia Commons görselleri ekleniyor...`);
  console.log(`Checkpoint: ${opts.checkpoint} (${Object.keys(checkpoint).length} tür tamamlandı)`);

  // Sadece species rank'ındaki türleri al (görseller genelde tür düzeyinde)
  let query = SB_SERVICE
    .from("taxon")
    .select("id, canonical_name, rank")
    .eq("rank", "species")
    .order("id", { ascending: true });

  if (opts.limit) {
    query = query.range(opts.offset, opts.offset + opts.limit - 1);
  }

  const { data: taxa, error } = await query;

  if (error) {
    console.error("Taxon listesi alınamadı:", error);
    process.exit(1);
  }

  if (!taxa || taxa.length === 0) {
    console.log("İşlenecek tür bulunamadı.");
    return;
  }

  const todo = taxa.filter(t => !checkpoint[t.id]);
  console.log(`Toplam tür: ${taxa.length} • İşlenecek: ${todo.length}`);

  let active = 0;
  let idx = 0;
  let ok = 0;
  let skip = 0;
  let fail = 0;

  const next = async () => {
    if (idx >= todo.length) return;
    const taxon = todo[idx++];

    active++;
    try {
      // Zaten medyası var mı kontrol et
      const { data: existing } = await SB_SERVICE
        .from("media")
        .select("id")
        .eq("taxon_id", taxon.id)
        .limit(1);

      if (existing && existing.length > 0) {
        skip++;
        checkpoint[taxon.id] = true;
        console.log(`⏭️  [${ok + skip + fail}/${todo.length}] ${taxon.canonical_name} (zaten var)`);
      } else {
        const result = await addAnyImage(taxon.id, taxon.canonical_name);
        if (result.added) {
          ok++;
          console.log(`✅ [${ok + skip + fail}/${todo.length}] ${taxon.canonical_name} → medya eklendi`);
        } else {
          skip++;
          console.log(`⏭️  [${ok + skip + fail}/${todo.length}] ${taxon.canonical_name} (${result.reason})`);
        }
        checkpoint[taxon.id] = true;
      }

      saveCheckpoint(opts.checkpoint, checkpoint);
      await sleep(500); // Rate limiting
    } catch (e: any) {
      fail++;
      console.error(`⛔ [${ok + skip + fail}/${todo.length}] ${taxon.canonical_name}: ${e.message}`);
      checkpoint[taxon.id] = true;
      saveCheckpoint(opts.checkpoint, checkpoint);
    } finally {
      active--;
      if (active < opts.concurrency && idx < todo.length) {
        next();
      }
    }
  };

  // Başlat
  for (let i = 0; i < opts.concurrency && i < todo.length; i++) {
    next();
  }

  // Bitene kadar bekle
  await new Promise<void>(resolve => {
    const check = setInterval(() => {
      if (active === 0 && idx >= todo.length) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });

  console.log(`\nBitti! Eklenen: ${ok}, Atlanan: ${skip}, Hatalı: ${fail}`);
}

main().catch(console.error);
