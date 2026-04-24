// Import-Script: Liest data-export/*.json und schreibt in eine leere Supabase-Instanz.
// Reihenfolge wichtig: zuerst Vendors, dann Meta, Licenses, dann Models, zuletzt Versionen.
// Idempotent durch Upsert, kann erneut ausgeführt werden.
// Verwendung: npm run import-all
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const IN = join(__dirname, '..', 'data-export');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE) {
  console.error('Fehler: SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in .env.local erforderlich.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function loadJson(name) {
  const path = join(IN, `${name}.json`);
  if (!existsSync(path)) {
    throw new Error(`Datei nicht gefunden: ${path}\n→ Zuerst npm run export-all ausführen oder data-export/ vorliegen haben.`);
  }
  return JSON.parse(readFileSync(path, 'utf-8'));
}

async function upsertBatch(table, rows, onConflict, batchSize = 200) {
  let done = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw new Error(`${table} batch ${i}: ${error.message}`);
    done += batch.length;
    process.stdout.write(`  ${done}/${rows.length}\r`);
  }
  process.stdout.write('\n');
}

async function main() {
  console.log('BVDW Atlas — Import in Ziel-Supabase\n');
  console.log(`Ziel: ${SUPABASE_URL}\n`);

  if (!existsSync(IN)) {
    console.error('Fehler: data-export/ nicht gefunden.');
    console.error('→ Zuerst in der Quell-Umgebung npm run export-all ausführen und data-export/ übertragen.');
    process.exit(1);
  }

  // 1. Vendors (keine Abhängigkeiten)
  const vendors = loadJson('vendors');
  console.log(`→ Importiere ${vendors.length} vendors...`);
  await upsertBatch('vendors', vendors, 'slug');

  // 2. atlas_meta
  const meta = loadJson('atlas_meta');
  console.log(`→ Importiere ${meta.length} atlas_meta...`);
  await upsertBatch('atlas_meta', meta, 'atlas');

  // 3. licenses (PK = atlas+id)
  const licenses = loadJson('licenses');
  console.log(`→ Importiere ${licenses.length} licenses...`);
  await upsertBatch('licenses', licenses, 'atlas,id');

  // 4. models (PK = atlas+id)
  const models = loadJson('models');
  console.log(`→ Importiere ${models.length} models...`);
  await upsertBatch('models', models, 'atlas,id');

  // 5. model_versions (hat BIGSERIAL id, upsert auf id)
  const versions = loadJson('model_versions');
  console.log(`→ Importiere ${versions.length} model_versions...`);
  await upsertBatch('model_versions', versions, 'id');

  console.log('\n✓ Import erfolgreich.');
  console.log('\nKontrolle per SQL-Query in Supabase:');
  console.log('  SELECT COUNT(*) FROM vendors;');
  console.log('  SELECT COUNT(*) FROM models;');
  console.log('  SELECT COUNT(*) FROM model_versions;');
}

main().catch(err => {
  console.error('\n✗ Import-Fehler:', err.message || err);
  process.exit(1);
});
