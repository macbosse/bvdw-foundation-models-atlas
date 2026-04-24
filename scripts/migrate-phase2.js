// Phase-2-Migration:
// 1) Vendors aus allen Modellen extrahieren, dedupen, slugifizieren → vendors-Tabelle
// 2) Modelle mit vendor_slug + supported_languages anreichern (heuristisch)
// 3) Kein Version-Snapshot (ist keine User-Edit, sondern Schema-Migration)
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE) {
  console.error('Fehler: SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY erforderlich.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// ─── Slugify ───────────────────────────────────────────────────────────────
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ö/g, 'oe').replace(/ä/g, 'ae').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'unknown';
}

// ─── Heuristische Sprach-Ableitung ─────────────────────────────────────────
const REGION_LANGUAGES = {
  DACH: ['de', 'en'],
  EU: ['en'],
  US: ['en'],
  CN: ['zh', 'en'],
  KR: ['ko', 'en'],
  JP: ['ja', 'en'],
  IN: ['en', 'hi'],
  MENA: ['ar', 'en'],
  AF: ['en'],
  RU: ['ru', 'en'],
  INTL: ['en']
};

const COUNTRY_LANGUAGES = {
  DE: ['de', 'en'], AT: ['de', 'en'], CH: ['de', 'fr', 'it', 'en'],
  FR: ['fr', 'en'], ES: ['es', 'en'], IT: ['it', 'en'],
  NL: ['nl', 'en'], BE: ['nl', 'fr', 'en'], SE: ['sv', 'en'],
  FI: ['fi', 'sv', 'en'], NO: ['no', 'en'], DK: ['da', 'en'],
  PL: ['pl', 'en'], GB: ['en'], IE: ['en'], PT: ['pt', 'en'],
  CZ: ['cs', 'en'], RO: ['ro', 'en'], GR: ['el', 'en'],
  US: ['en'], CA: ['en', 'fr'], AU: ['en'], NZ: ['en'],
  CN: ['zh', 'en'], TW: ['zh', 'en'], HK: ['zh', 'en'],
  JP: ['ja', 'en'], KR: ['ko', 'en'],
  IN: ['en', 'hi'], PK: ['ur', 'en'], BD: ['bn', 'en'],
  AE: ['ar', 'en'], SA: ['ar', 'en'], IL: ['he', 'en', 'ar'],
  ZA: ['en'], NG: ['en'], KE: ['en', 'sw'],
  RU: ['ru', 'en'], BY: ['ru', 'en'], UA: ['uk', 'ru', 'en'],
  BR: ['pt', 'en'], MX: ['es', 'en']
};

function deriveLanguages(model) {
  // Wenn bereits gesetzt, behalten
  if (Array.isArray(model.supported_languages) && model.supported_languages.length > 0) {
    return model.supported_languages;
  }
  const langs = new Set();

  // Country hat Vorrang vor Region
  const country = (model.country || '').toUpperCase().slice(0, 2);
  const fromCountry = COUNTRY_LANGUAGES[country];
  if (fromCountry) fromCountry.forEach(l => langs.add(l));

  // Region als Ergänzung/Fallback
  const regionLangs = REGION_LANGUAGES[model.region];
  if (regionLangs) regionLangs.forEach(l => langs.add(l));

  // Deutsch bei High-Capability separat sicherstellen
  if (model.german_capability === 'high' || model.german_capability === 'medium') {
    langs.add('de');
  }

  // Englisch als globales Fallback
  langs.add('en');

  // Text-Hinweise aus insider/specs
  const text = ((model.insider || '') + ' ' + (model.specs || []).join(' ')).toLowerCase();
  if (/multilingual|mehrsprachig|sprachen/.test(text)) {
    // Signal dass viele Sprachen → keine Auto-Erweiterung, aber mindestens EU-Core sichern
    ['de', 'fr', 'es', 'it'].forEach(l => langs.add(l));
  }
  if (/arabisch|arabic|jais|falcon/.test(text)) langs.add('ar');
  if (/chinesisch|mandarin|chinese|qwen|deepseek|yi\b|glm|kimi|hunyuan|baichuan/.test(text)) langs.add('zh');
  if (/japanisch|japanese|elyza|sakana|plamo|calm/.test(text)) langs.add('ja');
  if (/koreanisch|korean|exaone|solar|hyperclova/.test(text)) langs.add('ko');
  if (/tamil|hindi|bharat|sarvam|krutrim|openhathi/.test(text)) langs.add('hi');

  // Max 8 Sprachen pro Karte, damit die Flag-Reihe nicht überquillt
  return Array.from(langs).slice(0, 8);
}

// ─── Normalisiere modalities ───────────────────────────────────────────────
function normalizeModalities(model, atlas) {
  if (Array.isArray(model.modalities) && model.modalities.length > 0) return model.modalities;
  if (atlas === 'specialized') {
    const mods = [];
    if (model.modality_in) mods.push(...String(model.modality_in).split(/[,+/]/).map(s => s.trim().toLowerCase()).filter(Boolean));
    if (model.modality_out) mods.push(...String(model.modality_out).split(/[,+/]/).map(s => s.trim().toLowerCase()).filter(Boolean));
    return [...new Set(mods)];
  }
  return ['text'];
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function migrate() {
  console.log('BVDW Atlas — Phase-2-Migration\n');

  // 1. Alle Modelle holen
  const { data: allModels, error: mErr } = await supabase
    .from('models')
    .select('atlas, id, data')
    .order('atlas', { ascending: true });
  if (mErr) throw mErr;
  console.log(`Gefunden: ${allModels.length} Modelle`);

  // 2. Vendors extrahieren
  const vendorMap = new Map();
  for (const row of allModels) {
    const vname = (row.data?.vendor || '').trim();
    if (!vname) continue;
    const slug = slugify(vname);
    if (!vendorMap.has(slug)) {
      vendorMap.set(slug, {
        slug,
        name: vname,
        country: row.data?.country || null,
        website: row.data?.url || null
      });
    }
  }
  console.log(`Extrahiert: ${vendorMap.size} unique Vendors`);

  // 3. Vendors upserten
  const vendorRows = Array.from(vendorMap.values()).map(v => ({
    ...v,
    updated_at: new Date().toISOString()
  }));
  const { error: vErr } = await supabase.from('vendors').upsert(vendorRows, { onConflict: 'slug' });
  if (vErr) throw vErr;
  console.log(`✓ ${vendorRows.length} Vendors geschrieben`);

  // 4. Modelle anreichern
  let updated = 0;
  for (const row of allModels) {
    const vendorSlug = slugify(row.data?.vendor || 'unknown');
    const languages = deriveLanguages(row.data);
    const modalities = normalizeModalities(row.data, row.atlas);
    const needsUpdate =
      row.data.vendor_slug !== vendorSlug ||
      JSON.stringify(row.data.supported_languages || []) !== JSON.stringify(languages) ||
      JSON.stringify(row.data.modalities || []) !== JSON.stringify(modalities);
    if (!needsUpdate) continue;
    const newData = {
      ...row.data,
      vendor_slug: vendorSlug,
      supported_languages: languages,
      modalities
    };
    const { error } = await supabase
      .from('models')
      .update({ data: newData })
      .eq('atlas', row.atlas)
      .eq('id', row.id);
    if (error) {
      console.error(`  Fehler bei ${row.atlas}/${row.id}: ${error.message}`);
      continue;
    }
    updated++;
  }
  console.log(`✓ ${updated} Modelle aktualisiert (vendor_slug + supported_languages + modalities)`);

  console.log('\n✓ Phase-2-Migration erfolgreich.');
}

migrate().catch(err => {
  console.error('\n✗ Unerwarteter Fehler:', err.message || err);
  process.exit(1);
});
