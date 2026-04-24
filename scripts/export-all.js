// Export-Script: Zieht alle Tabellen aus der Supabase in JSON-Files.
// Ergebnis: data-export/vendors.json, models.json, model_versions.json, licenses.json, atlas_meta.json
// Verwendung: npm run export-all
import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'data-export');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE) {
  console.error('Fehler: SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in .env.local erforderlich.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Pagination, weil default-Limit bei Supabase 1000 ist
async function fetchAll(table, orderBy) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select('*').order(orderBy, { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    all = all.concat(data || []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  console.log('BVDW Atlas — Export aller Tabellen\n');
  mkdirSync(OUT, { recursive: true });

  const tables = [
    { name: 'vendors', order: 'slug' },
    { name: 'atlas_meta', order: 'atlas' },
    { name: 'licenses', order: 'atlas' },
    { name: 'models', order: 'atlas' },
    { name: 'model_versions', order: 'id' }
  ];

  const summary = {};
  for (const t of tables) {
    const rows = await fetchAll(t.name, t.order);
    const file = join(OUT, `${t.name}.json`);
    writeFileSync(file, JSON.stringify(rows, null, 2));
    summary[t.name] = rows.length;
    console.log(`✓ ${t.name}: ${rows.length} Einträge → ${file}`);
  }

  // Manifest mit Export-Metadaten
  const manifest = {
    exported_at: new Date().toISOString(),
    source: SUPABASE_URL,
    tables: summary,
    notes: 'Vollständiger Export für Migration. Kann mit scripts/import-all.js in eine leere Supabase-Instanz importiert werden.'
  };
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n✓ manifest.json geschrieben`);
  console.log('\nNächster Schritt (in der neuen BVDW-Umgebung):');
  console.log('  1. Schema anlegen (supabase/schema.sql im Supabase-SQL-Editor ausführen)');
  console.log('  2. .env.local mit den BVDW-Supabase-Credentials ausstatten');
  console.log('  3. npm run import-all');
}

main().catch(err => {
  console.error('\n✗ Export-Fehler:', err.message || err);
  process.exit(1);
});
