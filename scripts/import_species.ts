// scripts/import_species.ts
import { createClient } from "@supabase/supabase-js";
import {
  fetchIucnByName, upsertIucnStatus,
  addCommonsImage, enrichInatDistribution,
  fetchEolPageByName
} from "@/lib/enrich";
import fs from "node:fs";
import path from "node:path";

// ----------- Yardımcılar -----------
type Rank = "kingdom"|"phylum"|"class"|"order"|"family"|"genus"|"species"|"subspecies";

const SB_PUBLIC = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const SB_SERVICE = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

function parseArgs() {
  const args = process.argv.slice(2);
  const out: any = { concurrency: 1, checkpoint: ".import_checkpoint.json" };
  for (let i=0;i<args.length;i++){
    if (args[i]==="--name" && args[i+1]) out.name = args[++i];
    if (args[i]==="--file" && args[i+1]) out.file = args[++i];
    if (args[i]==="--concurrency" && args[i+1]) out.concurrency = Math.max(1, Number(args[++i]));
    if (args[i]==="--skip-media") out.skipMedia = true;
    if (args[i]==="--skip-iucn") out.skipIucn = true;
    if (args[i]==="--skip-inat") out.skipInat = true;
    if (args[i]==="--checkpoint" && args[i+1]) out.checkpoint = args[++i];
  }
  if (!out.name && !out.file) {
    console.error('Kullanım:\n  Tekli: --name "Panthera pardus"\n  Toplu: --file data/species.txt [--concurrency 2] [--checkpoint .import_checkpoint.json]\nOpsiyonel: --skip-media --skip-iucn --skip-inat');
    process.exit(1);
  }
  return out;
}

// Küçük yardımcılar:
const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));
function sanitizeLine(s:string){ return s.replace(/\s+/g," ").trim(); }
function loadCheckpoint(file:string){ try{ return JSON.parse(fs.readFileSync(file,"utf-8")); } catch { return { done: {} as Record<string, boolean> }; } }
function saveCheckpoint(file:string, state:any){ fs.writeFileSync(file, JSON.stringify(state,null,2)); }

// GBIF match → en iyi eşleşme
async function gbifMatch(name: string) {
  const u = new URL("https://api.gbif.org/v1/species/match");
  u.searchParams.set("name", name);
  
  let lastError: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(u);
      if (!r.ok) throw new Error(`GBIF match HTTP ${r.status}`);
      const j = await r.json();
      if (!j?.usageKey && !j?.speciesKey && !j?.acceptedUsageKey) {
        throw new Error("GBIF eşleşme bulunamadı");
      }
      const key = j.acceptedUsageKey || j.usageKey || j.speciesKey;
      return { key, rank: (j.rank || "").toLowerCase() as Rank, canonical: j.canonicalName || j.scientificName || name };
    } catch (e: any) {
      lastError = e;
      if (attempt < 2) await sleep(500 * Math.pow(2, attempt));
    }
  }
  throw lastError;
}

// GBIF species detay
async function gbifSpecies(key: number) {
  let lastError: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`https://api.gbif.org/v1/species/${key}`);
      if (!r.ok) throw new Error(`GBIF species HTTP ${r.status}`);
      return r.json();
    } catch (e: any) {
      lastError = e;
      if (attempt < 2) await sleep(500 * Math.pow(2, attempt));
    }
  }
  throw lastError;
}

// Supabase'te bir taksonu (ad/rank/parent) oluştur veya getir
async function ensureTaxon(canonical_name: string, rank: Rank, parent_id: number|null, external_gbif_id?: number) {
  // 1) Önce var mı bak: parent_id NULL ise IS NULL ile kontrol et
  const base = SB_SERVICE.from("taxon").select("id").eq("canonical_name", canonical_name).eq("rank", rank).limit(1);
  const { data: exist } = parent_id == null
    ? await base.is("parent_id", null)
    : await base.eq("parent_id", parent_id);

  if (exist && exist.length) return exist[0].id;

  // 2) Yoksa ekle: mevcut constraint (canonical_name,rank) ile upsert
  //    parent_id kontrolü yukarıda yapıldı, burada sadece name+rank conflict yönetimi
  const { data, error } = await SB_SERVICE
    .from("taxon")
    .upsert(
      { canonical_name, rank, parent_id, external_gbif_id },
      { onConflict: "canonical_name,rank" }
    )
    .select("id")
    .single();

  if (error) throw error;

  // 3) Bilimsel adı da (idempotent) upsert et
  try {
    await SB_SERVICE
      .from("taxon_name")
      .upsert(
        { taxon_id: data.id, name: canonical_name, lang: "la", is_scientific: true, source: "GBIF" },
        { onConflict: "taxon_id,name" }
      );
  } catch {}

  return data.id;
}

// GBIF sınıflandırmayı zincire çevir ve Supabase'te inşa et
async function ensureLineageFromGbif(detail: any) {
  // detail: kingdom, phylum, class, order, family, genus, species, canonicalName, rank, key
  const chain: Array<{name:string, rank:Rank}> = [];
  const add = (name?: string, rank?: Rank) => { if (name && rank) chain.push({name, rank}); };

  add(detail.kingdom, "kingdom");
  add(detail.phylum, "phylum");
  add(detail.class, "class");
  add(detail.order, "order");
  add(detail.family, "family");
  add(detail.genus, "genus");

  // species / subspecies ayrımı:
  if (detail.rank?.toLowerCase() === "species") {
    add(detail.canonicalName, "species");
  } else if (detail.rank?.toLowerCase() === "subspecies") {
    // GBIF'te species isim alanı ayrıca gelir
    if (detail.species) add(detail.species, "species");
    add(detail.canonicalName, "subspecies");
  } else {
    // diğer ranklar için de son halkayı ekleyelim
    add(detail.canonicalName, (detail.rank || "").toLowerCase());
  }

  // zinciri sırayla oluşturalım
  let parent: number|null = null;
  for (const step of chain) {
    parent = await ensureTaxon(step.name, step.rank, parent, detail.key);
  }
  return parent!; // son oluşturulan id
}

// Ortak adları (varsa) ekleme (basit GBIF search üzerinden; opsiyonel)
async function tryAddCommonNames(taxonId: number, scientificName: string) {
  try {
    const u = new URL("https://api.gbif.org/v1/species/search");
    u.searchParams.set("q", scientificName);
    u.searchParams.set("limit", "20");
    const r = await fetch(u);
    if (!r.ok) return;
    const j = await r.json();
    const names: Array<{name:string, language?:string}> = j?.results?.[0]?.vernacularNames || [];
    if (!names.length) return;
    const rows = names.slice(0, 12).map((n:any)=>({
      taxon_id: taxonId, name: n.vernacularName || n.name, lang: (n?.language || "und").slice(0,5), is_scientific: false, source: "GBIF"
    }));
    await SB_SERVICE.from("taxon_name").upsert(rows);
  } catch {}
}

// EOL açıklamasını yaz
async function upsertEolDescription(taxonId: number, canonicalName: string) {
  const info = await fetchEolPageByName(canonicalName);
  if (!info || !info.content) return;
  // taxon.external_eol_id'yi de set edelim
  await SB_SERVICE.from("taxon").update({ external_eol_id: info.eol_id }).eq("id", taxonId);
  await SB_SERVICE.from("taxon_descriptions").insert({
    taxon_id: taxonId, source: "EOL", lang: "en", title: info.title, content: info.content, url: info.url
  });
}

// --- asıl tekli iş yapan fonksiyonu ayır (mevcut main’in içeriğini buraya taşı)
async function importOneScientificName(scientificName: string, opts: { skipMedia?:boolean; skipIucn?:boolean; skipInat?:boolean }) {
  // AŞAĞIDA, önceki main() içinde yaptığınız akışın adımlarını çağırıyoruz:
  const match = await gbifMatch(scientificName);
  const detail = await gbifSpecies(match.key);
  const taxonId = await ensureLineageFromGbif(detail);
  await SB_SERVICE.from("taxon").update({ external_gbif_id: detail.key }).eq("id", taxonId);
  await tryAddCommonNames(taxonId, detail.canonicalName);
  
  // EOL açıklaması (opsiyonel, timeout olabilir)
  try {
    await upsertEolDescription(taxonId, detail.canonicalName);
  } catch {}
  
  if (!opts.skipIucn) {
    try { const i = await fetchIucnByName(detail.canonicalName); if (i) await upsertIucnStatus(taxonId, i); } catch {}
  }
  if (!opts.skipMedia) {
    try { await addCommonsImage(taxonId, detail.canonicalName); } catch {}
  }
  if (!opts.skipInat) {
    try { await enrichInatDistribution(taxonId, detail.canonicalName, 3, 1, 1500); } catch {}
  }
  
  // Revalidate cache for the taxon page
  try {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const adminToken = process.env.ADMIN_TOKEN;
    if (siteUrl && adminToken) {
      await fetch(`${siteUrl}/api/revalidate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${adminToken}`
        },
        body: JSON.stringify({ path: `/taxon/${taxonId}` })
      }).catch(() => {});
    }
  } catch {}
  
  return taxonId;
}

// --- TOPLU KOŞUCU ---
async function runBatch(filePath: string, opts: { concurrency:number; checkpoint:string; skipMedia?:boolean; skipIucn?:boolean; skipInat?:boolean }) {
  const raw = fs.readFileSync(filePath, "utf-8").split(/\r?\n/).map(s=>sanitizeLine(s)).filter(Boolean).filter(s=>!s.startsWith("#"));
  const state = loadCheckpoint(opts.checkpoint);
  const todo = raw.filter(name => !state.done[name]);

  console.log(`Toplam satır: ${raw.length} • Kalan: ${todo.length} • Checkpoint: ${opts.checkpoint}`);
  if (!todo.length) { console.log("Her şey zaten yapılmış görünüyor."); return; }

  let active = 0, idx = 0, ok = 0, fail = 0;
  const next = async () => {
    if (idx >= todo.length) return;
    const name = todo[idx++];

    active++;
    try {
      const taxonId = await importOneScientificName(name, opts);
      ok++;
      state.done[name] = true;
      // her başarıda checkpoint yaz
      saveCheckpoint(opts.checkpoint, state);
      console.log(`✅ [${ok}/${todo.length}] ${name} → taxon_id=${taxonId}`);
    } catch (e:any) {
      fail++;
      const errMsg = e?.message || String(e);
      const errDetail = e?.cause ? ` (cause: ${e.cause})` : '';
      console.warn(`⛔ ${name}: ${errMsg}${errDetail}`);
      await sleep(800);
    } finally {
      active--;
      if (idx < todo.length) await next();
    }
  };

  const workers = Array.from({length: opts.concurrency}, ()=> next());
  await Promise.all(workers);
  console.log(`Bitti. Başarılı: ${ok}, Hatalı: ${fail}`);
}

// --- GÜNCELLENMİŞ main ---
async function main() {
  const { name, file, concurrency, checkpoint, skipMedia, skipIucn, skipInat } = parseArgs();
  if (file) {
    await runBatch(file, { concurrency, checkpoint, skipMedia, skipIucn, skipInat });
  } else {
    const taxonId = await importOneScientificName(name, { skipMedia, skipIucn, skipInat });
    console.log("✅ Bitti. taxon_id =", taxonId);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
