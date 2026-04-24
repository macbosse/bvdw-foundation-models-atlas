# BVDW Foundation Models Atlas — Team-Handover

Eine kurze Anleitung für alle Kolleginnen und Kollegen, die am Atlas mitarbeiten.

## Was ist das hier?

Eine kuratierte, neutrale Übersicht relevanter Foundation Models mit europäischer Souveränitätsperspektive. Die Daten liegen in einer Supabase-Datenbank, das Frontend ist eine schlanke statische Website auf Vercel. Jede Änderung wird automatisch als Version archiviert — man kann jederzeit sehen, wer was wann geändert hat, und auf frühere Fassungen zurücksetzen.

## Zwei Atlas-Tabs

1. **Konversations-LLMs** — Text-zu-Text-Modelle, die Deutsch beherrschen (Hygienefaktor).
2. **Spezial-Modalitäten** — Bild, Video, Audio-zu-Text, Text-zu-Sprache, Musik. Eigenes Schema.

## Zwei Ansichten pro Atlas

- **Liste** — klassische Karten-Ansicht für Recherche und Diskussion.
- **Quartett** — Quartettkarten-Ansicht für spätere Marketing-Ausgabe. Konfigurierbar (welche Statistiken auf den Karten erscheinen) und druckbar (9 Karten pro A4).

## Editieren

### 1. Edit-Mode aktivieren

Oben rechts im Header auf **„Edit Mode"** klicken. Es erscheint ein Dialog:

- **Passwort:** `bvdw-atlas-2026` (kann in den Vercel ENV-Variablen rotiert werden)
- **Dein Name:** wird in der Versionshistorie zu jeder Änderung gespeichert. Kein Account-System — das Team vertraut sich gegenseitig. Der Name bleibt im Browser gespeichert.

Ist der Edit-Mode aktiv, sehen alle Karten einen orangen Rahmen und einen kleinen Stift-Button oben rechts.

### 2. Modell bearbeiten

Stift-Button auf einer Karte klicken. Das Edit-Modal zeigt alle Felder des Modells als Formular:

- Grundlegende Felder: Name, Vendor, Land, Region, Tier, Release-Jahr, Parameter, Kontextfenster
- Lizenz und URLs: License ID, Offenheit, URL, Weights-URL
- **Bilder: `image_url` (Logo) und `hero_image_url` (Hero-Bild für Quartett-Karten)**
- Souveränität: EU-Hosting, Cloud Act, Transparenz, Sovereignty-Score
- Marketing-relevant: Preis, Deutsch-Kompetenz, Specs (kommasepariert), Use Cases (kommasepariert)
- Praxisnotiz: langer Freitext

**Optional: „Edit-Kommentar"** — hier kann eine kurze Begründung stehen („Preis korrigiert", „Insider-Notiz ergänzt"). Wird in der Historie angezeigt.

Klick auf **„Speichern"** schreibt den neuen Stand in die Datenbank und legt automatisch einen Snapshot der vorherigen Fassung als Version ab. Danach wird das Frontend neu geladen und zeigt deine Änderung sofort.

### 3. Historie einsehen

Oben rechts im Header auf **„Historie"** klicken. Ein Panel fährt von rechts ins Bild:

- **Aktivitäts-Feed** — die letzten 80 Edits quer über alle Modelle, mit Name, Zeit und optionalem Kommentar
- Klick auf einen Eintrag öffnet die vollständige Versions-Historie eines einzelnen Modells
- Die aktuelle Version ist grün markiert
- Ältere Versionen haben einen **„Diese Version wiederherstellen"**-Button

### 4. Auf frühere Version zurücksetzen

Im History-Panel auf die gewünschte Version klicken → **„Diese Version wiederherstellen"**. Es kommt eine Bestätigungsabfrage. Nach dem Zurücksetzen:

- Der Datenstand dieser alten Version wird zum aktuellen
- **Gleichzeitig wird dieser Revert als NEUE Version in die Historie eingetragen** — wer wann auf welche Fassung zurückgesetzt hat, ist transparent nachvollziehbar
- Die Original-Historie bleibt vollständig erhalten

### 5. Edit-Mode beenden

Gleicher Button wie zur Aktivierung — heißt dann „Edit beenden". Session-Passwort wird vergessen, Karten kehren in den normalen Modus zurück.

## Bilder pflegen

Jedes Modell hat zwei Bild-Felder:

- **`image_url`** — Logo des Herstellers. Standard: Clearbit-Logo-Service (`https://logo.clearbit.com/{domain}`). Clearbit trifft etwa 70% der Hersteller automatisch. Wenn das Logo nicht lädt oder falsch ist, im Edit-Mode eine neue URL eintragen.
- **`hero_image_url`** — größeres Hintergrundbild für die Quartett-Karten. Standardmäßig leer. Wenn leer, zeigt die Karte einen regions-farbigen Gradient. Für die Marketing-Quartettkarten kann das Team pro Modell ein eigenes Hero-Bild einsetzen — zum Beispiel AI-generierte Bilder im BVDW-Stil oder passende Motive von der BVDW-Website.

**Später (Phase 2):** Ein Script kann optional FLUX oder Stable Diffusion anwerfen und pro Modell ein Hero-Bild rendern lassen. Das ist vorgesehen, aber noch nicht gebaut.

## Quartett-Modus

Button „Quartett" neben den Atlas-Tabs aktiviert die Quartettkarten-Ansicht.

- **Karten konfigurieren** öffnet ein Panel, in dem bis zu 6 Statistik-Felder pro Karte gewählt werden können (Kontext, Parameter, Souveränität, Release-Jahr, Preis, Deutsch, Offenheit, Tier, EU-Hosting, Cloud Act, Transparenz, Modalitäten)
- **Drucken / PDF exportieren** öffnet den Browser-Drucken-Dialog. Das Print-Stylesheet layoutet 9 Karten pro A4-Seite, zwei-zu-drei-Verhältnis, ohne UI-Elemente drumherum. In Chrome/Safari als PDF speichern.
- Filter wirken auch im Quartett-Modus — du kannst z.B. "nur DACH + EU, Sovereignty ≥ 4" filtern und dann eine druckfertige Quartett-Kollektion exportieren.

## Passwort rotieren

Im Vercel-Dashboard:

1. Projekt **bosses-foundation-models** öffnen
2. Settings → Environment Variables
3. `EDIT_PASSWORD` editieren, speichern
4. Redeploy anstoßen (Deployments → latest → Redeploy)

Danach gilt das neue Passwort. Alte Session-Passwörter in Browser-Tabs funktionieren nicht mehr.

## Was passiert, wenn jemand etwas kaputt macht?

Nichts, was nicht reparabel wäre:

- Alle Änderungen haben einen vollständigen Versions-Snapshot in `model_versions`. Auch Bulk-Probleme lassen sich pro Modell einzeln zurücksetzen.
- Die ursprünglichen Import-JSONs (`models.json`, `specialized_models.json`) bleiben als Referenz im Repo liegen. Ein erneutes `npm run import` re-importiert nichts, was schon existiert — der Service ist insert-only.
- Im Notfall: direkt in Supabase Studio → `models`-Tabelle → einzeilige SQL-UPDATEs. Service-Role-Zugang hat Bosse.

## Technik-Kurzüberblick (für Interessierte)

```
BVDW/
├── index.html, styles.css, app.js      # Static Frontend, deployed via Vercel
├── api/                                # Vercel Serverless Functions (Node 20)
│   ├── models.js    GET                # Modelle eines Atlas laden
│   ├── meta.js      GET                # Meta + Lizenzen
│   ├── history.js   GET                # Versionen (Feed oder pro Modell)
│   ├── auth.js      POST               # Password-Check
│   ├── edit.js      POST               # Modell aktualisieren + Snapshot
│   └── revert.js    POST               # Alte Version wiederherstellen
├── scripts/
│   ├── init-db.js                      # DB-Schema anlegen
│   └── import.js                       # JSONs einmalig in Supabase importieren
├── supabase/schema.sql                 # Lesbares Schema
├── models.json, specialized_models.json # Quelldaten, bleiben als Backup
└── .env.local                          # Secrets (nicht in Git!)
```

Daten liegen in Supabase (Projekt `Query`, Reference `oidtbnhyyydvpkuqzgbs`). Row Level Security erlaubt SELECT für alle, Writes gehen ausschließlich über die API-Routen mit Service-Role-Key und Password-Check.

## Fragen?

→ Bosse (AI Tech Lab Lead)
