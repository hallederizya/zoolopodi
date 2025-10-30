// scripts/enrich_iucn.ts
import * as path from "path";
import { config } from "dotenv";
config({ path: path.join(__dirname, "..", ".env.local") });
import { createClient } from "@supabase/supabase-js";

type CliArgs = { id?: number; name?: string; fillMissing?: boolean };
const IUCN_TOKEN = process.env.IUCN_TOKEN;

if (!IUCN_TOKEN) {
  console.error("IUCN_TOKEN .env.local içinde tanımlı olmalı.");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // write
);

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const cli: CliArgs = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--id" && args[i + 1]) cli.id = Number(args[++i]);
    if (args[i] === "--name" && args[i + 1]) cli.name = args[++i];
    if (args[i] === "--fill-missing") cli.fillMissing = true;
  }
  return cli;
}

async function fetchIucnByName(scientificName: string) {
  // Try v3 first (known host). If it doesn't return a match, optionally try v4.
  const endpoints = [
    `https://apiv3.iucnredlist.org/api/v3/species/${encodeURIComponent(scientificName)}?token=${encodeURIComponent(
      IUCN_TOKEN!,
    )}`,
    `https://apiv4.iucnredlist.org/api/v4/species/${encodeURIComponent(scientificName)}?token=${encodeURIComponent(
      IUCN_TOKEN!,
    )}`,
  ];

  let lastErr: any = null;
  for (const url of endpoints) {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (r.status === 404) {
        // try next endpoint
        continue;
      }
      if (!r.ok) {
        lastErr = new Error(`IUCN API hata: ${r.status} for ${url}`);
        continue;
      }
      const j = await r.json();
      // v4 may return { data: [...] } while v3 returned { result: [...] }
      const d = j?.data?.[0] || j?.result?.[0];
      if (!d) return null;

      // Defensive mapping: different API versions / fields
      const category = (d.category || d.status || d.category_name || d.redlist_category) as string | undefined;
      const trend = (d.population_trend || d.trend) as string | undefined;
      const year = (d.published_year || d.assessed_year || d.year) as number | undefined;
      const urlSearch = `https://www.iucnredlist.org/search?query=${encodeURIComponent(scientificName)}&searchType=species`;

      return {
        category,
        trend,
        year,
        url: urlSearch,
      };
    } catch (e: any) {
      // DNS errors (ENOTFOUND) mean the host doesn't exist — ignore and try next endpoint.
      if (e?.code === "ENOTFOUND" || (e?.cause && e.cause.code === "ENOTFOUND")) {
        continue;
      }
      lastErr = e;
      continue;
    }
  }

  if (lastErr) throw lastErr;
  return null;
}

async function upsertStatus(taxonId: number, s: { category?: string; trend?: string; year?: number; url: string }) {
  const assessed_at = s.year ? `${s.year}-01-01` : null;
  const { error } = await supabase.from("taxon_status").upsert({
    taxon_id: taxonId,
    iucn_category: s.category ?? null,
    population_trend: s.trend?.toLowerCase() ?? null,
    assessed_at,
    source_url: s.url
  }, { onConflict: "taxon_id" });

  if (error) throw error;
}

async function processOneById(id: number) {
  const { data: tx } = await supabase.from("taxon").select("id, canonical_name").eq("id", id).single();
  if (!tx) throw new Error("taxon yok (id=" + id + ")");
  const info = await fetchIucnByName(tx.canonical_name);
  if (!info) {
    console.warn("IUCN sonucu yok:", tx.canonical_name);
    return;
  }
  await upsertStatus(tx.id, info);
  console.log(`✅ IUCN güncellendi: ${tx.canonical_name} → ${info.category}`);
}

async function processOneByName(name: string) {
  const { data: tx } = await supabase.from("taxon").select("id, canonical_name").eq("canonical_name", name).maybeSingle();
  if (!tx) throw new Error("taxon yok (name=" + name + ")");
  const info = await fetchIucnByName(tx.canonical_name);
  if (!info) {
    console.warn("IUCN sonucu yok:", tx.canonical_name);
    return;
  }
  await upsertStatus(tx.id, info);
  console.log(`✅ IUCN güncellendi: ${tx.canonical_name} → ${info.category}`);
}

async function processFillMissing() {
  // status kaydı olmayan ilk 100 tür
  const { data: list, error } = await supabase
    .rpc("get_taxa_without_status"); // Eğer bu fonksiyon yoksa alt satırdaki SELECT’i kullan
  if (error) {
    // Yedek SELECT (left join null)
    const { data } = await supabase
      .from("taxon")
      .select("id, canonical_name")
      .limit(100);
    await bulkFetch(data || []);
    return;
  }
  await bulkFetch(list || []);
}

async function bulkFetch(rows: Array<{ id: number; canonical_name: string }>) {
  for (const row of rows) {
    try {
      const info = await fetchIucnByName(row.canonical_name);
      if (info) {
        await upsertStatus(row.id, info);
        console.log(`✅ ${row.canonical_name} → ${info.category}`);
      } else {
        console.log(`⛔ Bulunamadı: ${row.canonical_name}`);
      }
      // nazik bir gecikme (oran limitleri için)
      await new Promise((r) => setTimeout(r, 1200));
    } catch (e) {
      console.warn("Hata:", row.canonical_name, e);
    }
  }
}

async function main() {
  const cli = parseArgs();
  if (cli.id) return processOneById(cli.id);
  if (cli.name) return processOneByName(cli.name);
  if (cli.fillMissing) return processFillMissing();

  console.error('Kullanım: --id <taxonId> | --name "Bilimsel Ad" | --fill-missing');
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
