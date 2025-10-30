// scripts/add_commons_image.ts
import * as path from "path";
import { config } from "dotenv";
config({ path: path.join(__dirname, "..", ".env.local") });
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

// Node 18+ fetch yerleşik
type CliArgs = { id?: number; name?: string; file?: string };

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
    if (args[i] === "--file" && args[i + 1]) cli.file = args[++i];
  }
  return cli;
}

// Küçük yardımcılar:
async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getTaxonById(id: number) {
  const { data, error } = await supabase.from("taxon").select("id, canonical_name").eq("id", id).single();
  if (error || !data) throw new Error("taxon bulunamadı (id=" + id + ")");
  return data;
}

async function getTaxonByName(name: string) {
  const { data, error } = await supabase
    .from("taxon")
    .select("id, canonical_name")
    .eq("canonical_name", name)
    .maybeSingle();
  if (error || !data) throw new Error("taxon bulunamadı (name=" + name + ")");
  return data;
}

// Commons search + imageinfo (extmetadata) ile en iyi adayı bul
async function searchCommonsBestImage(query: string) {
  // 1) Arama: sayfa başlıklarını al
  const searchUrl = new URL("https://commons.wikimedia.org/w/api.php");
  searchUrl.searchParams.set("action", "query");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("origin", "*");
  searchUrl.searchParams.set("generator", "search");
  searchUrl.searchParams.set("gsrsearch", `${query} filetype:bitmap`);
  searchUrl.searchParams.set("gsrlimit", "10");
  searchUrl.searchParams.set("prop", "imageinfo");
  searchUrl.searchParams.set("iiprop", "url|user|extmetadata");
  searchUrl.searchParams.set("iiurlwidth", "800");
  searchUrl.searchParams.set("iiurlheight", "800");

  const r = await fetch(searchUrl);
  if (!r.ok) throw new Error("Commons arama hatası");
  const j = await r.json();

  const pages = j?.query?.pages ? Object.values(j.query.pages) as any[] : [];
  if (!pages.length) return null;

  // 2) Lisans filtresi (CC0/CC BY/CC BY-SA vs.) + portre/kalite basit kıstas
  const preferred = ["CC0", "CC BY", "CC BY-SA"];
  let best: any = null;

  for (const p of pages) {
    const info = p?.imageinfo?.[0];
    if (!info) continue;
    const meta = info.extmetadata || {};
    const licShort = meta.LicenseShortName?.value || "";
    const licUrl = meta.LicenseUrl?.value || "";
    const artist = (meta.Artist?.value || "").replace(/<\/?[^>]+(>|$)/g, "").trim(); // HTML temizle
    const title = (meta.ObjectName?.value || p.title || "").replace(/^File:/i, "");
    const desc = (meta.ImageDescription?.value || "").replace(/<\/?[^>]+(>|$)/g, "").trim();

    // Lisans uygun mu?
    if (!preferred.some((x) => licShort.includes(x))) continue; // basit filtre

    const candidate = {
      fullUrl: info.url as string,
      thumbUrl: info.thumburl as string | undefined,
      license: licShort || "CC",
      licenseUrl: licUrl,
      author: artist || info.user || "Unknown",
      title: title || desc || query
    };

    // İlk uygun adayı al (istersen burada daha gelişmiş skorlama yapabiliriz)
    best = candidate;
    break;
  }

  return best;
}

async function processOne(taxonId: number, canonicalName: string) {
  const candidate = await searchCommonsBestImage(canonicalName);
  if (!candidate) {
    console.warn("Uygun lisanslı görsel bulunamadı:", canonicalName);
    return;
  }
  const { data: exists } = await supabase
    .from("media").select("id")
    .eq("taxon_id", taxonId).eq("url", candidate.fullUrl).limit(1);
  if (exists && (exists as any).length) {
    console.log("Zaten var:", canonicalName);
    return;
  }
  const { error } = await supabase.from("media").insert({
    taxon_id: taxonId,
    kind: "image",
    url: candidate.fullUrl,
    thumb_url: candidate.thumbUrl ?? null,
    title: candidate.title,
    author: candidate.author,
    license: candidate.license,
    source: "Wikimedia Commons",
  });
  if (error) throw error;
  console.log("✅ Eklendi:", canonicalName);
}

async function main() {
  const { id, name, file } = parseArgs();

  if (file) {
    const lines = fs
      .readFileSync(file, "utf-8")
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const line of lines) {
      try {
        let tx: any;
        if (line.startsWith("id:")) {
          const n = Number(line.slice(3));
          tx = await getTaxonById(n);
        } else {
          tx = await getTaxonByName(line);
        }
        await processOne(tx.id, tx.canonical_name);
        await sleep(800); // nazik gecikme
      } catch (e) {
        console.warn("Hata:", line, e);
      }
    }
    return;
  }

  if (id) {
    const tx = await getTaxonById(id);
    await processOne(tx.id, tx.canonical_name);
    return;
  }
  if (name) {
    const tx = await getTaxonByName(name!);
    await processOne(tx.id, tx.canonical_name);
    return;
  }

  console.error('Kullanım: --id <taxonId> | --name "Bilimsel Ad" | --file species.txt');
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
