// POST /api/create
// Body: { password, atlas, id, data, editor_name }
// Legt ein neues Modell an (mit initialem Versions-Snapshot). ID muss eindeutig sein.
import { getSupabase } from './_lib/supabase.js';
import { checkPassword } from './_lib/auth.js';

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/ö/g, 'oe').replace(/ä/g, 'ae').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const { password, atlas, editor_name } = body;
  let { id, data } = body;

  const auth = checkPassword(password);
  if (!auth.ok) return res.status(auth.status || 401).json({ error: auth.error });

  if (!atlas || !['conversational', 'specialized'].includes(atlas)) {
    return res.status(400).json({ error: 'atlas muss "conversational" oder "specialized" sein' });
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'data muss ein Objekt sein' });
  }
  if (!data.name || !data.name.trim()) {
    return res.status(400).json({ error: 'data.name ist erforderlich' });
  }

  // Fallback-ID generieren falls nicht übergeben
  if (!id || !id.trim()) {
    id = slugify((data.vendor || '') + '-' + data.name);
  } else {
    id = slugify(id);
  }
  if (!id) return res.status(400).json({ error: 'Konnte keine gültige id generieren' });

  try {
    const supabase = getSupabase();
    const { data: existing, error: loadErr } = await supabase
      .from('models')
      .select('id')
      .eq('atlas', atlas)
      .eq('id', id)
      .maybeSingle();
    if (loadErr) throw loadErr;
    if (existing) return res.status(409).json({ error: `Modell-ID "${id}" existiert bereits in ${atlas}` });

    const now = new Date().toISOString();
    const ed = (editor_name || 'anonym').slice(0, 80);
    const cleanData = {
      ...data,
      id,
      vendor_slug: slugify(data.vendor || ''),
      supported_languages: data.supported_languages || ['en'],
      modalities: data.modalities || ['text']
    };

    const { error: mErr } = await supabase.from('models').insert({
      atlas,
      id,
      data: cleanData,
      current_version: 1,
      updated_at: now,
      updated_by: ed
    });
    if (mErr) throw mErr;

    const { error: vErr } = await supabase.from('model_versions').insert({
      atlas,
      model_id: id,
      version: 1,
      data: cleanData,
      edited_by: ed,
      edit_summary: 'Neu angelegt'
    });
    if (vErr) throw vErr;

    // Vendor ggf. neu anlegen (falls noch nicht vorhanden)
    if (cleanData.vendor_slug) {
      const { data: vExist } = await supabase
        .from('vendors')
        .select('slug')
        .eq('slug', cleanData.vendor_slug)
        .maybeSingle();
      if (!vExist) {
        await supabase.from('vendors').insert({
          slug: cleanData.vendor_slug,
          name: data.vendor || cleanData.vendor_slug,
          country: data.country || null,
          website: data.url || null,
          updated_at: now
        });
      }
    }

    return res.status(200).json({ ok: true, atlas, id, version: 1 });
  } catch (err) {
    console.error('create API error:', err);
    return res.status(500).json({ error: err.message || 'Unbekannter Fehler' });
  }
}
