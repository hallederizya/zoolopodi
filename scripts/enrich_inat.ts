// scripts/enrich_inat.ts
import * as path from "path";
import { config } from "dotenv";
config({ path: path.join(__dirname, "..", ".env.local") });
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

// Basit iNat çekimi: lat/lng'leri al, ızgara hücrelerine say.
type CliArgs = { id?: number; name?: string; pages?: number; binsize?: number; max?: number; file?: string };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // write
);

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const cli: CliArgs = { pages: 3, binsize: 1, max: 1500 };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--id" && args[i + 1]) cli.id = Number(args[++i]);
    if (args[i] === "--name" && args[i + 1]) cli.name = args[++i];
    if (args[i] === "--pages" && args[i + 1]) cli.pages = Number(args[++i]);
    if (args[i] === "--binsize" && args[i + 1]) cli.binsize = Number(args[++i]);
    if (args[i] === "--max" && args[i + 1]) cli.max = Number(args[++i]);
    if (args[i] === "--file" && args[i + 1]) cli.file = args[++i];
  }
  return cli;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getTaxon(id?: number, name?: string) {
  if (id) {
    const { data } = await supabase.from("taxon").select("id, canonical_name").eq("id", id).single();
    if (!data) throw new Error("taxon yok (id=" + id + ")");
    return data;
  } else {
    const { data } = await supabase.from("taxon").select("id, canonical_name").eq("canonical_name", name!).maybeSingle();
    if (!data) throw new Error("taxon yok (name=" + name + ")");
    return data;
  }
}

// iNat: basit arama; geo=true + verifiable=true ile lokasyonlu kayıtlar.
async function fetchInatObservations(scientificName: string, page: number) {
  const url = new URL("https://api.inaturalist.org/v1/observations");
  url.searchParams.set("taxon_name", scientificName);
  url.searchParams.set("geo", "true");
  url.searchParams.set("verifiable", "true");
  url.searchParams.set("order", "desc");
  url.searchParams.set("order_by", "created_at");
  url.searchParams.set("per_page", "200"); // iNat limiti
  url.searchParams.set("page", String(page));

  // Robust fetch: timeout + retries with backoff
  const maxAttempts = 3;
  const timeoutMs = 10000; // 10s per request
  let lastErr: any = null;
  let j: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const r = await fetch(url.toString(), { signal: controller.signal, headers: { Accept: "application/json" } });
      clearTimeout(id);
      if (!r.ok) {
        lastErr = new Error("iNat API hata: " + r.status);
        // For 4xx errors, don't retry
        if (r.status >= 400 && r.status < 500) break;
        // otherwise retry
        await new Promise(res => setTimeout(res, attempt * 500));
        continue;
      }
      j = await r.json();
      lastErr = null;
      break;
    } catch (e: any) {
      clearTimeout(id);
      lastErr = e;
      // If aborted or connection timeout, retry with backoff
      if (e?.name === 'AbortError' || e?.code === 'UND_ERR_CONNECT_TIMEOUT' || e?.code === 'ENOTFOUND') {
        // gentle backoff
        await new Promise(res => setTimeout(res, attempt * 1000));
        continue;
      }
      // other errors: break and surface
      break;
    }
  }
  if (!j) {
    // Log and return empty list so caller can continue
    console.warn('iNat fetch failed for', scientificName, 'page', page, 'lastErr:', lastErr);
    return [];
  }
  const obs = (j?.results || []) as Array<{ geojson?: { coordinates?: [number, number] } }>;
  return obs
    .map(o => o.geojson?.coordinates)
    .filter(Boolean) as [number, number][];
}

// Lat/Lng → ızgara bin anahtarı
function binKey(lat: number, lng: number, size: number) {
  const rlat = Math.floor(lat / size) * size;
  const rlng = Math.floor(lng / size) * size;
  return `${rlat},${rlng}`;
}

function binToPolygon(lat: number, lng: number, size: number) {
  const lat2 = lat + size;
  const lng2 = lng + size;
  // Basit kutu poligonu (lng, lat)
  return [
    [lng, lat],
    [lng2, lat],
    [lng2, lat2],
    [lng, lat2],
    [lng, lat],
  ];
}

async function main() {
  const cli = parseArgs();

  const pages = cli.pages || 3;
  const binSize = cli.binsize || 1;
  const max = cli.max || 1500;

async function processOne(taxonId: number, canonicalName: string, pages: number, binSize: number, max: number) {
  let coords: [number, number][] = [];
  for (let p = 1; p <= pages; p++) {
    const chunk = await fetchInatObservations(canonicalName, p);
    coords.push(...chunk);
    if (coords.length >= max || chunk.length === 0) break;
    await sleep(800);
  }
  const counter = new Map<string, number>();
  for (const [lng, lat] of coords) {
    const key = binKey(lat, lng, binSize);
    counter.set(key, (counter.get(key) || 0) + 1);
  }
  const features = Array.from(counter.entries()).map(([key, count]) => {
    const [latStr, lngStr] = key.split(",");
    const lat = Number(latStr), lng = Number(lngStr);
    return { type: "Feature", properties: { count }, geometry: { type: "Polygon", coordinates: [binToPolygon(lat, lng, binSize)] } };
  });
  const fc = { type: "FeatureCollection", features };
  const { error } = await supabase.from("distribution").upsert({
    taxon_id: taxonId, source: "inat", geojson: fc, updated_at: new Date().toISOString()
  }, { onConflict: "taxon_id,source" });
  if (error) throw error;
  console.log("✅ inat yazıldı:", canonicalName);
}

async function main() {
  const cli = parseArgs();

  if (cli.file) {
    const lines = fs.readFileSync(cli.file, "utf-8").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    for (const line of lines) {
      try {
        const tx = line.startsWith("id:") ? await getTaxon(Number(line.slice(3)), undefined)
                                          : await getTaxon(undefined, line);
        await processOne(tx.id, tx.canonical_name, cli.pages!, cli.binsize!, cli.max!);
      } catch (e) { console.warn("Hata:", line, e); }
    }
    return;
  }

  if (!cli.id && !cli.name) {
    console.error('Kullanım: --id <taxonId> | --name "Bilimsel Ad" | --file species.txt [--pages 3] [--binsize 1]');
    process.exit(1);
  }

  const tx = await getTaxon(cli.id, cli.name);
  await processOne(tx.id, tx.canonical_name, cli.pages!, cli.binsize!, cli.max!);
}

main().catch(e=>{ console.error(e); process.exit(1); });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
