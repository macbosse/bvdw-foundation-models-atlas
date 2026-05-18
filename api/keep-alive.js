// GET /api/keep-alive
// Wird von einem Vercel-Cron täglich aufgerufen, um das Supabase-Projekt aktiv zu halten.
// Supabase Free-Tier pausiert nach 7 Tagen Inaktivität — ein leichter Query pro Tag
// verhindert das zuverlässig. Antwortet immer schnell und cache-frei.
import { getSupabase } from './_lib/supabase.js';

export default async function handler(req, res) {
  const started = Date.now();
  try {
    const supabase = getSupabase();
    // Minimaler Query: nur ein einzelner Slug, count exact für echten DB-Hit
    const { error, count } = await supabase
      .from('vendors')
      .select('slug', { count: 'exact', head: true });
    if (error) throw error;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      ok: true,
      service: 'supabase',
      vendors: count ?? null,
      latency_ms: Date.now() - started,
      checked_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('keep-alive error:', err);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).json({
      ok: false,
      error: err.message || 'unknown',
      latency_ms: Date.now() - started,
      checked_at: new Date().toISOString()
    });
  }
}
