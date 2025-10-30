// scripts/seed_one.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE;

if (!url || !serviceKey) {
  console.error('Supabase URL veya SERVICE_ROLE eksik.');
  console.error('URL:', url ? 'Var' : 'Eksik');
  console.error('SERVICE_ROLE:', serviceKey ? 'Var' : 'Eksik');
  process.exit(1);
}

const admin = createClient(url, serviceKey);

async function getOrCreateTaxon(canonicalName, rank) {
  // 1) Var mı?
  let { data: existing, error: selErr } = await admin
    .from('taxon')
    .select('id')
    .eq('canonical_name', canonicalName)
    .eq('rank', rank)
    .limit(1)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing) return existing.id;

  // 2) Yoksa oluştur
  const { data, error } = await admin
    .from('taxon')
    .insert({ canonical_name: canonicalName, rank })
    .select('id')
    .single();
  if (error) throw error;

  return data.id;
}

async function insertName(taxonId, name, lang, isScientific, source = 'manual') {
  // Aynı isim zaten ekli ise tekrar etmeyelim (idempotent)
  const { data: exist, error: selErr } = await admin
    .from('taxon_name')
    .select('id')
    .eq('taxon_id', taxonId)
    .eq('name', name)
    .eq('lang', lang)
    .eq('is_scientific', isScientific)
    .limit(1)
    .maybeSingle();
  if (selErr) throw selErr;
  if (exist) return;

  const { error } = await admin
    .from('taxon_name')
    .insert({ taxon_id: taxonId, name, lang, is_scientific: isScientific, source });
  if (error) throw error;
}

async function main() {
  const taxonId = await getOrCreateTaxon('Panthera pardus', 'species');

  await insertName(taxonId, 'Anadolu parsı', 'tr', false);
  await insertName(taxonId, 'Panthera pardus', 'la', true);

  console.log('Hazır! taxon_id =', taxonId);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});