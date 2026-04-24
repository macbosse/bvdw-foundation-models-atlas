// POST /api/revert
// Body: { password, atlas, id, target_version, editor_name }
// Schreibt den Datenstand einer alten Version in das aktuelle Modell.
// Erzeugt dabei einen NEUEN Versions-Eintrag, damit der Revert transparent nachvollziehbar bleibt.
import { getSupabase } from './_lib/supabase.js';
import { checkPassword } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const { password, atlas, id, target_version, editor_name } = body;

  const auth = checkPassword(password);
  if (!auth.ok) return res.status(auth.status || 401).json({ error: auth.error });

  if (!atlas || !['conversational', 'specialized'].includes(atlas)) {
    return res.status(400).json({ error: 'atlas muss "conversational" oder "specialized" sein' });
  }
  if (!id) return res.status(400).json({ error: 'id ist erforderlich' });
  const targetV = parseInt(target_version);
  if (!Number.isInteger(targetV) || targetV < 1) {
    return res.status(400).json({ error: 'target_version muss eine positive Ganzzahl sein' });
  }

  try {
    const supabase = getSupabase();

    const { data: target, error: tErr } = await supabase
      .from('model_versions')
      .select('data')
      .eq('atlas', atlas)
      .eq('model_id', id)
      .eq('version', targetV)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!target) return res.status(404).json({ error: `Version ${targetV} nicht gefunden` });

    const { data: current, error: cErr } = await supabase
      .from('models')
      .select('current_version')
      .eq('atlas', atlas)
      .eq('id', id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!current) return res.status(404).json({ error: 'Modell nicht gefunden' });

    const newVersion = (current.current_version || 0) + 1;
    const now = new Date().toISOString();
    const ed = (editor_name || 'anonym').slice(0, 80);

    const { error: uErr } = await supabase
      .from('models')
      .update({
        data: target.data,
        current_version: newVersion,
        updated_at: now,
        updated_by: ed
      })
      .eq('atlas', atlas)
      .eq('id', id);
    if (uErr) throw uErr;

    const { error: iErr } = await supabase
      .from('model_versions')
      .insert({
        atlas,
        model_id: id,
        version: newVersion,
        data: target.data,
        edited_by: ed,
        edit_summary: `Zurückgesetzt auf Version ${targetV}`
      });
    if (iErr) throw iErr;

    return res.status(200).json({ ok: true, atlas, id, version: newVersion, reverted_from: targetV });
  } catch (err) {
    console.error('revert API error:', err);
    return res.status(500).json({ error: err.message || 'Unbekannter Fehler' });
  }
}
