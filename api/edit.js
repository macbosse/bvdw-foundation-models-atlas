// POST /api/edit
// Body: { password, atlas, id, data, editor_name, edit_summary }
// Aktualisiert ein Modell und legt einen Versions-Snapshot an.
import { getSupabase } from './_lib/supabase.js';
import { checkPassword } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const { password, atlas, id, data, editor_name, edit_summary } = body;

  const auth = checkPassword(password);
  if (!auth.ok) return res.status(auth.status || 401).json({ error: auth.error });

  if (!atlas || !['conversational', 'specialized'].includes(atlas)) {
    return res.status(400).json({ error: 'atlas muss "conversational" oder "specialized" sein' });
  }
  if (!id) return res.status(400).json({ error: 'id ist erforderlich' });
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'data muss ein Objekt sein' });
  }
  if (data.id && data.id !== id) {
    return res.status(400).json({ error: 'data.id passt nicht zur id-Query' });
  }

  try {
    const supabase = getSupabase();

    const { data: current, error: loadErr } = await supabase
      .from('models')
      .select('current_version')
      .eq('atlas', atlas)
      .eq('id', id)
      .maybeSingle();
    if (loadErr) throw loadErr;
    if (!current) return res.status(404).json({ error: 'Modell nicht gefunden' });

    const newVersion = (current.current_version || 0) + 1;
    const now = new Date().toISOString();
    const ed = (editor_name || 'anonym').slice(0, 80);
    const summary = (edit_summary || '').slice(0, 500);

    // Sicherstellen, dass die id im data-Objekt konsistent ist
    const cleanData = { ...data, id };

    const { error: updErr } = await supabase
      .from('models')
      .update({
        data: cleanData,
        current_version: newVersion,
        updated_at: now,
        updated_by: ed
      })
      .eq('atlas', atlas)
      .eq('id', id);
    if (updErr) throw updErr;

    const { error: vErr } = await supabase
      .from('model_versions')
      .insert({
        atlas,
        model_id: id,
        version: newVersion,
        data: cleanData,
        edited_by: ed,
        edit_summary: summary || null
      });
    if (vErr) throw vErr;

    return res.status(200).json({ ok: true, atlas, id, version: newVersion, updated_at: now });
  } catch (err) {
    console.error('edit API error:', err);
    return res.status(500).json({ error: err.message || 'Unbekannter Fehler' });
  }
}
