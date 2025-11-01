// lib/enrich.ts
import * as path from "path";
import { config } from "dotenv";
config({ path: path.join(__dirname, "..", ".env.local") });
import { createClient } from "@supabase/supabase-js";

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE! // write
);

// ---- IUCN ----
export async function fetchIucnByName(scientificName: string) {
  const token = process.env.IUCN_TOKEN;
  if (!token) throw new Error("IUCN_TOKEN eksik");
  const url = new URL(`https://apiv3.iucnredlist.org/api/v3/species/${encodeURIComponent(scientificName)}`);
  url.searchParams.set("token", token);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`IUCN hata: ${r.status}`);
  const j = await r.json();
  const d = j?.result?.[0];
  if (!d) return null;
  return {
    category: d.category as string | undefined,
    trend: d.population_trend as string | undefined,
    year: d.published_year as number | undefined,
    url: `https://www.iucnredlist.org/search?query=${encodeURIComponent(scientificName)}&searchType=species`
  };
}

export async function upsertIucnStatus(taxonId: number, s: { category?: string; trend?: string; year?: number; url: string }) {
  const assessed_at = s.year ? `${s.year}-01-01` : null;
  const { error } = await supabaseService.from("taxon_status").upsert({
    taxon_id: taxonId,
    iucn_category: s.category ?? null,
    population_trend: s.trend?.toLowerCase() ?? null,
    assessed_at,
    source_url: s.url
  }, { onConflict: "taxon_id" });
  if (error) throw error;
}

// ---- Commons ----
export async function searchCommonsBestImage(query: string) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.searchParams.set("action", "query");
  u.searchParams.set("format", "json");
  u.searchParams.set("origin", "*");
  u.searchParams.set("generator", "search");
  u.searchParams.set("gsrsearch", `${query} filetype:bitmap`);
  u.searchParams.set("gsrlimit", "10");
  u.searchParams.set("prop", "imageinfo");
  u.searchParams.set("iiprop", "url|user|extmetadata");
  u.searchParams.set("iiurlwidth", "800");
  u.searchParams.set("iiurlheight", "800");

  const r = await fetch(u);
  if (!r.ok) throw new Error("Commons arama hatası");
  const j = await r.json();
  const pages = j?.query?.pages ? Object.values(j.query.pages) as any[] : [];
  const preferred = ["CC0", "CC BY", "CC BY-SA"];
  for (const p of pages) {
    const info = p?.imageinfo?.[0];
    if (!info) continue;
    const meta = info.extmetadata || {};
    const licShort = meta.LicenseShortName?.value || "";
    if (!preferred.some((x: string) => licShort.includes(x))) continue;
    const artist = (meta.Artist?.value || "").replace(/<\/?[^>]+>/g, "").trim();
    const title = (meta.ObjectName?.value || p.title || "").replace(/^File:/i, "");
    return {
      fullUrl: info.url as string,
      thumbUrl: info.thumburl as string | undefined,
      license: licShort || "CC",
      author: artist || info.user || "Unknown",
      title
    };
  }
  return null;
}

// ---- GÜNCEL: Commons araması birden fazla sorgu ile ----
export async function searchCommonsBestImageMulti(queries: string[]) {
  const preferred = ["CC0", "CC BY", "CC BY-SA", "Public domain"];
  for (const q of queries) {
    const u = new URL("https://commons.wikimedia.org/w/api.php");
    u.searchParams.set("action", "query");
    u.searchParams.set("format", "json");
    u.searchParams.set("origin", "*");
    u.searchParams.set("generator", "search");
    u.searchParams.set("gsrsearch", `${q} filetype:bitmap`);
    u.searchParams.set("gsrlimit", "12");
    u.searchParams.set("prop", "imageinfo");
    u.searchParams.set("iiprop", "url|user|extmetadata");
    u.searchParams.set("iiurlwidth", "1200");
    u.searchParams.set("iiurlheight", "1200");

    const r = await fetch(u);
    if (!r.ok) continue;
    const j = await r.json();
    const pages = j?.query?.pages ? Object.values(j.query.pages) as any[] : [];
    for (const p of pages) {
      const info = p?.imageinfo?.[0];
      if (!info) continue;
      const meta = info.extmetadata || {};
      const licShort = meta.LicenseShortName?.value || "";
      if (!preferred.some((x: string) => licShort.toLowerCase().includes(x.toLowerCase()))) continue;
      const artist = (meta.Artist?.value || "").replace(/<\/?[^>]+>/g, "").trim();
      const title = (meta.ObjectName?.value || p.title || "").replace(/^File:/i, "");
      return {
        fullUrl: info.url as string,
        thumbUrl: info.thumburl as string | undefined,
        license: licShort || "CC",
        author: artist || info.user || "Unknown",
        title
      };
    }
  }
  return null;
}

export async function addCommonsImage(taxonId: number, canonicalName: string) {
  const candidate = await searchCommonsBestImage(canonicalName);
  if (!candidate) return { added: false, reason: "no_candidate" };

  const { data: exists } = await supabaseService
    .from("media").select("id")
    .eq("taxon_id", taxonId).eq("url", candidate.fullUrl).limit(1);
  if (exists && exists.length) return { added: false, reason: "exists" };

  const { error } = await supabaseService.from("media").insert({
    taxon_id: taxonId,
    kind: "image",
    url: candidate.fullUrl,
    thumb_url: candidate.thumbUrl ?? null,
    title: candidate.title,
    author: candidate.author,
    license: candidate.license,
    source: "Wikimedia Commons",
    approved: false
  });
  if (error) throw error;
  return { added: true };
}

export async function addCommonsImageFlexible(taxonId: number, canonicalName: string) {
  // Sorgu stratejisi: tam ad → tür adı → cins + tür (boşluklu/italiksiz)
  const parts = canonicalName.split(" ").filter(Boolean);
  const species = parts.length >= 2 ? parts.slice(0, 2).join(" ") : canonicalName;
  const genus = parts[0];

  const candidates = [
    canonicalName,        // tam (alt-tür dahil)
    species,              // sadece tür
    `${genus} ${parts[1] || ""}`.trim()
  ];

  const candidate = await searchCommonsBestImageMulti(candidates);
  if (!candidate) return { added: false, reason: "no_candidate" };

  const { data: exists } = await supabaseService
    .from("media").select("id")
    .eq("taxon_id", taxonId).eq("url", candidate.fullUrl).limit(1);
  if (exists && exists.length) return { added: false, reason: "exists" };

  const { error } = await supabaseService.from("media").insert({
    taxon_id: taxonId,
    kind: "image",
    url: candidate.fullUrl,
    thumb_url: candidate.thumbUrl ?? null,
    title: candidate.title,
    author: candidate.author,
    license: candidate.license,
    source: "Wikimedia Commons",
    approved: false
  });
  if (error) throw error;
  return { added: true };
}

// ---- Wikidata P18 fallback ----
export async function fetchWikidataP18(scientificName: string) {
  const sparql = `
    SELECT ?image WHERE {
      ?item wdt:P225 "${scientificName}" .
      ?item wdt:P18 ?image .
    } LIMIT 1
  `;
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(sparql);
  const r = await fetch(url, { headers: { "User-Agent": "Zoolopodi/1.0" } });
  if (!r.ok) return null;
  const j = await r.json();
  const val = j?.results?.bindings?.[0]?.image?.value;
  if (!val) return null;

  // P18 doğrudan bir resim URL'i (genelde upload.wikimedia.org) olur
  return { url: val as string };
}

export async function addAnyImage(taxonId: number, canonicalName: string) {
  // 1) Commons (esnek)
  const c = await addCommonsImageFlexible(taxonId, canonicalName);
  if (c.added) return c;
  
  // 2) Wikidata P18 fallback
  const w = await fetchWikidataP18(canonicalName);
  if (!w?.url) return { added: false, reason: "no_sources" };

  const { data: exists } = await supabaseService.from("media")
    .select("id").eq("taxon_id", taxonId).eq("url", w.url).limit(1);
  if (exists && exists.length) return { added: false, reason: "exists" };

  const { error } = await supabaseService.from("media").insert({
    taxon_id: taxonId, 
    kind: "image", 
    url: w.url, 
    thumb_url: null,
    title: canonicalName,
    author: "Wikidata",
    license: "Various",
    source: "Wikidata P18", 
    approved: false
  });
  if (error) throw error;
  return { added: true };
}

// ---- iNaturalist ----
async function fetchInat(scientificName: string, page: number) {
  const u = new URL("https://api.inaturalist.org/v1/observations");
  u.searchParams.set("taxon_name", scientificName);
  u.searchParams.set("geo", "true");
  u.searchParams.set("verifiable", "true");
  u.searchParams.set("order", "desc");
  u.searchParams.set("order_by", "created_at");
  u.searchParams.set("per_page", "200");
  u.searchParams.set("page", String(page));
  const r = await fetch(u);
  if (!r.ok) throw new Error("iNat hata: " + r.status);
  const j = await r.json();
  return (j?.results || []) as Array<{ geojson?: { coordinates?: [number, number] } }>;
}

function binKey(lat: number, lng: number, size: number) {
  const rlat = Math.floor(lat / size) * size;
  const rlng = Math.floor(lng / size) * size;
  return `${rlat},${rlng}`;
}
function binToPolygon(lat: number, lng: number, size: number) {
  const lat2 = lat + size, lng2 = lng + size;
  return [[lng, lat],[lng2, lat],[lng2, lat2],[lng, lat2],[lng, lat]];
}

export async function enrichInatDistribution(taxonId: number, canonicalName: string, pages = 3, binSize = 1, max = 1500) {
  let coords: [number, number][] = [];
  for (let p = 1; p <= pages; p++) {
    const chunk = await fetchInat(canonicalName, p);
    const pts = chunk.map(o => o.geojson?.coordinates).filter(Boolean) as [number, number][];
    coords.push(...pts);
    if (coords.length >= max || pts.length === 0) break;
    await new Promise(r => setTimeout(r, 800));
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
  const { error } = await supabaseService
    .from("distribution")
    .upsert({ taxon_id: taxonId, source: "inat", geojson: fc, updated_at: new Date().toISOString() },
            { onConflict: "taxon_id,source" });
  if (error) throw error;
}

// ---- EOL (Encyclopedia of Life) ----
function stripHtml(s?: string) {
  return (s || "").replace(/<\/?[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// EOL: önce arama, sonra sayfa
export async function fetchEolPageByName(scientificName: string) {
  const q = encodeURIComponent(scientificName);
  const search = await fetch(`https://eol.org/api/search/1.0.json?q=${q}`);
  if (!search.ok) return null;
  const sj = await search.json();
  const id = sj?.results?.[0]?.id;
  if (!id) return null;

  const page = await fetch(
    `https://eol.org/api/pages/1.0/${id}.json?images=0&videos=0&sounds=0&maps=0&texts=6&details=true`
  );
  if (!page.ok) return null;
  const pj = await page.json();

  // Metin parçaları (en anlamlı olanı seçelim)
  const texts: any[] = pj?.dataObjects || [];
  const best = texts.find((t) => t.subject === "http://purl.org/dc/dcmitype/Text") || texts[0];

  return {
    eol_id: Number(id),
    title: best?.title || pj?.scientificName || scientificName,
    content: stripHtml(best?.description || ""),
    url: `https://eol.org/pages/${id}`
  };
}
