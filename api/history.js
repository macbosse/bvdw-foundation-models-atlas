// GET /api/history?atlas=...&id=...        → alle Versionen eines einzelnen Modells
// GET /api/history?atlas=...&limit=50       → globaler Recent-Edits-Feed über alle Modelle
import { getSupabase } from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { atlas, id } = req.query;
  const limit = Math.max(1, Math.min(200, parseInt(req.query.limit) || 50));

  if (!atlas || !['conversational', 'specialized'].includes(atlas)) {
    return res.status(400).json({ error: 'atlas muss "conversational" oder "specialized" sein' });
  }

  try {
    const supabase = getSupabase();

    if (id) {
      // Alle Versionen eines einzelnen Modells, neueste zuerst
      const { data, error } = await supabase
        .from('model_versions')
        .select('id, version, data, edited_by, edit_summary, created_at')
        .eq('atlas', atlas)
        .eq('model_id', id)
        .order('version', { ascending: false });
      if (error) throw error;
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ atlas, id, versions: data || [] });
    }

    // Recent-Feed: Edits quer über alle Modelle, chronologisch
    const { data, error } = await supabase
      .from('model_versions')
      .select('id, atlas, model_id, version, edited_by, edit_summary, created_at, data')
      .eq('atlas', atlas)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;

    // Trim: nur minimal benötigte Felder + Modellname für das Flyout
    const trimmed = (data || []).map(v => ({
      id: v.id,
      atlas: v.atlas,
      model_id: v.model_id,
      version: v.version,
      edited_by: v.edited_by,
      edit_summary: v.edit_summary,
      created_at: v.created_at,
      model_name: v.data?.name || v.model_id,
      vendor: v.data?.vendor || null
    }));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ atlas, count: trimmed.length, versions: trimmed });
  } catch (err) {
    console.error('history API error:', err);
    return res.status(500).json({ error: err.message || 'Unbekannter Fehler' });
  }
}
