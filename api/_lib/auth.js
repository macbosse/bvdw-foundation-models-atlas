// Einfacher Shared-Password-Check für den Edit-Mode.
// Kein User-System, wie vom BVDW AI Tech Lab gewünscht. Vertraut dem Team.
// Passwort rotiert über Vercel ENV-Variable.

const EDIT_PASSWORD = process.env.EDIT_PASSWORD;

export function checkPassword(providedPassword) {
  if (!EDIT_PASSWORD) {
    return { ok: false, status: 500, error: 'Server-Konfiguration: EDIT_PASSWORD nicht gesetzt' };
  }
  if (!providedPassword) {
    return { ok: false, status: 401, error: 'Passwort erforderlich' };
  }
  // Constant-time compare to reduce timing leaks
  const a = Buffer.from(String(providedPassword));
  const b = Buffer.from(EDIT_PASSWORD);
  if (a.length !== b.length) return { ok: false, status: 401, error: 'Passwort ungültig' };
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) return { ok: false, status: 401, error: 'Passwort ungültig' };
  return { ok: true };
}
