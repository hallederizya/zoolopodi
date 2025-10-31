// scripts/filter_to_animalia.ts
import fs from "node:fs";

async function isAnimalia(name: string) {
  const u = new URL("https://api.gbif.org/v1/species/match");
  u.searchParams.set("name", name);
  const r = await fetch(u.toString());
  if (!r.ok) return false;
  const j = await r.json();
  return (j?.kingdom === "Animalia") || (j?.kingdomKey === 1);
}

async function main() {
  const src = "data/gbif_animalia_species.txt";
  const dst = "data/gbif_animalia_species.clean.txt";

  const lines = fs.readFileSync(src, "utf-8").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const out = fs.createWriteStream(dst, { flags: "w" });

  let ok = 0, skip = 0;
  for (const line of lines) {
    try {
      const yes = await isAnimalia(line);
      if (yes) { out.write(line + "\n"); ok++; }
      else { skip++; }
      await new Promise(r => setTimeout(r, 120)); // kibar gecikme
    } catch { skip++; }
  }
  out.end();
  console.log(`Temizlendi → OK: ${ok}, atılan: ${skip}. Yazıldı: ${dst}`);
}

main().catch(e => { console.error(e); process.exit(1); });
