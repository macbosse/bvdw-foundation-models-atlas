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

## 8. Gesamter Tech-Stack auf einer Maschine (aktualisiert 6. Oktober 2026)

Der Atlas bleibt auf Bosses Hosting und wird dem BVDW per internem Agreement bereitgestellt. Damit kann er mit den übrigen Projekten (mehrere Supabase-Instanzen, Trigger.dev, Apps) auf **einer** Maschine laufen. Alle Hetzner-Cloud-Server sind vollwertige KVM-VMs mit Root-Zugang; ein Dedicated Server ist für diesen Zweck nicht nötig.

**Was bei „viele Projekte, fast keine Last“ wirklich zählt, ist RAM, nicht CPU.** Idle-Container verbrauchen kaum CPU, halten aber ihren Speicher:

| Komponente | RAM im Leerlauf (Richtwert) |
|---|---|
| Coolify (Dashboard, Proxy, Postgres, Redis) | 1 bis 1,5 GB |
| Supabase-Stack self-hosted (Postgres, Studio, Auth, PostgREST, Storage; Realtime/Analytics abgeschaltet) | 2 bis 3 GB pro Instanz |
| Trigger.dev v4 self-hosted (Webapp, Worker, Postgres, Redis, ClickHouse, Registry, Object Store) | 4 bis 6 GB |
| Node-/Next.js-App | 100 bis 250 MB |
| einzelner Postgres-Dienst (Coolify Ein-Klick) | 100 bis 300 MB |

**Einstieg: Cloud CPX32 (4 vCPU, 8 GB, 160 GB NVMe, 35,49 €/Monat netto).** Das trägt Coolify, den Atlas, eine gemeinsame Supabase-Instanz, ein halbes Dutzend kleine Apps und mehrere einzelne Postgres-Datenbanken. Hetzner-Cloud-Server lassen sich mit wenigen Minuten Ausfall auf CPX42 (8 vCPU, 16 GB, 69,49 €) hochskalieren; mit der Option „nur CPU/RAM“ bleibt die Platte unverändert und der Weg zurück offen. Deshalb klein starten und wachsen, statt vorab 64 GB zu mieten.

**Damit 8 GB reichen, drei Konsolidierungsregeln:**

1. **Nicht pro Projekt ein Supabase-Stack.** Projekte, die nur serverseitig per Service-Role auf die Datenbank zugreifen (wie der Atlas), brauchen gar kein Supabase, sondern nur eine Postgres-Datenbank aus Coolify. Eine gemeinsame Supabase-Instanz bleibt für die Projekte, die Auth, Storage oder Realtime nutzen; Trennung dort über Schemas oder Datenbanken. Erst wenn getrennte Nutzerkreise (eigene Auth) nötig sind, lohnt ein zweiter Stack.
2. **Trigger.dev zunächst in der Cloud lassen.** Der Self-Host-Stack ist die mit Abstand schwerste Komponente und bei geringer Last teurer als der Cloud-Tarif. Self-Hosting nachziehen, wenn der Server ohnehin auf 16 GB wächst.
3. **Speicherlimits in Coolify setzen** (pro Dienst), damit ein einzelner Container nicht die ganze Maschine zieht; 2 GB Swap als Puffer einrichten.

Der CPX22 (2 vCPU, 4 GB, 19,49 €) reicht nur für Coolify, den Atlas, einzelne Postgres-Datenbanken und ein paar kleine Apps, aber nicht für einen Supabase-Stack. Dedicated-Server (AX42 mit 64 GB: 99 € plus 49 € Setup, Stand 6. Oktober 2026) werden erst interessant, wenn mehrere Supabase-Instanzen und Trigger.dev dauerhaft selbst laufen sollen; Hetzners Serverbörse bietet dann oft günstigere Gebrauchtmaschinen.

**Hinweis zur Dokumentation:** `HANDOVER_BVDW.md` geht noch von einer Übergabe des Betriebs an den BVDW aus. Mit dem internen Agreement wird daraus ein Betriebs- und Bereitstellungsdokument (Verantwortlichkeiten, Erreichbarkeit, Backup-Zusagen); diese Anpassung steht noch aus.
