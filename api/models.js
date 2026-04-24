// GET /api/models?atlas=conversational|specialized
// Lädt alle Modelle eines Atlas aus Supabase.
import { getSupabase } from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const atlas = req.query.atlas;
  const includeDeleted = req.query.include_deleted === '1';
  if (!atlas || !['conversational', 'specialized'].includes(atlas)) {
    return res.status(400).json({ error: 'atlas muss "conversational" oder "specialized" sein' });
  }

  try {
    const supabase = getSupabase();
    const [modelsRes, vendorsRes] = await Promise.all([
      supabase
        .from('models')
        .select('id, data, current_version, updated_at, updated_by')
        .eq('atlas', atlas)
        .order('id', { ascending: true }),
      supabase
        .from('vendors')
        .select('slug, name, website, logo_url, logo_source, brand_color, country')
    ]);
    if (modelsRes.error) throw modelsRes.error;
    if (vendorsRes.error) throw vendorsRes.error;

    const vendorMap = new Map((vendorsRes.data || []).map(v => [v.slug, v]));

    const rows = includeDeleted
      ? (modelsRes.data || [])
      : (modelsRes.data || []).filter(row => !(row.data && row.data._deleted));

    const models = rows.map(row => ({
      ...row.data,
      vendor_info: vendorMap.get(row.data.vendor_slug) || null,
      _version: row.current_version,
      _updated_at: row.updated_at,
      _updated_by: row.updated_by
    }));

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ atlas, count: models.length, models });
  } catch (err) {
    console.error('models API error:', err);
    return res.status(500).json({ error: err.message || 'Unbekannter Fehler' });
  }
}
