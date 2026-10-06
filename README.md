# BVDW Foundation Models Atlas

**Neutrale, kuratierte Übersicht relevanter AI-Foundation-Models mit europäischer Souveränitätsperspektive.**

Ein Projekt des BVDW AI Tech Lab. Live: **[bosses-foundation-models.vercel.app](https://bosses-foundation-models.vercel.app)**

---

## Was ist das?

Ein offener Atlas von derzeit **264 Foundation Models** (172 Konversations-LLMs, 92 Spezial-Modalitäten inkl. Entscheidungsmodelle; Stand Oktober 2026) — von GPT-6 und Claude 5 über Mistral 3, Kolibri und Qwen 3.x bis zu Regional-Modellen aus Korea, Japan, Indien und dem Nahen Osten. Abgelöste Modelle bleiben als Legacy nachvollziehbar. Kuratiert mit Fokus auf:

- **Souveränität**: Wie DSGVO-konform ist der Einsatz? Ist ein On-Prem-Betrieb möglich? US CLOUD Act anwendbar?
- **Praxis**: Wofür ist das Modell im Alltag wirklich gut? Wo sind bekannte Schwächen?
- **Verständlichkeit**: Offene Methodik, erklärbare Bewertungen, transparente Kriterien.

## Features

- **Drei Ansichten**: klassische Liste · Quartett-Karten (mit PDF-Export) · interaktiver Swipe-Finder
- **Lebenszyklus-Status** pro Modell: abgelöste Modelle bleiben als „Legacy“ mit Nachfolger-Verweis erhalten, abgeschaltete als „Eingestellt“; per Filter ausblendbar
- **Entscheidungsmodelle („System One“ / Decision AI)** seit Oktober 2026 als eigener Task-Typ und Modellklasse im Spezial-Atlas, mit Task-Typ-Filter — Konzept in [docs/system-one-decision-models.md](docs/system-one-decision-models.md)
- **Deployment-Buckets**: fünf realistische Einsatz-Szenarien (Eigene Hardware bis Vendor-Direct), automatisch pro Modell eingeordnet
- **Info-Tooltips** und ausklappbare Methodik-Legende für jede Bewertung
- **Versionierter Edit-Mode** mit Rollback, Deeplinks pro Modell, Share via Web-Share-API
- **Hugging-Face-Integration**: Link auf offizielle Model-Cards für aktuelle Benchmark-Werte — keine eigene Benchmark-Pflege
- **Quartett-Export als PDF**: druckfertige Karten im klassischen 2:3-Format mit BVDW-Rückseite

## Tech-Stack

| Layer | Was | Warum |
|---|---|---|
| Frontend | Vanilla HTML/CSS/JS, kein Build-Step | minimaler Lock-In, direkt lesbar |
| Backend | Vercel Serverless Functions (Node.js 20) | kostenlos im Free-Tier |
| DB | Supabase Postgres + RLS | SaaS, kostenlos ausreichend für den Use-Case |
| Assets | @lobehub/icons, flagcdn, simple-icons | frei lizenziert, extern gehostet |
| PDF | pdf-lib (clientseitig, Vector-Qualität) | keine Server-Last |

## Quick-Start (Local Development)

```bash
git clone https://github.com/macbosse/bvdw-foundation-models-atlas.git
cd bvdw-foundation-models-atlas
npm install

# Supabase-Projekt anlegen, Schema importieren
# supabase/schema.sql im Supabase SQL-Editor ausführen

# .env.local anlegen (Template siehe unten)
cp .env.example .env.local  # falls vorhanden, sonst manuell

# Daten importieren (einmalig)
npm run import-all

# Lokaler Dev-Server mit Vercel CLI (kein npm-Script, sonst ruft vercel dev sich selbst auf)
npx vercel dev
```

### ENV-Variablen

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...    # Supabase Service-Role, niemals ins Frontend!
EDIT_PASSWORD=dein-passwort         # für den Edit-Mode
```

## Deployment

Das Projekt ist als **statisches Frontend + Serverless-Functions** deploybar. Vercel ist die empfohlene Plattform:

```bash
vercel --prod
```

ENV-Variablen im Vercel-Dashboard unter Settings → Environment Variables setzen.

## Daten aktualisieren

Kleine Korrekturen laufen über den Edit-Mode im Frontend. Größere Updates (viele neue Modelle, Legacy-Markierungen) werden als Paket in `data/updates/` beschrieben und idempotent eingespielt — jede Änderung erzeugt wie im Edit-Mode einen Versions-Snapshot:

```bash
npm run import-delta -- data/updates/2026-10-update.json --dry-run   # Plan anzeigen
npm run import-delta -- data/updates/2026-10-update.json             # einspielen
npm run export-all                                                   # Backup in data-export/ aktualisieren
```

Für reine Frontend-Arbeiten ohne Supabase-Credentials: `node scripts/dev-static.js` serviert die statischen Dateien und leitet `/api/*` an die Produktion weiter.

Betrieb: Supabase pausiert Free-Tier-Projekte nach sieben Tagen ohne Datenbankaktivität. Dagegen laufen ein Vercel-Cron (`vercel.json`) und ein GitHub-Actions-Workflow (`.github/workflows/keep-alive.yml`), der bei Ausfall fehlschlägt und damit per E-Mail alarmiert.

## Dokumentation

- **[HANDOVER_BVDW.md](HANDOVER_BVDW.md)** — technisches Übergabe-Dokument mit komplettem Setup-Guide, Migrations-Anleitung und Betriebs-Empfehlungen
- **[HANDOVER.md](HANDOVER.md)** — Team-Anleitung für redaktionelle Mitarbeit (Edit-Mode, Versionshistorie)
- **[supabase/schema.sql](supabase/schema.sql)** — kommentiertes Datenbank-Schema
- **[docs/system-one-decision-models.md](docs/system-one-decision-models.md)** — Einordnung und Integrationskonzept für Entscheidungsmodelle (System One)
- **[data/updates/](data/updates/)** — versionierte Update-Pakete für `npm run import-delta` (Referenz: Update Oktober 2026)

## Warum das so gebaut ist

Der Atlas folgt ein paar bewusst getroffenen Design-Entscheidungen:

- **Keine Benchmark-Zahlen** im Atlas selbst — sie veralten zu schnell und sind manipulationsanfällig. Stattdessen pro Modell ein Link auf die offizielle Hugging-Face-Model-Card.
- **Kein eigenes Ranking** — das ist nicht die Rolle eines Verbandes. Der Atlas bietet Orientierung, nicht Bewertung.
- **JSONB für flexible Felder** — das Datenmodell kann ohne Migration erweitert werden (z.B. neue Felder wie `on_prem` oder `supported_languages` sind so entstanden).
- **Shared Password statt User-Accounts** — reduziert Komplexität für ein redaktionelles Team, das sich kennt. Volle Versionshistorie mit Editor-Namen bleibt vorhanden.

## Für wen ist das interessant?

- **Verbände und Netzwerke**, die eine ähnliche Orientierungshilfe bauen wollen — das ganze Setup ist unter MIT-Lizenz frei wiederverwendbar
- **AI-Teams in Unternehmen**, die ein internes Modell-Inventar brauchen — der Edit-Mode eignet sich direkt für kollaborative Kuratierung
- **Forschung**, die den Atlas als Referenz nutzen möchte — Deeplinks pro Modell sind stabil

## Lizenz

**Code: MIT License** (siehe [LICENSE](LICENSE)).

**Ausnahmen**:
- Die BVDW-Corporate-Logos in `assets/bvdw-logo/` sind Markenzeichen des Bundesverbands Digitale Wirtschaft und nicht von der MIT-Lizenz abgedeckt
- Die redaktionellen Inhalte (Praxisnotizen, Souveränitäts-Bewertungen) sind Werk des BVDW AI Tech Lab und bei Wiederverwendung unter Nennung der Quelle zu nutzen

Alle Code-Abhängigkeiten des Projekts (Supabase, pdf-lib, marked, Lobe-Icons u.a.) sind ebenfalls MIT-lizenziert oder Public Domain — keine Copyleft-Einschränkungen.

## Kontakt

Bei Interesse an Einsatz, Feedback oder Weiterentwicklung:

**Bosse Küllenberg** · AI Tech Lab Lead, BVDW · [b.kuellenberg@gmail.com](mailto:b.kuellenberg@gmail.com)

---

*Ein Projekt des Bundesverbands Digitale Wirtschaft (BVDW) — für den deutschen Mittelstand und alle, die AI-Souveränität ernst nehmen.*
