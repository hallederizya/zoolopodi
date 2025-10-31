// scripts/export_gbif_animalia_species.ts
import fs from "node:fs";

const OUT = "data/gbif_animalia_species.txt";
const LIMIT = 300; // GBIF max 300
const UA = process.env.GBIF_UA || "Zoolopodi/1.0 (contact: mustafa@example.com)";

type SearchResp = { results?: any[]; endOfRecords?: boolean };

async function fetchPage(offset: number): Promise<SearchResp> {
  const u = new URL("https://api.gbif.org/v1/species/search");
  u.searchParams.set("kingdomKey", "1");      // Animalia
  u.searchParams.set("rank", "SPECIES");      // tür düzeyi
  u.searchParams.set("status", "ACCEPTED");   // kabul edilen adlar
  u.searchParams.set("limit", String(LIMIT));
  u.searchParams.set("offset", String(offset));
  const r = await fetch(u.toString(), { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

async function main() {
  fs.mkdirSync("data", { recursive: true });
  const stream = fs.createWriteStream(OUT, { flags: "a" });

  let offset = 0, page = 0, total = 0;
  while (true) {
    page++;
    let j: SearchResp = {};
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        j = await fetchPage(offset);
        break;
      } catch (e: any) {
        // 404 → büyük olasılıkla bitti
        if (String(e?.message) === "404") {
          console.log(`Bitti (404). Toplam yazılan: ${total}`);
          stream.end();
          return;
        }
        const wait = 600 * Math.pow(2, attempt);
        console.warn(`uyaa: offset=${offset} hata, ${wait}ms bekle (deneme ${attempt + 1}/4)`);
        await new Promise(r => setTimeout(r, wait));
        if (attempt === 3) throw e;
      }
    }

    const res = j.results || [];
    if (!res.length) {
      console.log(`Bitti. Toplam yazılan: ${total}`);
      break;
    }

    const names = res
      .filter(x => (x?.kingdomKey === 1 || x?.kingdom === "Animalia") && x?.canonicalName)
      .map(x => String(x.canonicalName));

    for (const n of names) stream.write(n + "\n");
    total += names.length;

    console.log(`Sayfa ${page} offset=${offset} → +${names.length} (toplam ${total})`);

    // endOfRecords sinyali gelirse bitir
    if (j.endOfRecords || res.length < LIMIT) break;

    offset += LIMIT;
    await new Promise(r => setTimeout(r, 600));
  }

  stream.end();
}

main().catch(e => {
  console.error("Exporter hata:", e);
  process.exit(1);
});
