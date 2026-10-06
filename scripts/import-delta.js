// Delta-Import: Spielt ein Update-Paket (data/updates/<id>.json) idempotent in Supabase ein.
// Im Gegensatz zu import-all.js (Voll-Restore) und import.js (Erst-Import) arbeitet dieses
// Script wie ein Redakteur im Edit-Mode: jede Änderung erzeugt eine neue Version mit
// Snapshot in model_versions, Löschungen sind Soft-Deletes, Patches sind Merge-Updates.
//
// Verwendung:
//   npm run import-delta -- data/updates/2026-10-update.json            # schreibt
//   npm run import-delta -- data/updates/2026-10-update.json --dry-run  # zeigt nur den Plan
//
// Paketformat (alle Blöcke optional):
// {
//   "update_id": "2026-10",
//   "editor": "AI Tech Lab — Update Okt 2026",
//   "summary": "Kurzbeschreibung für die Historie",
//   "vendors":  [ { "slug", "name", "country", "website" } ],              // nur neu anlegen, nie Logos überschreiben
//   "licenses": [ { "atlas", "id", "data": {...} } ],                      // Upsert
//   "atlas_meta_patch": { "<atlas>": { ...Felder..., "filters": { "<key>": [ ...Werte zum Ergänzen... ] } } },
//   "models":   [ { "atlas", "data": { "id", ...vollständiges Modell... } } ], // neu anlegen; re-run korrigiert eigene Einträge
//   "patches":  [ { "atlas", "id", "set": {...}, "unset": [...], "summary" } ],  // Merge-Update bestehender Einträge
//   "deletions":[ { "atlas", "id", "reason" } ]                            // Soft-Delete wie /api/delete
// }
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const file = args.find(a => !a.startsWith('--'));
if (!file) {
  console.error('Verwendung: node scripts/import-delta.js <data/updates/paket.json> [--dry-run]');
  process.exit(1);
}
const path = resolve(file);
if (!existsSync(path)) { console.error(`Datei nicht gefunden: ${path}`); process.exit(1); }
const delta = JSON.parse(readFileSync(path, 'utf-8'));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
if (!SUPABASE_URL || !SUPABASE_SERVICE) {
  console.error('Fehler: SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in .env.local erforderlich.');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL.trim(), SUPABASE_SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const EDITOR = String(delta.editor || `delta-import ${delta.update_id || ''}`).trim().slice(0, 80);
const UPDATE_ID = delta.update_id || 'delta';
const BASE_SUMMARY = delta.summary || `Update ${UPDATE_ID}`;
const ATLASES = ['conversational', 'specialized'];

const stats = { vendors_new: 0, licenses: 0, meta: 0, models_new: 0, models_corrected: 0, models_skipped: 0, patched: 0, patches_noop: 0, deleted: 0, warnings: 0 };
const warn = msg => { stats.warnings++; console.warn('  ⚠ ' + msg); };

function slugify(s) {
  return String(s || '').toLowerCase()
    .replace(/ö/g, 'oe').replace(/ä/g, 'ae').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
// Stabile Serialisierung für Vergleich (Key-Reihenfolge egal)
function stable(obj) {
  if (Array.isArray(obj)) return '[' + obj.map(stable).join(',') + ']';
  if (obj && typeof obj === 'object') return '{' + Object.keys(obj).sort().map(k => JSON.stringify(k) + ':' + stable(obj[k])).join(',') + '}';
  return JSON.stringify(obj);
}
function assertAtlas(atlas, ctx) {
  if (!ATLASES.includes(atlas)) throw new Error(`${ctx}: atlas muss conversational|specialized sein, ist "${atlas}"`);
}
async function loadModel(atlas, id) {
  const { data, error } = await supabase.from('models').select('current_version, data, updated_by').eq('atlas', atlas).eq('id', id).maybeSingle();
  if (error) throw new Error(`models load ${atlas}/${id}: ${error.message}`);
  return data;
}
async function writeVersion(atlas, id, version, data, summary, { insert = false } = {}) {
  const now = new Date().toISOString();
  if (DRY) return;
  if (insert) {
    const { error } = await supabase.from('models').insert({ atlas, id, data, current_version: version, updated_at: now, updated_by: EDITOR });
    if (error) throw new Error(`models insert ${atlas}/${id}: ${error.message}`);
  } else {
    const { error } = await supabase.from('models').update({ data, current_version: version, updated_at: now, updated_by: EDITOR }).eq('atlas', atlas).eq('id', id);
    if (error) throw new Error(`models update ${atlas}/${id}: ${error.message}`);
  }
  // Idempotenz: Snapshot nur anlegen, wenn diese Version noch nicht existiert
  const { data: existing, error: vLoadErr } = await supabase.from('model_versions').select('id').eq('atlas', atlas).eq('model_id', id).eq('version', version).maybeSingle();
  if (vLoadErr) throw new Error(`model_versions check ${atlas}/${id}: ${vLoadErr.message}`);
  if (existing) return;
  const { error: vErr } = await supabase.from('model_versions').insert({ atlas, model_id: id, version, data, edited_by: EDITOR, edit_summary: summary.slice(0, 500) });
  if (vErr) throw new Error(`model_versions insert ${atlas}/${id}: ${vErr.message}`);
}
function normalizeModel(atlas, data) {
  const d = { ...data };
  if (!d.id) throw new Error(`Modell ohne id (${atlas}): ${d.name || '?'}`);
  d.id = slugify(d.id);
  if (!d.vendor_slug) d.vendor_slug = slugify(d.vendor || '');
  if (atlas === 'conversational') {
    if (!d.supported_languages) d.supported_languages = ['en'];
    if (!d.modalities) d.modalities = ['text'];
  }
  if (!d.huggingface_url && typeof d.weights === 'string' && d.weights.includes('huggingface.co')) d.huggingface_url = d.weights;
  if (d.image_url === undefined) d.image_url = null;
  if (d.hero_image_url === undefined) d.hero_image_url = null;
  return d;
}

async function run() {
  console.log(`BVDW Atlas — Delta-Import ${UPDATE_ID}${DRY ? ' (DRY-RUN, es wird nichts geschrieben)' : ''}`);
  console.log(`Ziel: ${SUPABASE_URL}\nEditor: ${EDITOR}\n`);

  // 1. Vendors — nur anlegen, bestehende (inkl. gepflegter Logos) nie anfassen
  for (const v of delta.vendors || []) {
    const slug = slugify(v.slug || v.name);
    const { data: ex, error } = await supabase.from('vendors').select('slug').eq('slug', slug).maybeSingle();
    if (error) throw new Error(`vendors ${slug}: ${error.message}`);
    if (ex) continue;
    console.log(`  + vendor ${slug}`);
    stats.vendors_new++;
    if (!DRY) {
      const { error: iErr } = await supabase.from('vendors').insert({ slug, name: v.name || slug, country: v.country || null, website: v.website || null, logo_url: v.logo_url || null, logo_source: v.logo_source || null, brand_color: v.brand_color || null, updated_at: new Date().toISOString() });
      if (iErr) throw new Error(`vendors insert ${slug}: ${iErr.message}`);
    }
  }

  // 2. Lizenzen — Upsert
  for (const l of delta.licenses || []) {
    assertAtlas(l.atlas, `license ${l.id}`);
    console.log(`  ~ license ${l.atlas}/${l.id}`);
    stats.licenses++;
    if (!DRY) {
      const { error } = await supabase.from('licenses').upsert({ atlas: l.atlas, id: l.id, data: l.data, updated_at: new Date().toISOString() }, { onConflict: 'atlas,id' });
      if (error) throw new Error(`licenses upsert ${l.id}: ${error.message}`);
    }
  }

  // 3. atlas_meta — Merge: Skalare überschreiben, Filter-Listen ergänzen (Reihenfolge bleibt)
  for (const [atlas, patch] of Object.entries(delta.atlas_meta_patch || {})) {
    assertAtlas(atlas, 'atlas_meta_patch');
    const { data: row, error } = await supabase.from('atlas_meta').select('data').eq('atlas', atlas).maybeSingle();
    if (error) throw new Error(`atlas_meta ${atlas}: ${error.message}`);
    const cur = row?.data || {};
    const next = { ...cur };
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'filters' && v && typeof v === 'object') {
        next.filters = { ...(cur.filters || {}) };
        for (const [fk, list] of Object.entries(v)) {
          const merged = [...(next.filters[fk] || [])];
          for (const item of list) if (!merged.includes(item)) merged.push(item);
          next.filters[fk] = merged;
        }
      } else if (k === 'fields_explanation' && v && typeof v === 'object') {
        next.fields_explanation = { ...(cur.fields_explanation || {}), ...v };
      } else {
        next[k] = v;
      }
    }
    if (stable(next) === stable(cur)) { console.log(`  = atlas_meta ${atlas} unverändert`); continue; }
    console.log(`  ~ atlas_meta ${atlas}: ${Object.keys(patch).join(', ')}`);
    stats.meta++;
    if (!DRY) {
      const { error: uErr } = await supabase.from('atlas_meta').upsert({ atlas, data: next, updated_at: new Date().toISOString() }, { onConflict: 'atlas' });
      if (uErr) throw new Error(`atlas_meta upsert ${atlas}: ${uErr.message}`);
    }
  }

  // 4. Neue Modelle
  for (const entry of delta.models || []) {
    assertAtlas(entry.atlas, `model ${entry.data?.id}`);
    const data = normalizeModel(entry.atlas, entry.data);
    const cur = await loadModel(entry.atlas, data.id);
    if (!cur) {
      console.log(`  + model ${entry.atlas}/${data.id}  (${data.name})`);
      stats.models_new++;
      await writeVersion(entry.atlas, data.id, 1, data, `Neu angelegt — ${BASE_SUMMARY}`, { insert: true });
      continue;
    }
    if (stable(cur.data) === stable(data)) { stats.models_skipped++; continue; }
    if (cur.updated_by !== EDITOR) {
      warn(`model ${entry.atlas}/${data.id} existiert bereits und wurde zuletzt von "${cur.updated_by}" bearbeitet — übersprungen (für gezielte Änderungen "patches" nutzen)`);
      stats.models_skipped++;
      continue;
    }
    console.log(`  ~ model ${entry.atlas}/${data.id} korrigiert (v${cur.current_version + 1})`);
    stats.models_corrected++;
    await writeVersion(entry.atlas, data.id, cur.current_version + 1, data, `Korrektur — ${BASE_SUMMARY}`);
  }

  // 5. Patches auf bestehende Modelle
  for (const p of delta.patches || []) {
    assertAtlas(p.atlas, `patch ${p.id}`);
    const cur = await loadModel(p.atlas, p.id);
    if (!cur) { warn(`patch ${p.atlas}/${p.id}: Modell nicht gefunden`); continue; }
    const next = { ...cur.data, ...(p.set || {}) };
    for (const k of p.unset || []) delete next[k];
    next.id = p.id;
    if (stable(next) === stable(cur.data)) { stats.patches_noop++; continue; }
    console.log(`  ~ patch ${p.atlas}/${p.id}: ${Object.keys(p.set || {}).join(', ')}${p.unset?.length ? ' −' + p.unset.join(',') : ''}`);
    stats.patched++;
    await writeVersion(p.atlas, p.id, cur.current_version + 1, next, p.summary || BASE_SUMMARY);
  }

  // 6. Soft-Deletes
  for (const d of delta.deletions || []) {
    assertAtlas(d.atlas, `deletion ${d.id}`);
    const cur = await loadModel(d.atlas, d.id);
    if (!cur) { warn(`deletion ${d.atlas}/${d.id}: Modell nicht gefunden`); continue; }
    if (cur.data?._deleted) continue;
    const now = new Date().toISOString();
    const next = { ...cur.data, _deleted: true, _deleted_at: now, _deleted_by: EDITOR, _deleted_reason: d.reason || null };
    console.log(`  − delete ${d.atlas}/${d.id}: ${d.reason || ''}`);
    stats.deleted++;
    await writeVersion(d.atlas, d.id, cur.current_version + 1, next, d.reason ? `Gelöscht: ${d.reason}` : 'Gelöscht');
  }

  console.log('\nErgebnis:', JSON.stringify(stats));
  if (!DRY) {
    for (const atlas of ATLASES) {
      const { count } = await supabase.from('models').select('id', { count: 'exact', head: true }).eq('atlas', atlas);
      console.log(`  ${atlas}: ${count} Einträge (inkl. soft-deleted)`);
    }
  }
}

run().catch(err => { console.error('\n✗ Delta-Import-Fehler:', err.message || err); process.exit(1); });
