// BVDW Foundation Models Atlas — DB-Initialisierung
// Verwendung: npm run init-db
// Liest supabase/schema.sql und führt es gegen die Supabase-Postgres aus.

import pg from 'pg';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '..', 'supabase', 'schema.sql');
const schema = readFileSync(schemaPath, 'utf-8');

// Pooler bevorzugen (IPv4-sicher), Direct-Connection als Fallback
const DB_URL = process.env.SUPABASE_DB_URL_POOLER || process.env.SUPABASE_DB_URL;
if (!DB_URL) {
  console.error('Fehler: SUPABASE_DB_URL_POOLER oder SUPABASE_DB_URL muss in .env.local gesetzt sein.');
  console.error('Starte das Script mit: npm run init-db');
  process.exit(1);
}

const { Client } = pg;
const client = new Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('BVDW Foundation Models Atlas — init-db');
  console.log('→ Verbinde mit Supabase...');
  try {
    await client.connect();
  } catch (err) {
    console.error('✗ Verbindung fehlgeschlagen:', err.message);
    if (err.code === 'ENETUNREACH' || err.code === 'EAI_AGAIN' || err.message.includes('IPv6')) {
      console.error('→ Hinweis: IPv6-Problem erkannt. Stelle sicher, dass SUPABASE_DB_URL_POOLER in .env.local gesetzt ist (aws-0-eu-central-1.pooler.supabase.com).');
    }
    process.exit(1);
  }
  console.log('✓ Verbunden.');

  try {
    console.log('→ Führe Schema aus (supabase/schema.sql)...');
    await client.query(schema);
    console.log('✓ Schema ausgeführt.');

    console.log('→ Prüfe Tabellen...');
    const { rows: tables } = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('models', 'model_versions', 'licenses', 'atlas_meta')
      ORDER BY tablename
    `);
    console.log('✓ Tabellen vorhanden:', tables.map(r => r.tablename).join(', '));

    console.log('→ Prüfe RLS...');
    const { rows: rls } = await client.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('models', 'model_versions', 'licenses', 'atlas_meta')
      ORDER BY tablename
    `);
    rls.forEach(r => console.log(`   ${r.tablename}: RLS = ${r.rowsecurity}`));

    console.log('\n✓ init-db erfolgreich. Nächster Schritt: npm run import');
  } catch (err) {
    console.error('✗ SQL-Fehler:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
