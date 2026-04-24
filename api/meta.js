// GET /api/meta?atlas=conversational|specialized
// Liefert Meta-Daten (Title, Filters, Methodik) und alle Lizenzen.
import { getSupabase } from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const atlas = req.query.atlas;
  if (!atlas || !['conversational', 'specialized'].includes(atlas)) {
    return res.status(400).json({ error: 'atlas muss "conversational" oder "specialized" sein' });
  }

  try {
    const supabase = getSupabase();
    const [metaRes, licRes] = await Promise.all([
      supabase.from('atlas_meta').select('data').eq('atlas', atlas).maybeSingle(),
      supabase.from('licenses').select('id, data').eq('atlas', atlas)
    ]);

    if (metaRes.error) throw metaRes.error;
    if (licRes.error) throw licRes.error;

    const licenses = {};
    (licRes.data || []).forEach(l => { licenses[l.id] = l.data; });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      atlas,
      meta: metaRes.data?.data || null,
      licenses
    });
  } catch (err) {
    console.error('meta API error:', err);
    return res.status(500).json({ error: err.message || 'Unbekannter Fehler' });
  }
}
