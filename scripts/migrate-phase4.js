// Phase-4-Migration:
// Entfernt initiale Clearbit-image_urls aus unedited Modellen (current_version === 1),
// damit das neue vendor_info.logo_url automatisch greift.
// Manuelle Overrides (version > 1 oder Non-Clearbit-URL) bleiben unberührt.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
  console.log('BVDW Atlas — Phase-4-Migration (alte Clearbit-Image-URLs räumen)\n');

  const { data: models, error } = await supabase
    .from('models')
    .select('atlas, id, data, current_version');
  if (error) throw error;

  let cleared = 0, skipped = 0;
  for (const row of models) {
    const img = row.data?.image_url;
    if (!img) { skipped++; continue; }
    // Nur Clearbit-Defaults aus dem Initial-Import räumen
    const isClearbit = /logo\.clearbit\.com/.test(img);
    if (!isClearbit) { skipped++; continue; }
    // Nur wenn das Modell noch nie editiert wurde
    if ((row.current_version || 1) > 1) { skipped++; continue; }

    const newData = { ...row.data };
    delete newData.image_url;
    const { error: uErr } = await supabase
      .from('models')
      .update({ data: newData })
      .eq('atlas', row.atlas)
      .eq('id', row.id);
    if (uErr) { console.error(`${row.id}: ${uErr.message}`); continue; }
    cleared++;
  }
  console.log(`✓ ${cleared} Clearbit-image_urls entfernt, ${skipped} übersprungen`);
  console.log('\n✓ Phase-4-Migration erfolgreich.');
}

main().catch(err => {
  console.error('\n✗ Fehler:', err.message || err);
  process.exit(1);
});
