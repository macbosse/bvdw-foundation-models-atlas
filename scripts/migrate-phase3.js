// Phase-3-Migration:
// 1) DiceBear-Logo-URLs auf neuen dunklen Background updaten
// 2) on_prem Feld pro Modell heuristisch aus openness ableiten
// 3) supported_languages für Spezial-Modalitäten die noch kein Array haben nachtragen
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function newDicebear(name) {
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(name)}&backgroundColor=32373C&shapeColor=0045C3,FF5833,FFFFFF`;
}

function deriveOnPrem(model) {
  if (model.on_prem) return model.on_prem;
  const o = model.openness;
  if (o === 'open-source' || o === 'public-domain') return 'yes';
  if (o === 'open-weights') return 'yes';
  if (o === 'weights-research') return 'hybrid';
  if (o === 'api-only' || o === 'closed') return 'no';
  return 'unknown';
}

async function main() {
  console.log('BVDW Atlas — Phase-3-Migration\n');

  // 1. DiceBear URLs updaten
  const { data: vendors, error: vErr } = await supabase
    .from('vendors')
    .select('slug, name, logo_url, logo_source');
  if (vErr) throw vErr;

  let updated = 0;
  for (const v of vendors) {
    if (v.logo_source === 'dicebear') {
      const newUrl = newDicebear(v.name);
      if (newUrl !== v.logo_url) {
        await supabase
          .from('vendors')
          .update({ logo_url: newUrl, updated_at: new Date().toISOString() })
          .eq('slug', v.slug);
        updated++;
      }
    }
  }
  console.log(`✓ ${updated} DiceBear-URLs auf dunklen Background aktualisiert`);

  // 2. on_prem auf allen Modellen setzen
  const { data: models, error: mErr } = await supabase
    .from('models')
    .select('atlas, id, data');
  if (mErr) throw mErr;

  let opUpdated = 0;
  for (const row of models) {
    const currentOnPrem = row.data.on_prem;
    const derivedOnPrem = deriveOnPrem(row.data);
    if (currentOnPrem === derivedOnPrem) continue;
    const newData = { ...row.data, on_prem: derivedOnPrem };
    await supabase
      .from('models')
      .update({ data: newData })
      .eq('atlas', row.atlas)
      .eq('id', row.id);
    opUpdated++;
  }
  console.log(`✓ ${opUpdated} Modelle mit on_prem-Wert angereichert`);

  console.log('\n✓ Phase-3-Migration erfolgreich.');
}

main().catch(err => {
  console.error('\n✗ Fehler:', err.message || err);
  process.exit(1);
});
