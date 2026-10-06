// GET /api/keep-alive
// Hält das Supabase-Projekt aktiv (Free-Tier pausiert nach 7 Tagen ohne API-Aktivität) und
// protokolliert jeden Ping je Quelle in der Tabelle heartbeat. So lässt sich unter /api/health
// nachweisen, dass jeder Pinger (Vercel-Cron, GitHub Actions, manuell) tatsächlich ankommt.
// Quellen-Erkennung: Vercel-Cron sendet User-Agent "vercel-cron/1.0"; GitHub Actions setzt
// den User-Agent "bvdw-atlas-keepalive/github-actions"; alles andere gilt als "manual".
import { getSupabase } from './_lib/supabase.js';

export function detectSource(req) {
  const ua = String(req.headers['user-agent'] || '').toLowerCase();
  const q = String((req.query && req.query.source) || '').toLowerCase();
  if (ua.startsWith('vercel-cron')) return 'vercel-cron';
  if (ua.includes('bvdw-atlas-keepalive/github-actions') || q === 'github-actions') return 'github-actions';
  if (q && /^[a-z0-9-]{1,40}$/.test(q)) return q;
  return 'manual';
}

export default async function handler(req, res) {
  const started = Date.now();
  res.setHeader('Cache-Control', 'no-store');
  const source = detectSource(req);
  try {
    const supabase = getSupabase();
    // 1) Echter DB-Lesezugriff (zählt als API-Aktivität)
    const { error, count } = await supabase
      .from('vendors')
      .select('slug', { count: 'exact', head: true });
    if (error) throw error;
    const latency = Date.now() - started;

    // 2) Schreibender Heartbeat (zählt zusätzlich als Aktivität und dient als Nachweis).
    //    Darf den Keep-Alive nicht scheitern lassen, falls die Tabelle fehlt.
    let heartbeat = null;
    try {
      const { data: cur } = await supabase.from('heartbeat').select('ping_count').eq('source', source).maybeSingle();
      const { data: hb, error: hbErr } = await supabase
        .from('heartbeat')
        .upsert({ source, last_ping: new Date().toISOString(), ping_count: (cur?.ping_count || 0) + 1, last_latency_ms: latency }, { onConflict: 'source' })
        .select('source, last_ping, ping_count')
        .single();
      if (!hbErr) heartbeat = hb;
      else heartbeat = { error: hbErr.message };
    } catch (e) {
      heartbeat = { error: e.message || String(e) };
    }

    return res.status(200).json({
      ok: true,
      service: 'supabase',
      source,
      vendors: count ?? null,
      latency_ms: latency,
      heartbeat,
      checked_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('keep-alive error:', err);
    return res.status(503).json({
      ok: false,
      source,
      error: err.message || 'unknown',
      latency_ms: Date.now() - started,
      checked_at: new Date().toISOString()
    });
  }
}
