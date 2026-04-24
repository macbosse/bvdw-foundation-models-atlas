// Resolve logos for each vendor via Lobe-Icons → simple-icons → Clearbit → DiceBear.
// Speichert das Ergebnis in vendors.logo_url + logo_source. Idempotent.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

// Manuelles Mapping Vendor-Slug → Lobe-Icon-Name, wo der Auto-Slug nicht passt
const LOBE_MAPPING = {
  'aleph-alpha': 'alephalpha',
  '01-ai': '01ai',
  'ai21-labs': 'ai21labs',
  'alibaba': 'qwen',
  'alibaba-cloud': 'qwen',
  'meta-ai': 'meta',
  'google-deepmind': 'gemini',
  'google': 'gemini',
  'microsoft': 'microsoft',
  'microsoft-research': 'microsoft',
  'x-ai': 'grok',
  'xai': 'grok',
  'anthropic': 'anthropic',
  'openai': 'openai',
  'mistral-ai': 'mistral',
  'mistral': 'mistral',
  'deepseek': 'deepseek',
  'deepseek-ai': 'deepseek',
  'cohere': 'cohere',
  'stability-ai': 'stability',
  'perplexity': 'perplexity',
  'perplexity-ai': 'perplexity',
  'moonshot-ai': 'moonshot',
  'moonshot': 'moonshot',
  'zhipu-ai': 'zhipu',
  'zhipu': 'zhipu',
  'hugging-face': 'huggingface',
  'huggingface': 'huggingface',
  'bytedance': 'bytedance',
  'tencent': 'tencent',
  'baidu': 'baidu',
  'minimax': 'minimax',
  'nvidia': 'nvidia',
  'ibm': 'ibm',
  'apple': 'apple',
  'allen-institute-for-ai': 'ai2',
  'databricks': 'databricks',
  'snowflake': 'snowflake',
  'reka': 'reka',
  'yi': 'yi',
  'baichuan-ai': 'baichuan',
  'baichuan': 'baichuan',
  'qwen': 'qwen',
  'adept': 'adept',
  'inflection': 'inflection',
  'inflection-ai': 'inflection',
  'lg-ai-research': 'lg',
  'naver': 'naver',
  'upstage': 'upstage',
  'sakana-ai': 'sakana',
  'elyza': 'elyza',
  'tii': 'tii',
  'g42': 'g42',
  'yandex': 'yandex',
  'sber': 'sber',
  'ollama': 'ollama',
  'black-forest-labs': 'flux',
  'runway': 'runway',
  'luma': 'luma',
  'pika': 'pika',
  'midjourney': 'midjourney',
  'elevenlabs': 'elevenlabs',
  'suno': 'suno',
  'udio': 'udio'
};

async function urlOk(url, timeoutMs = 5000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

function extractDomain(url) {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function dicebear(name) {
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(name)}&backgroundColor=FAF8F5`;
}

async function resolveOneVendor(vendor) {
  const slug = vendor.slug;
  const name = vendor.name;
  const mapped = LOBE_MAPPING[slug];
  const lobeCandidates = [
    mapped,
    slug,
    slug.split('-')[0],
    slug.replace(/-(ai|labs?|research|intelligence|studio|inc|corp|team|systems?|tech|technologies?)$/i, '')
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  // 1) Lobe-Icons
  for (const n of lobeCandidates) {
    const url = `https://unpkg.com/@lobehub/icons-static-png@latest/dark/${n}.png`;
    if (await urlOk(url)) return { url, source: 'lobe' };
  }

  // 2) simple-icons
  for (const n of lobeCandidates) {
    const url = `https://cdn.simpleicons.org/${n}`;
    if (await urlOk(url)) return { url, source: 'simpleicons' };
  }

  // 3) Clearbit via website
  const domain = extractDomain(vendor.website);
  if (domain) {
    const url = `https://logo.clearbit.com/${domain}`;
    if (await urlOk(url)) return { url, source: 'clearbit' };
  }

  // 4) DiceBear
  return { url: dicebear(name), source: 'dicebear' };
}

async function main() {
  console.log('BVDW Atlas — Logo-Resolver\n');
  const { data: vendors, error } = await supabase
    .from('vendors')
    .select('slug, name, website, logo_url')
    .order('slug', { ascending: true });
  if (error) throw error;
  console.log(`Gefunden: ${vendors.length} Vendors`);

  // Parallel in Batches, damit wir nicht ewig warten
  const BATCH = 8;
  let resolved = 0;
  const stats = { lobe: 0, simpleicons: 0, clearbit: 0, dicebear: 0 };

  for (let i = 0; i < vendors.length; i += BATCH) {
    const batch = vendors.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async v => {
      const r = await resolveOneVendor(v);
      return { vendor: v, ...r };
    }));
    for (const { vendor, url, source } of results) {
      await supabase
        .from('vendors')
        .update({ logo_url: url, logo_source: source, updated_at: new Date().toISOString() })
        .eq('slug', vendor.slug);
      stats[source]++;
      resolved++;
      const marker = { lobe: 'L', simpleicons: 'S', clearbit: 'C', dicebear: 'D' }[source];
      process.stdout.write(`${marker}`);
    }
  }
  console.log(`\n\n✓ ${resolved} Vendors aufgelöst`);
  console.log(`  Lobe-Icons:   ${stats.lobe}`);
  console.log(`  simple-icons: ${stats.simpleicons}`);
  console.log(`  Clearbit:     ${stats.clearbit}`);
  console.log(`  DiceBear:     ${stats.dicebear}`);
}

main().catch(err => {
  console.error('\n✗ Fehler:', err.message || err);
  process.exit(1);
});
