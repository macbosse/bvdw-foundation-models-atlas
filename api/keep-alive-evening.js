// GET /api/keep-alive-evening
// Zweiter Cron-Pfad für den Abend-Ping (Vercel erlaubt pro Pfad nur einen Cron-Job).
// Identische Logik wie /api/keep-alive; der Heartbeat landet ebenfalls unter "vercel-cron".
export { default } from './keep-alive.js';
