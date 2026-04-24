// BVDW Foundation Models Atlas — Initial-Import
// Verwendung: npm run import
// Liest models.json und specialized_models.json und importiert sie einmalig nach Supabase.
// Insert-only: schon vorhandene Einträge werden NICHT überschrieben, damit spätere Edits erhalten bleiben.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE) {
  console.error('Fehler: SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in .env.local erforderlich.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// ─────────────────────────────────────────────────────────────────────────────
// Image-URL-Anreicherung
// ─────────────────────────────────────────────────────────────────────────────

function extractDomain(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    let host = u.hostname;
    if (host.startsWith('www.')) host = host.slice(4);
    return host;
  } catch {
    return null;
  }
}

// Logo-URL-Fallback-Kette:
// 1) image_url im Quell-JSON bereits gesetzt → beibehalten
// 2) Clearbit-Logo-Service mit Vendor-Domain
// 3) null (Frontend-Fallback auf DiceBear-Initial, siehe index.html)
function generateLogoUrl(model) {
  if (model.image_url) return model.image_url;
  const domain = extractDomain(model.url);
  if (!domain) return null;
  return `https://logo.clearbit.com/${domain}`;
}

// Hero-Image bleibt initial null. Frontend rendert dann einen CSS-Gradient
// basierend auf Tier und Region. Das BVDW-Team kann pro Modell eigene
// Hero-Bilder im Edit-Mode einfügen.
function generateHeroUrl(model) {
  return model.hero_image_url || null;
}

function enrichModel(model) {
  return {
    ...model,
    image_url: generateLogoUrl(model),
    hero_image_url: generateHeroUrl(model)
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Import pro Atlas
// ─────────────────────────────────────────────────────────────────────────────

async function importAtlas(atlas, jsonFile) {
  console.log(`\n=== Atlas: ${atlas}  (Quelle: ${jsonFile}) ===`);
  const raw = readFileSync(join(ROOT, jsonFile), 'utf-8');
  const data = JSON.parse(raw);

  // 1) Meta upserten — inkl. filters-Sektion, die in der Quell-JSON auf Top-Level liegt
  const metaPayload = { ...data.meta, filters: data.filters || {} };
  const { error: metaErr } = await supabase
    .from('atlas_meta')
    .upsert({ atlas, data: metaPayload, updated_at: new Date().toISOString() }, { onConflict: 'atlas' });
  if (metaErr) throw new Error(`atlas_meta upsert: ${metaErr.message}`);
  console.log(`✓ Meta gespeichert (inkl. ${Object.keys(data.filters || {}).length} Filter-Gruppen)`);

  // 2) Lizenzen (insert-only)
  const { data: existingLic, error: lErr } = await supabase
    .from('licenses').select('id').eq('atlas', atlas);
  if (lErr) throw new Error(`licenses select: ${lErr.message}`);
  const existingLicIds = new Set((existingLic || []).map(x => x.id));
  const licEntries = Object.entries(data.licenses || {}).map(([id, licData]) => ({
    atlas, id, data: licData
  }));
  const licToInsert = licEntries.filter(l => !existingLicIds.has(l.id));
  if (licToInsert.length > 0) {
    const { error } = await supabase.from('licenses').insert(licToInsert);
    if (error) throw new Error(`licenses insert: ${error.message}`);
  }
  console.log(`✓ Lizenzen: ${licToInsert.length} neu, ${existingLicIds.size} vorhanden`);

  // 3) Modelle (insert-only, Batch-Insert)
  const { data: existingModels, error: mSelErr } = await supabase
    .from('models').select('id').eq('atlas', atlas);
  if (mSelErr) throw new Error(`models select: ${mSelErr.message}`);
  const existingIds = new Set((existingModels || []).map(x => x.id));

  const modelsToInsert = [];
  const versionsToInsert = [];
  let skipped = 0;
  for (const model of data.models || []) {
    if (existingIds.has(model.id)) { skipped++; continue; }
    const enriched = enrichModel(model);
    modelsToInsert.push({
      atlas,
      id: model.id,
      data: enriched,
      current_version: 1,
      updated_by: 'import-script'
    });
    versionsToInsert.push({
      atlas,
      model_id: model.id,
      version: 1,
      data: enriched,
      edited_by: 'import-script',
      edit_summary: 'Initialer Import aus JSON'
    });
  }

  if (modelsToInsert.length > 0) {
    const { error: mErr } = await supabase.from('models').insert(modelsToInsert);
    if (mErr) throw new Error(`models insert: ${mErr.message}`);
    const { error: vErr } = await supabase.from('model_versions').insert(versionsToInsert);
    if (vErr) throw new Error(`model_versions insert: ${vErr.message}`);
  }
  console.log(`✓ Modelle: ${modelsToInsert.length} neu, ${skipped} vorhanden`);

  return { new: modelsToInsert.length, skipped };
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('BVDW Foundation Models Atlas — Import');
  const c = await importAtlas('conversational', 'models.json');
  const s = await importAtlas('specialized', 'specialized_models.json');
  console.log(`\n✓ Import erfolgreich.`);
  console.log(`  Konversational: ${c.new} neu, ${c.skipped} übersprungen`);
  console.log(`  Spezial:        ${s.new} neu, ${s.skipped} übersprungen`);
  console.log('\nNächster Schritt: API-Routes + Frontend umbauen.');
}

main().catch(err => {
  console.error('\n✗ Unerwarteter Fehler:', err.message || err);
  process.exit(1);
});
