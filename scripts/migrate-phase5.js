// Phase-5-Migration:
// Extrahiert die Hugging-Face-Model-Card-URL aus der 'weights'-URL oder den 'sources',
// schreibt sie in data.huggingface_url. Idempotent, überschreibt nicht wenn bereits gesetzt.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Akzeptable HF-Model-URL-Muster:
//   https://huggingface.co/{org}/{model}[?/#anything]
//   https://hf.co/{org}/{model}
// NICHT akzeptieren: /datasets/, /spaces/, /collections/, /blog/, /docs/
const HF_HOST = /(?:^|\/\/)(?:huggingface\.co|hf\.co)\//i;
const NON_MODEL_PATH = /\/(?:datasets|spaces|collections|blog|docs|papers|posts|new)\//i;

function extractHfUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return null;
  if (!HF_HOST.test(urlStr)) return null;
  if (NON_MODEL_PATH.test(urlStr)) return null;
  try {
    const u = new URL(urlStr);
    // Normalisieren: nur Host + Pfad, ohne query/hash/trailing-slash
    const cleanHost = u.host.replace(/^www\./, '');
    // Erwarteter Pfad: /{org}/{model}[/...]
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return `https://${cleanHost}/${parts[0]}/${parts[1]}`;
  } catch {
    return null;
  }
}

function deriveHfUrl(model) {
  if (model.huggingface_url) return model.huggingface_url;
  // 1. Aus weights
  const fromWeights = extractHfUrl(model.weights);
  if (fromWeights) return fromWeights;
  // 2. Aus sources
  if (Array.isArray(model.sources)) {
    for (const s of model.sources) {
      const hf = extractHfUrl(s?.url);
      if (hf) return hf;
    }
  }
  // 3. Aus url (Hersteller-Seite zeigt gelegentlich auch auf HF)
  const fromUrl = extractHfUrl(model.url);
  if (fromUrl) return fromUrl;
  return null;
}

async function main() {
  console.log('BVDW Atlas — Phase-5-Migration (Hugging-Face-Model-Card-Links)\n');

  const { data: models, error } = await supabase
    .from('models')
    .select('atlas, id, data');
  if (error) throw error;

  let set = 0, already = 0, none = 0;
  for (const row of models) {
    const current = row.data?.huggingface_url;
    if (current) { already++; continue; }
    const hf = deriveHfUrl(row.data);
    if (!hf) { none++; continue; }
    const newData = { ...row.data, huggingface_url: hf };
    const { error: uErr } = await supabase
      .from('models')
      .update({ data: newData })
      .eq('atlas', row.atlas)
      .eq('id', row.id);
    if (uErr) { console.error(`${row.id}: ${uErr.message}`); continue; }
    set++;
  }
  console.log(`✓ ${set} HF-URLs gesetzt, ${already} bereits vorhanden, ${none} ohne HF-Präsenz`);
  console.log(`\nDie ${none} Modelle ohne HF-Link sind vermutlich:`);
  console.log('  - Closed Vendors (GPT, Claude, Gemini) haben keine HF-Repos');
  console.log('  - Regionale API-only-Modelle (Aleph Alpha, Sarvam) ebenfalls');
  console.log('  - Das Team kann im Edit-Modus manuell HF-URLs nachtragen, wo sinnvoll.');
}

main().catch(err => {
  console.error('\n✗ Fehler:', err.message || err);
  process.exit(1);
});
