// POST /api/delete
// Body: { password, atlas, id, editor_name, reason }
// Soft-Delete: setzt _deleted Flag im data-JSON und legt einen Versions-Snapshot an.
// Wiederherstellen erfolgt über den bestehenden /api/revert auf eine frühere Version.
import { getSupabase } from './_lib/supabase.js';
import { checkPassword } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const { password, atlas, id, editor_name, reason } = body;

  const auth = checkPassword(password);
  if (!auth.ok) return res.status(auth.status || 401).json({ error: auth.error });

  if (!atlas || !['conversational', 'specialized'].includes(atlas)) {
    return res.status(400).json({ error: 'atlas muss "conversational" oder "specialized" sein' });
  }
  if (!id) return res.status(400).json({ error: 'id ist erforderlich' });

  try {
    const supabase = getSupabase();

    const { data: current, error: loadErr } = await supabase
      .from('models')
      .select('current_version, data')
      .eq('atlas', atlas)
      .eq('id', id)
      .maybeSingle();
    if (loadErr) throw loadErr;
    if (!current) return res.status(404).json({ error: 'Modell nicht gefunden' });
    if (current.data && current.data._deleted) {
      return res.status(409).json({ error: 'Modell ist bereits gelöscht' });
    }

    const newVersion = (current.current_version || 0) + 1;
    const now = new Date().toISOString();
    const ed = (editor_name || 'anonym').slice(0, 80);
    const deletionReason = (reason || '').slice(0, 500);

    const newData = {
      ...current.data,
      _deleted: true,
      _deleted_at: now,
      _deleted_by: ed,
      _deleted_reason: deletionReason || null
    };

    const { error: updErr } = await supabase
      .from('models')
      .update({
        data: newData,
        current_version: newVersion,
        updated_at: now,
        updated_by: ed
      })
      .eq('atlas', atlas)
      .eq('id', id);
    if (updErr) throw updErr;

    const summary = deletionReason ? `Gelöscht: ${deletionReason}` : 'Gelöscht';
    const { error: vErr } = await supabase
      .from('model_versions')
      .insert({
        atlas,
        model_id: id,
        version: newVersion,
        data: newData,
        edited_by: ed,
        edit_summary: summary
      });
    if (vErr) throw vErr;

    return res.status(200).json({ ok: true, atlas, id, version: newVersion });
  } catch (err) {
    console.error('delete API error:', err);
    return res.status(500).json({ error: err.message || 'Unbekannter Fehler' });
  }
}
