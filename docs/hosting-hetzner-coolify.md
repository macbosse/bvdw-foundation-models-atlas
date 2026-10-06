# Hosting-Konzept: Umzug auf Hetzner Cloud + Coolify

**Stand: 6. Oktober 2026 · Status: Entwurf zur Entscheidung · Autor: BVDW AI Tech Lab**

Der Atlas läuft heute auf Vercel (Frontend + Serverless-API, US-Anbieter) und Supabase (Postgres, US-Anbieter mit Rechenzentrum Frankfurt, Free-Tier mit Auto-Pause). Für den offiziellen Live-Betrieb beim BVDW soll die Plattform auf einen eigenen Server bei Hetzner (Deutschland) mit Coolify als Deployment-Oberfläche umziehen. Dieses Dokument bewertet den Schritt, dimensioniert den Server und beschreibt den Weg dorthin.

---

## 1. Einschätzung: Lohnt sich der Umzug?

**Ja, aus drei Gründen.**

1. **Glaubwürdigkeit.** Der Atlas bewertet Modelle nach Souveränitätskriterien und empfiehlt dem Mittelstand EU-Infrastruktur („Bucket B1/B2“). Ein Verbandsangebot, das selbst auf zwei US-Plattformen läuft, ist angreifbar. Hetzner (Gunzenhausen, Rechenzentren Nürnberg und Falkenstein) ist genau der Anbietertyp, den der Atlas als souveräne Option beschreibt.
2. **Betriebssicherheit.** Die Supabase-Free-Tier-Pause hat die Live-Seite monatelang leer laufen lassen. Ein eigener Postgres pausiert nicht. Keep-Alive-Crons entfallen vollständig.
3. **Lock-in.** Vercel-spezifisch sind nur `vercel.json` und die Handler-Signatur der API-Funktionen; Supabase-spezifisch ist nur der Client `supabase-js`. Beides ist in einem Arbeitstag ersetzt (Abschnitt 4).

**Zur DSGVO-Einordnung, nüchtern:** Der Atlas verarbeitet fast keine personenbezogenen Daten. Es gibt keine Nutzerkonten, keine Cookies, kein Tracking. Personenbezug entsteht nur durch die Namen der Redakteure in der Versionshistorie und durch IP-Adressen in Server-Logs. Der heutige Betrieb ist deshalb nicht rechtswidrig. Der Umzug ist eine Entscheidung für Konsistenz und Kontrolle, nicht die Heilung eines Verstoßes. Was beim Go-live tatsächlich fehlt, steht in Abschnitt 5 (Impressum, Datenschutzerklärung, Drittanbieter-Ressourcen im Frontend).

**Coolify statt Vercel:** richtig. Coolify ist eine selbst gehostete Open-Source-Plattform (Docker-basiert), die Git-Deploys per Webhook, TLS via Let's Encrypt, Datenbanken als Ein-Klick-Dienst und S3-Backups mitbringt. Hetzner bietet Coolify als Ein-Klick-App beim Anlegen des Servers an. Der Betriebsaufwand liegt deutlich unter einem handgepflegten Docker-Setup, aber über Vercel: Server-Updates, Coolify-Updates und Backup-Kontrolle liegen beim BVDW.

---

## 2. Zielarchitektur

```
Browser ──HTTPS──▶ atlas.bvdw.org  (DNS A/AAAA → Hetzner-Server, Nürnberg)
                      │
              Hetzner Cloud Firewall (80, 443; SSH nur von BVDW-IPs)
                      │
              Coolify-Proxy (Traefik, Let's Encrypt)
                      ├─▶ Container „atlas“: Node-Server
                      │     • liefert index.html, app.js, styles.css, assets/ aus
                      │     • bedient /api/* (dieselben Handler wie heute, pg statt supabase-js)
                      ├─▶ Container „postgres“: PostgreSQL 16 (Coolify-Datenbank, nur intern erreichbar)
                      └─▶ optional: Uptime Kuma (Monitoring mit E-Mail-Alarm auf /api/health)

Backups: Hetzner-Backups (täglich, 7 Slots) + Coolify-DB-Dump nach Hetzner Object Storage (S3, NBG1/FSN1)
         + weiterhin `npm run export-all` als JSON im Git-Repo
```

Ein einzelner Server genügt. Der Atlas ist eine statische Seite mit zwei API-Aufrufen pro Besuch, die Datenbank hat wenige hundert Zeilen und unter 5 MB. Hochverfügbarkeit über mehrere Server wäre Overkill; die Rückfallebene ist der Hetzner-Snapshot plus das JSON-Backup im Repo.

---

## 3. Servergröße und Kosten

Preise laut Datenquelle von hetzner.com am 6. Oktober 2026, Standort Nürnberg (NBG1), monatlich, inklusive einer IPv4-Adresse, zuzüglich Umsatzsteuer. Die günstige Linie „Cost-Optimized“ (CX23, CAX11 …) wird auf der Hetzner-Seite derzeit als nicht bestellbar geführt und bleibt deshalb außen vor.

| Typ | vCPU | RAM | NVMe | Traffic inkl. | Preis/Monat | Bewertung |
|---|---|---|---|---|---|---|
| CPX12 (shared, AMD) | 1 | 2 GB | 40 GB | 20 TB | 11,49 € | Unter dem Coolify-Minimum von 2 Kernen, nicht empfohlen |
| **CPX22 (shared, AMD)** | **2** | **4 GB** | **80 GB** | **20 TB** | **19,49 €** | **Empfehlung: Coolify + Atlas + Postgres + Monitoring mit Reserve** |
| CPX32 (shared, AMD) | 4 | 8 GB | 160 GB | 20 TB | 35,49 € | Nur wenn weitere Dienste dazukommen (Staging, Analytics, zweite App) |
| CCX13 (dedicated, AMD) | 2 | 8 GB | 80 GB | 20 TB | 42,99 € | Dedizierte Kerne, für diesen Workload unnötig |

**Begründung der Dimensionierung.** Coolify selbst nennt 2 Kerne, 2 GB RAM und 10 GB Disk als Minimum und zeigt in der eigenen Dokumentation einen Server mit 2 vCPU und 4 GB RAM, der 16 statische Seiten, 9 APIs und 5 Full-Stack-Apps gleichzeitig trägt. Erwarteter Bedarf hier: Coolify rund 1 bis 1,5 GB, Postgres unter 300 MB, Node-App unter 200 MB, Proxy rund 100 MB. 4 GB RAM lassen damit mehr als 1 GB Luft; 80 GB NVMe reichen für Jahre an Backups und Versionshistorie.

**Laufende Kosten (Richtwert):** 19,49 € Server + Hetzner-Backups (prozentualer Aufschlag auf den Serverpreis, Satz auf hetzner.com prüfen) + optional Object Storage für externe DB-Dumps. Realistisch 25 bis 30 € pro Monat netto. Zum Vergleich: heute 0 € im Free-Tier mit Pausenrisiko, die Alternative „Supabase Pro“ läge bei 25 US-Dollar pro Monat plus Vercel.

**Standort:** Nürnberg (NBG1) oder Falkenstein (FSN1), beide in Deutschland, ISO/IEC 27001 und laut Hetzner BSI-C5-testiert. Helsinki wäre ebenfalls EU, aber für die Außendarstellung ist „Server in Deutschland“ das stärkere Argument.

---

## 4. Was am Code zu ändern ist

Der Umzug ist bewusst klein gehalten, weil die Architektur schon heute nur zwei externe Abhängigkeiten hat.

1. **Vercel raus (ca. 80 Zeilen plus Dockerfile).** Ein kleiner Node-Server (Hono oder Express) liefert die statischen Dateien aus und ruft die bestehenden API-Handler über einen `(req, res)`-Adapter auf. Das `cleanUrls`-Verhalten aus `vercel.json` wird im Server nachgebildet. Coolify baut das Dockerfile bei jedem Push auf `main`.
2. **Supabase raus (ca. ein Arbeitstag inklusive Test).** `supabase-js` wird in den neun API-Dateien und sechs Scripts durch direkte `pg`-Queries ersetzt. Alle Zugriffe sind einfache Selects, Upserts und Inserts in fünf Tabellen; Row-Level-Security entfällt, weil nur der Server mit der Datenbank spricht und der Edit-Mode weiter per Passwort geschützt ist. Alternative mit weniger Code-Änderung: PostgREST als Sidecar behalten, dann funktioniert `supabase-js` fast unverändert. Empfehlung ist trotzdem der `pg`-Port: weniger Komponenten, weniger Angriffsfläche.
3. **Daten migrieren (30 Minuten).** `npm run export-all` gegen Supabase, `supabase/schema.sql` ohne die RLS-Zeilen gegen den neuen Postgres, dann `import-all` (auf `pg` umgestellt). Alternativ `pg_dump` der Tabellen `models`, `model_versions`, `licenses`, `atlas_meta`, `vendors`, `heartbeat`.
4. **Keep-Alive entfällt.** Die Crons in `vercel.json` und der Workflow-Ping werden nicht mehr gebraucht; `/api/health` bleibt als Ziel für Uptime Kuma, der GitHub-Workflow kann auf einen reinen Health-Check reduziert oder gelöscht werden.
5. **Konfiguration in Coolify:** `DATABASE_URL`, `EDIT_PASSWORD`, optional `NODE_ENV`. Keine Secrets im Repo, wie bisher.

Vercel bleibt parallel online, bis `atlas.bvdw.org` auf den neuen Server zeigt. Danach wird das Vercel-Projekt gelöscht und das Supabase-Projekt nach einem letzten Export pausiert oder gelöscht.

---

## 5. DSGVO- und Betriebs-Checkliste für den Go-live

Unabhängig vom Hoster fehlen für einen offiziellen Verbandsauftritt heute diese Punkte:

- [ ] **Impressum und Datenschutzerklärung** auf der Seite verlinken (bisher `noindex`, kein Footer-Link). Inhalte: Hoster Hetzner als Auftragsverarbeiter, Server-Logs, Speicherung von Redakteursnamen in der Versionshistorie, keine Cookies, `localStorage` nur für den Namen im Edit-Mode.
- [ ] **AVV mit Hetzner** abschließen (online im Hetzner-Konto). Kein Drittlandtransfer, keine Standardvertragsklauseln nötig.
- [ ] **Drittanbieter-Ressourcen im Frontend entfernen.** Heute laden Besucherbrowser `pdf-lib` und `qrcode-generator` von cdn.jsdelivr.net sowie Hersteller-Logos von unpkg.com, api.dicebear.com, cdn.simpleicons.org und Flaggen von flagcdn.com. Jeder Aufruf überträgt die Besucher-IP an einen US-Dienst. Lösung: die zwei JavaScript-Bibliotheken ins Repo legen (zusammen unter 1 MB) und die Logos einmalig per Script lokal unter `assets/logos/` ablegen. Aufwand etwa zwei Stunden; das ist der wichtigste konkrete DSGVO-Gewinn des Umzugs.
- [ ] **Logs**: Access-Logs im Coolify-Proxy mit IP-Kürzung oder kurzer Aufbewahrung (7 Tage) konfigurieren.
- [ ] **Zugänge**: SSH nur per Schlüssel und aus dem BVDW-Netz (Hetzner-Firewall), Coolify-Dashboard hinter 2FA, Edit-Passwort beim Go-live rotieren.
- [ ] **Backups**: Hetzner-Backups aktivieren, Coolify-DB-Dump täglich nach Object Storage (verschlüsselt, Object Lock gegen Ransomware), monatlich eine Wiederherstellung testen.
- [ ] **Updates**: `unattended-upgrades` für das Betriebssystem, Coolify-Updates monatlich, Node-Image mit festgepinnter LTS-Version.
- [ ] **Verzeichnis von Verarbeitungstätigkeiten** um den Atlas ergänzen (Redakteursnamen, Server-Logs).

---

## 6. Vorgehen in Schritten

| Schritt | Inhalt | Aufwand |
|---|---|---|
| 1 | Hetzner-Konto des BVDW, Projekt anlegen, CPX22 in Nürnberg mit Ubuntu 24.04 und Ein-Klick-App Coolify, Firewall, Backups aktivieren | 1 Stunde |
| 2 | Coolify: GitHub-Repo verbinden, Postgres-Dienst anlegen, Object-Storage-Backup einrichten | 1 Stunde |
| 3 | Code: Node-Server + Dockerfile, `pg`-Port der API und Scripts, Drittanbieter-Assets lokal | 1 bis 1,5 Tage |
| 4 | Daten migrieren, Smoke-Test auf Coolify-Vorschaudomain, Edit-Mode und Historie prüfen | 2 Stunden |
| 5 | DNS `atlas.bvdw.org` umstellen, TLS prüfen, Uptime Kuma mit Alarm, Impressum und Datenschutzerklärung live | 2 Stunden |
| 6 | Vercel-Projekt und Supabase-Projekt nach letztem Export abschalten, Doku aktualisieren | 1 Stunde |

Gesamt rund zwei Arbeitstage, davon der größte Teil der Code-Port in Schritt 3.

---

## 7. Offene Entscheidungen

- Wer besitzt und bezahlt das Hetzner-Konto (BVDW-Geschäftsstelle oder AI Tech Lab)?
- Domain: `atlas.bvdw.org` oder eigene Domain?
- Backup-Ziel: Hetzner Object Storage oder vorhandene BVDW-Infrastruktur?
- Soll eine Staging-Instanz mitlaufen (spricht für CPX32)?
- Monitoring-Alarm per E-Mail oder in einen BVDW-Kanal (Slack, Teams)?

---

## 8. Variante: gesamter Tech-Stack auf eigener Infrastruktur (Ergänzung 6. Oktober 2026)

Wenn neben dem Atlas auch der übrige Projekt-Stack (mehrere Supabase-Instanzen, Trigger.dev, weitere Apps) selbst gehostet werden soll, ändert sich die Dimensionierung, nicht das Prinzip. Alle Hetzner-Cloud-Server sind vollwertige KVM-VMs mit Root-Zugang; Coolify läuft darauf ohne Einschränkung.

**Empfehlung: zwei Maschinen statt einer.**

| Zweck | Maschine | Preis/Monat (netto, Stand 06.10.2026) | Warum |
|---|---|---|---|
| BVDW-Atlas (Verbandsbetrieb, später Übergabe) | Cloud CPX22, 2 vCPU / 4 GB / 80 GB, Nürnberg | 19,49 € | Sauber trennbar, eigener Hetzner-Account des BVDW möglich, keine Vermischung mit privaten Projekten (Verantwortlicher im DSGVO-Sinn ist der BVDW) |
| Eigener Projekt-Stack (Supabase-Instanzen, Trigger.dev, Apps) | Dedicated AX42, Ryzen 7 PRO 8700GE 8 Kerne / 64 GB DDR5 ECC / 2× 512 GB NVMe, Falkenstein | 99 € + 49 € einmalig | RAM ist der Engpass: jede selbst gehostete Supabase-Instanz braucht 4 bis 8 GB, Trigger.dev v4 (Webapp, Worker, Postgres, Redis, ClickHouse, Registry, Object Store) weitere 8 GB; 64 GB tragen 4 bis 6 Supabase-Stacks plus Trigger.dev plus Apps |
| Alternative Cloud-Variante | Cloud CPX42, 8 vCPU / 16 GB / 320 GB | 69,49 € | Reicht für Atlas + Trigger.dev + 1 bis 2 Supabase-Stacks; Snapshots und Cloud-Firewall inklusive, aber bei vielen Supabase-Instanzen schnell am RAM-Limit |

Weitere Preispunkte vom selben Tag: Cloud CCX33 (8 dedizierte vCPU / 32 GB) 138,49 €, Dedicated EX63 (20 Kerne / 64 GB) 149 € + 74 € Setup. Hetzners Serverbörse (gebrauchte Dedicated-Server ohne Setup-Gebühr) lohnt immer einen Blick, die Preise dort schwanken täglich.

**Hinweise zu den Komponenten:**

- *Supabase self-hosted* ist pro Stack ein eigenes Postgres mit eigenem Studio, Auth und PostgREST. „Beliebig viele Tabellen“ ist damit kein Problem mehr, aber jedes Projekt bekommt sinnvollerweise seinen eigenen Stack (Coolify-Template „Supabase“), nicht ein geteilter. Backups pro Stack einrichten.
- *Trigger.dev v4 self-hosted* ist die aufwendigste Komponente (mehrere Container, eigene Registry, Deploy-Pipeline). Bei geringer Last ist der Trigger.dev-Cloud-Tarif oft die günstigere Wahl; Self-Hosting lohnt vor allem wegen Datenhoheit und vieler paralleler Projekte.
- *Dedicated statt Cloud* heißt: kein Snapshot-Knopf, keine Cloud-Firewall, Backups selbst organisieren (Hetzner Storage Box oder Object Storage, Coolify-Backups), Hetzner-Robot-Firewall nutzen, monatliche Kündigungsfrist.
- Die größte erwartete Last kommt tatsächlich vom Atlas (öffentlich, Verbandsreichweite); sie ist trotzdem klein, weil die Seite statisch ist und pro Besuch zwei kleine API-Aufrufe macht. Ein CPX22 trägt das mit großer Reserve.
