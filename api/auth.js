// POST /api/auth
// Body: { password }
// Simple Password-Validierung für Edit-Mode-Aktivierung.
// Verändert keinen State, gibt nur { ok: true } oder 401 zurück.
import { checkPassword } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { password } = req.body || {};
  const auth = checkPassword(password);
  if (!auth.ok) return res.status(auth.status || 401).json({ error: auth.error });
  return res.status(200).json({ ok: true });
}
