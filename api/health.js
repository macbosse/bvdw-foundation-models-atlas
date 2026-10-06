// GET /api/health
// Betriebs-Statusseite als JSON: Datenbank erreichbar? Wann kam der letzte Ping je Quelle an?
// Antwortet 200, solange die Datenbank erreichbar ist, und listet Warnungen (z. B. Vercel-Cron
// seit > 36 h nicht angekommen). 503 nur, wenn die Datenbank selbst nicht antwortet.
// Wird vom GitHub-Actions-Workflow ausgewertet, der bei Warnungen fehlschlägt und damit alarmiert.
import { getSupabase } from './_lib/supabase.js';

const STALE_HOURS = { 'vercel-cron': 36, 'github-actions': 36 };

export default async function handler(req, res) {
  const started = Date.now();
  res.setHeader('Cache-Control', 'no-store');
  try {
    const supabase = getSupabase();
    const [models, hb] = await Promise.all([
      supabase.from('models').select('atlas', { count: 'exact', head: true }),
      supabase.from('heartbeat').select('source, last_ping, ping_count, last_latency_ms').order('source')
    ]);
    if (models.error) throw models.error;
    const now = Date.now();
    const pings = {};
    const warnings = [];
    for (const row of hb.data || []) {
      const ageH = Math.round((now - new Date(row.last_ping).getTime()) / 36e5 * 10) / 10;
      pings[row.source] = { last_ping: row.last_ping, age_hours: ageH, ping_count: row.ping_count, last_latency_ms: row.last_latency_ms };
      if (STALE_HOURS[row.source] && ageH > STALE_HOURS[row.source]) warnings.push(`${row.source}: letzter Ping vor ${ageH} h (Schwelle ${STALE_HOURS[row.source]} h)`);
    }
    // Fehlende Pinger erst nach 48 h Einlaufzeit als Warnung werten (Referenz: Zeile "system",
    // die beim Anlegen der Tabelle einmalig geschrieben wird und danach unverändert bleibt).
    const notes = [];
    const systemAgeH = pings.system ? pings.system.age_hours : null;
    for (const src of Object.keys(STALE_HOURS)) {
      if (!pings[src]) {
        if (systemAgeH !== null && systemAgeH > 48) warnings.push(`${src}: noch nie angekommen (Tabelle seit ${systemAgeH} h aktiv)`);
        else notes.push(`${src}: noch kein Ping (Einlaufzeit, Tabelle seit ${systemAgeH ?? '?'} h aktiv)`);
      }
    }
    if (hb.error) warnings.push(`heartbeat-Tabelle nicht lesbar: ${hb.error.message}`);
    return res.status(200).json({
      ok: true,
      database: 'up',
      models_total: models.count ?? null,
      pings,
      warnings,
      notes,
      latency_ms: Date.now() - started,
      checked_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('health error:', err);
    return res.status(503).json({ ok: false, database: 'down', error: err.message || 'unknown', latency_ms: Date.now() - started, checked_at: new Date().toISOString() });
  }
}
