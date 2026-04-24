// BVDW Foundation Models Atlas — Client
// Lädt Daten von /api/*, rendert Liste + Quartett, bietet Edit-Mode + History.

// ─── State ─────────────────────────────────────────────────────────────────
const STATE = {
  atlas: 'conversational',  // 'conversational' | 'specialized'
  view: 'list',             // 'list' | 'quartett'
  data: { conversational: null, specialized: null },
  filters: { search: '', region: new Set(), tier: new Set(), openness: new Set(), usecase: new Set(), buckets: new Set(), sov: 0, price: 6, german: 0, onprem: 'all' },
  edit: {
    active: false,
    password: null,  // sessionStorage
    editor: null     // localStorage
  },
  historyOpen: false,
  historyMode: 'feed',  // 'feed' | 'single'
  historyModelId: null,
  sort: 'alpha',
  quartett: {
    configOpen: false,
    stats: ['context', 'params', 'sovereignty', 'year']
  }
};

// ─── Feld-Erklärungen für Info-Tooltips + Footer-Legende ───────────────────
const FIELD_EXPLAIN = {
  region: {
    label: 'Region',
    short: 'Geografische Einordnung des Hersteller-Rechtssitzes.',
    detail: 'Entscheidend für DSGVO-Anwendbarkeit und CLOUD-Act-Exposition.\n\n• DACH — Deutschland, Österreich, Schweiz\n• EU — Europäische Union (außerhalb DACH)\n• US — USA\n• CN — China\n• KR — Südkorea · JP — Japan · IN — Indien\n• MENA — Naher Osten / Nordafrika\n• AF — Afrika · RU — Russland\n• INTL — Multinational / keine eindeutige Zuordnung'
  },
  year: {
    label: 'Release',
    short: 'Jahr der ersten öffentlichen Verfügbarkeit bzw. der aktuellen Hauptversion.',
    detail: 'Bei Modellfamilien mit mehreren Versionen wird das jüngste Release des aktuellen Haupt-Modells angegeben.'
  },
  params: {
    label: 'Parameter',
    short: 'Anzahl trainierbarer Parameter.',
    detail: 'Angabe in Milliarden (B) oder Billionen (T). Bei Mixture-of-Experts: Gesamt-/aktive Parameter (z.B. "671B total / 37B active"). Sagt etwas über Modellgröße und Hardwareanforderungen, aber wenig direkt über Qualität.'
  },
  context: {
    label: 'Kontextfenster',
    short: 'Maximale Eingabelänge in Tokens.',
    detail: 'Ein Token entspricht im Deutschen ca. 0,6–0,8 Wörtern. 128K Tokens ≈ 85.000–100.000 Wörter ≈ ein mittelgroßes Buch. Längere Kontexte ermöglichen längere Dokument-Analysen, erhöhen aber auch Latenz und Preis.'
  },
  modalities: {
    label: 'Modalitäten',
    short: 'Eingabe-/Ausgabe-Typen, die das Modell verarbeiten kann.',
    detail: 'text = nur Text-Ein- und -Ausgabe\nimage = Bildverständnis oder -erzeugung\naudio = Sprach-/Musik-Verarbeitung\nspeech = Speech-to-Text oder Text-to-Speech\nvideo = Video-Verständnis oder -Erzeugung\ncode = spezialisiert auf Programmcode\nembedding = Vektor-Repräsentationen'
  },
  german_capability: {
    label: 'Deutsch',
    short: 'Redaktionelle Einschätzung der Deutsch-Kompetenz.',
    detail: '• low — Grundlegend, nur für interne Tests geeignet, nicht für Kundenkommunikation\n• medium — Brauchbar für interne Tools, nicht für öffentliche Marketing-Texte\n• high — Nativ-nahe Qualität, auch für externe Kommunikation einsetzbar\n\nEinschätzung basiert auf Community-Tests, Vendor-Angaben und eigener Erfahrung des AI Tech Lab.'
  },
  pricing: {
    label: 'Preis',
    short: 'Relative API-Kosten pro Million Tokens (Input + Output gemittelt).',
    detail: '• € — unter $1 / Mio Tokens\n• €€ — $1 bis $5 / Mio\n• €€€ — $5 bis $20 / Mio\n• €€€€ — $20 bis $75 / Mio\n• €€€€€ — $75 bis $200 / Mio\n• €€€€€€ — über $200 / Mio\n\nFür Open-Source-Modelle: geschätzte Kosten der Selbst-Inferenz auf H100-Hardware. Preise können sich schnell ändern — immer beim Vendor prüfen.'
  },
  openness: {
    label: 'Offenheit',
    short: 'Grad der Verfügbarkeit von Gewichten und Code.',
    detail: '• closed — nur über Vendor-Infrastruktur, keine Gewichte\n• api-only — API verfügbar, Gewichte nicht\n• weights-research — Gewichte für Forschung, kommerziell eingeschränkt\n• open-weights — Gewichte frei herunterladbar, Nutzung teils eingeschränkt\n• open-source — Code + Gewichte + Trainingsdaten frei (OSI-konform)\n• public-domain — explizit gemeinfrei oder CC0'
  },
  tier: {
    label: 'Tier',
    short: 'Einordnung nach Positionierung und Reife.',
    detail: '• FC frontier-closed — State-of-the-Art, nur via API (OpenAI GPT, Anthropic Claude, Gemini)\n• FO frontier-open — State-of-the-Art mit offenen Gewichten (Llama 4, DeepSeek V3, Qwen 3)\n• RG regional — Stark in bestimmter Region/Sprache (Aleph Alpha, Sarvam, EXAONE)\n• SP specialist — Spezialisiert auf Domäne (Codestral, Mathstral, Med42)\n• RS research — Forschungsmodell, selten produktiv (OLMo, Tülu, Molmo)'
  },
  sovereignty: {
    label: 'Souveränitäts-Score',
    short: 'Redaktioneller Score von 1 bis 5 Punkten.',
    detail: 'Ganzzahlige Einschätzung des AI Tech Lab aus vier Teilkriterien:\n\n1. EU-Hosting verfügbar? (ja / nein)\n2. CLOUD-Act-Exposition (none / low / medium / high)\n3. Trainingsdaten-Transparenz (none / low / medium / high)\n4. Lizenz-Offenheit (closed bis public-domain)\n\nKeine algorithmische Berechnung — der Score ist eine qualitative Gewichtung durch das AI Tech Lab und wird bei Abweichungen zwischen Kriterien nach Relevanz für BVDW-Mitgliedsunternehmen entschieden.'
  },
  eu_host: {
    label: 'EU-Hosting',
    short: 'Kann das Modell auf EU-basierter Infrastruktur betrieben werden?',
    detail: 'ja = Entweder bietet der Vendor eine EU-Region (z.B. Azure OpenAI EU, AWS Bedrock eu-central) oder die Gewichte sind frei und können auf eigener EU-Infrastruktur deployed werden.\n\nnein = Nur über außer-europäische Infrastruktur abrufbar.'
  },
  cloud_act: {
    label: 'US CLOUD Act-Exposition',
    short: 'Rechtliche Zugriffsmöglichkeit von US-Behörden auf Daten.',
    detail: 'Der Clarifying Lawful Overseas Use of Data Act (2018) erlaubt US-Behörden Zugriff auf Daten, die von US-Unternehmen gespeichert werden — auch wenn die Server in der EU stehen.\n\n• none — Kein US-Unternehmen, kein US-Tochterunternehmen. Nicht betroffen.\n• low — EU-Tochter eines Nicht-US-Konzerns oder ähnlich begrenzt\n• medium — US-Company mit starken EU-Datenschutz-Commitments und EU-Region\n• high — US-Hauptsitz, volle Anwendbarkeit'
  },
  transparency: {
    label: 'Transparenz',
    short: 'Offenheit über Trainingsdaten, Methodik und Dokumentation.',
    detail: '• none — Keine öffentliche Dokumentation\n• low — Grundlegende Modellkarte, keine Details zu Trainingsdaten\n• medium — Detaillierte Modellkarte, grobe Daten-Zusammenfassung, ggf. Paper\n• high — Vollständige Transparenz: Trainingsdaten, Code, Checkpoints, Evaluationen, Peer-Review-Paper'
  },
  on_prem: {
    label: 'On-Prem-Betrieb',
    short: 'Kann das Modell auf eigener Infrastruktur betrieben werden?',
    detail: 'Wichtigstes Kriterium für DSGVO-Konformität und CLOUD-Act-Resilienz.\n\n• Ja — Gewichte sind frei verfügbar, komplette Selbstkontrolle über Daten und Infrastruktur möglich\n• Teilweise (hybrid) — Inference lokal möglich, aber Fine-Tuning oder Evaluation nur in Vendor-Cloud\n• Nein — Ausschließlich über die Cloud-API des Anbieters\n• Unbekannt — Status nicht abschließend geklärt\n\nHeuristisch aus "Offenheit" abgeleitet, kann im Edit-Modus pro Modell manuell angepasst werden.'
  },
  license: {
    label: 'Lizenz',
    short: 'Nutzungslizenz des Modells.',
    detail: 'Zeigt den offiziellen Lizenznamen. Klick auf die Lizenz öffnet ein Modal mit einer verständlichen Erklärung, was die Lizenz erlaubt, einschränkt und wann sie kommerzielle Nutzung zulässt.'
  },
  use_cases: {
    label: 'Use Cases',
    short: 'Typische Einsatzszenarien.',
    detail: 'Redaktionelle Einschätzung des AI Tech Lab. Nicht erschöpfend und nicht als Empfehlung zu verstehen.\n\nStandardisierte Tags wie "marketing-text", "kundenkommunikation", "datenanalyse", "code", "research", "compliance", "agent", "long-context".'
  },
  specs: {
    label: 'Eigenschaften',
    short: 'Technische Besonderheiten und Architektur-Tags.',
    detail: 'Freie Tags, die das Modell charakterisieren (z.B. "mixture-of-experts", "mamba", "reasoning", "instruction-tuned"). Hilft bei der schnellen Einordnung der Modell-Architektur.'
  },
  insider: {
    label: 'Praxisnotiz',
    short: 'Ehrliche Kurzeinschätzung aus Praxis-Erfahrung.',
    detail: 'Das Besondere an diesem Modell — wofür ist es überraschend gut, was sind bekannte Schwächen? Keine Werbung, keine Marketing-Sprache, sondern die Sorte Information, die im Vendor-Marketing meist fehlt.'
  },
  deployment_buckets: {
    label: 'Einsatz-Optionen (5 Buckets)',
    short: 'Realistische Deployment-Szenarien für deutschen Mittelstand, in 5 Stufen von maximal souverän bis maximal convenient.',
    detail: 'Jedes Modell wird automatisch in die passenden Buckets eingeordnet — abhängig von Offenheit (open-weights vs. api-only) und Herstellerregion. Die Buckets sind:\n\n• B1 Eigene Hardware — On-Prem im eigenen Rechenzentrum, maximale Souveränität\n• B2 EU-Sovereign-Cloud — managed GPUs bei STACKIT/IONOS/OVHcloud usw., DSGVO-konform ohne Cloud-Act\n• B3 EU-Vendor-API — direkter API-Zugriff beim EU-Hersteller\n• B4 US-Hyperscaler EU-Region — Azure/AWS/GCP in EU-Region, aber CLOUD Act anwendbar\n• B5 Vendor-Direct außereuropäisch — OpenAI/Anthropic direkt, Schrems-II-problematisch\n\nKlick auf eine aktive Bucket-Karte zeigt Setup, Invest, Pros/Cons.\n\nDisclaimer: Redaktionelle Orientierung, keine Rechtsberatung.'
  },
  benchmarks: {
    label: 'Benchmarks & Vergleichswerte',
    short: 'Warum wir keine eigenen Benchmark-Zahlen pflegen — und wo ihr sie dennoch findet.',
    detail: 'Wir verzichten bewusst auf gepflegte Benchmark-Werte (MMLU, GPQA, HumanEval etc.), weil:\n\n• Benchmark-Landschaften verändern sich alle paar Monate (z.B. Open LLM Leaderboard v1 → v2 mit komplett neuen Tests)\n• Contamination-Probleme führen zu retroaktiven Korrekturen\n• Vendor-Updates ohne neuen Namen verändern Werte still (GPT-4 "turbo" vs. original)\n• Einzelwerte sagen wenig über deutsche Sprachqualität oder reale Einsatzfähigkeit aus\n\nStattdessen verlinken wir pro Modell (wo vorhanden) die Hugging-Face-Model-Card. Dort sind die aktuellen, vom Hersteller oder der Community gepflegten Vergleichswerte zu finden. Für closed Vendors (GPT, Claude, Gemini) gibt es keine HF-Präsenz — dort sind die Release-Announcements der Hersteller die Referenz.'
  }
};

function infoIcon(key) {
  const e = FIELD_EXPLAIN[key];
  if (!e) return '';
  const text = e.short + (e.detail ? '\n\n' + e.detail : '');
  return `<span class="info-icon" data-tip="${escapeAttr(text)}" title="${escapeAttr(e.short)}" tabindex="0" aria-label="Erklärung ${escapeAttr(e.label)}">i</span>`;
}

// ─── Constants / Labels ────────────────────────────────────────────────────
const REGION_LABEL = { DACH: 'DACH', EU: 'EU', US: 'USA', CN: 'China', KR: 'Korea', JP: 'Japan', IN: 'Indien', MENA: 'MENA', AF: 'Afrika', RU: 'Russland', INTL: 'Intl.' };
const TIER_LABEL = { 'frontier-closed': 'Frontier closed', 'frontier-open': 'Frontier open', regional: 'Regional', specialist: 'Spezialist', research: 'Forschung' };
const OPEN_LABEL = { closed: 'Closed', 'api-only': 'Nur API', 'weights-research': 'Weights (Forschung)', 'open-weights': 'Open Weights', 'open-source': 'Open Source', 'public-domain': 'Public Domain' };

const STAT_DEFS = {
  context: { label: 'Kontext', get: m => m.context || '—', score: m => contextScore(m.context) },
  params: { label: 'Parameter', get: m => m.params || '—', score: () => null },
  sovereignty: { label: 'Souveränität', get: m => m.sovereignty || 0, score: m => (m.sovereignty || 0) / 5, asDots: true },
  year: { label: 'Release', get: m => m.year || '—', score: m => yearScore(m.year) },
  pricing: { label: 'Preis', get: m => m.pricing || '—', score: m => 1 - (priceLevel(m.pricing) - 1) / 5 },
  german: { label: 'Deutsch', get: m => (m.german_capability || '—').toUpperCase(), score: m => germanLevel(m.german_capability) / 3 },
  openness: { label: 'Offenheit', get: m => OPEN_LABEL[m.openness] || m.openness || '—', score: m => opennessScore(m.openness) },
  tier: { label: 'Tier', get: m => TIER_LABEL[m.tier] || m.tier || '—', score: () => null },
  eu_host: { label: 'EU-Hosting', get: m => m.eu_host ? 'Ja' : 'Nein', score: m => m.eu_host ? 1 : 0 },
  cloud_act: { label: 'Cloud Act', get: m => m.cloud_act || '—', score: m => cloudActScore(m.cloud_act) },
  transparency: { label: 'Transparenz', get: m => m.transparency || '—', score: m => transparencyScore(m.transparency) },
  on_prem: { label: 'On-Prem', get: m => ONPREM_LABEL[m.on_prem] || '—', score: m => onPremScore(m.on_prem) }
};

const ONPREM_LABEL = {
  yes: 'Ja',
  hybrid: 'Teilweise',
  no: 'Nein',
  unknown: '—'
};
function onPremScore(v) {
  const map = { yes: 1, hybrid: 0.55, no: 0.15, unknown: 0 };
  return map[v] ?? 0;
}

// ─── Deployment-Buckets — 5 realistische Einsatz-Szenarien für DACH ────────
// Minimalistische Line-Icons pro Bucket (24×24, stroke-Style)
const BUCKET_ICONS = {
  // Server-Rack (drei gestapelte Einheiten mit Status-LEDs)
  B1: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3" width="17" height="5" rx="1"/><rect x="3.5" y="9.5" width="17" height="5" rx="1"/><rect x="3.5" y="16" width="17" height="5" rx="1"/><circle cx="6.5" cy="5.5" r=".8" fill="currentColor"/><circle cx="6.5" cy="12" r=".8" fill="currentColor"/><circle cx="6.5" cy="18.5" r=".8" fill="currentColor"/><line x1="9.5" y1="5.5" x2="13" y2="5.5"/><line x1="9.5" y1="12" x2="13" y2="12"/><line x1="9.5" y1="18.5" x2="13" y2="18.5"/></svg>',
  // Cloud mit Sternen-Kreis (EU-Idee)
  B2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 18H7a4.5 4.5 0 0 1-1.5-8.75 6 6 0 0 1 11.74 1.25H17.5a3.75 3.75 0 0 1 0 7.5z"/><circle cx="9.5" cy="13.5" r=".7" fill="currentColor"/><circle cx="14.5" cy="13.5" r=".7" fill="currentColor"/><circle cx="12" cy="11.5" r=".7" fill="currentColor"/><circle cx="12" cy="15.5" r=".7" fill="currentColor"/></svg>',
  // Stecker/Plug (API-Symbol)
  B3: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2v5h6V2"/><path d="M5 8h14v5a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z"/><line x1="12" y1="18" x2="12" y2="22"/></svg>',
  // Cloud mit Warnhinweis
  B4: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 16H7a4.5 4.5 0 0 1-1.5-8.75 6 6 0 0 1 11.74 1.25H17.5a3.75 3.75 0 0 1 0 7.5z"/><line x1="12" y1="19" x2="12" y2="22"/><circle cx="12" cy="12" r=".9" fill="currentColor"/><line x1="12" y1="7" x2="12" y2="10.5"/></svg>',
  // Globus mit "herausgehender" Pfeil
  B5: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="12" r="8"/><path d="M3 12h16"/><path d="M11 4a14 14 0 0 1 0 16M11 4a14 14 0 0 0 0 16"/><path d="M17 7l4-4M21 7V3h-4"/></svg>'
};

const BUCKETS = {
  B1: {
    id: 'B1',
    name: 'Eigene Hardware',
    full: 'Self-Hosted On-Premise',
    short: 'GPU-Server im eigenen Rechenzentrum — maximale Datenkontrolle.',
    sovereignty: 5,
    dsgvo: 'vollständig erfüllt (keine Datenverarbeitung durch Dritte)',
    cloud_act: 'nicht anwendbar',
    setup: 'GPU-Server im eigenen Rechenzentrum. Inferenz mit vLLM, TGI, Ollama oder llama.cpp. MLOps + Monitoring eigenverantwortlich.',
    typical_for: 'Banken, Versicherungen, Anwaltskanzleien, Pharma, öffentlicher Sektor, Gesundheitswesen — typischerweise ab 250 Mitarbeitenden.',
    invest: '20 k€ (RTX 6000 Ada für 7B-Modelle) bis 500 k€+ (H100-Cluster für 70B+). Zusätzlich 0,5–2 FTE für Admin.',
    pros: ['keine Datenverarbeitung durch Dritte', 'volle BaFin/MaRisk/BSI-C5-Kompatibilität', 'kein Vendor-Lock-In', 'Latenz im eigenen LAN'],
    cons: ['hohe Initialinvestition', 'MLOps-Know-how unabdingbar', 'eigene Zertifizierungsprozesse', 'Hardware-Refresh alle 3–4 Jahre']
  },
  B2: {
    id: 'B2',
    name: 'EU-Sovereign-Cloud',
    full: 'Managed GPU-Instanzen bei EU-Providern',
    short: 'STACKIT, IONOS, OVHcloud, Open Telekom Cloud, Scaleway, Hetzner — alles gemietet, alles in EU.',
    sovereignty: 5,
    dsgvo: 'vollständig erfüllt (EU-Provider, EU-Verträge, EU-Rechenzentren)',
    cloud_act: 'nicht anwendbar (Nicht-US-Konzernstruktur)',
    setup: 'GPU-Instanz buchen (z.B. H100 bei STACKIT/IONOS), Modell eigenverantwortlich installieren und inferieren. Wie On-Prem, aber auf gemieteten VMs.',
    typical_for: 'Mittelstand 50–500 Mitarbeitende ohne eigene Server-Infrastruktur. Dynamische Workloads. PoC mit späterer On-Prem-Migration.',
    invest: 'Typisch 2–8 €/h pro H100. Pay-per-use, keine Hardware-Investition.',
    pros: ['keine Hardware-Investition', 'EU-Zertifizierungen (ISO 27001, BSI C5)', 'skalierbar nach oben und unten', 'Cloud-Act-immun'],
    cons: ['MLOps-Know-how weiterhin nötig', 'weniger Ökosystem als US-Hyperscaler', 'teils längere Bereitstellungszeiten']
  },
  B3: {
    id: 'B3',
    name: 'EU-Vendor-API',
    full: 'Direkter API-Zugriff beim EU-ansässigen Hersteller',
    short: 'Mistral La Plateforme, Aleph Alpha API und andere EU-Anbieter — pay-per-token mit EU-Datenhoheit.',
    sovereignty: 4,
    dsgvo: 'vollständig erfüllt',
    cloud_act: 'nicht anwendbar (wenn Anbieter vollständig EU-basiert ist)',
    setup: 'Account beim Vendor, API-Key holen, integrieren. Kein eigenes Hosting, keine MLOps.',
    typical_for: 'Pragmatiker mit EU-Präferenz. Einkaufsentscheidung „europäischer Anbieter only". Schneller Start.',
    invest: 'Pay-per-token, meist vergleichbar mit US-Vendors. Keine Fixkosten.',
    pros: ['niedrigster Einstieg in Souveränität', 'EU-Datenhoheit ohne eigenes Hosting', 'kein US-Mutterkonzern'],
    cons: ['weniger Modell-Auswahl als US-Vendors', 'manche Anbieter noch in Produktreife-Phase', 'weniger Ökosystem-Tooling']
  },
  B4: {
    id: 'B4',
    name: 'US-Hyperscaler EU-Region',
    full: 'Azure OpenAI, AWS Bedrock, Google Vertex AI mit EU-Region',
    short: 'Breiteste Modell-Auswahl, aber US-Mutterkonzern — Schrems-II-Abwägung nötig.',
    sovereignty: 2,
    dsgvo: 'mit Einschränkungen erfüllt — Schrems-II-Prüfung, Transfer-Impact-Assessment und Standardvertragsklauseln nötig',
    cloud_act: 'anwendbar — US-Mutterkonzern kann theoretisch auf EU-Region-Daten zugreifen',
    setup: 'Cloud-Account anlegen, AVV abschließen, EU-Region konfigurieren, API-Integration. Zusätzliche technische Maßnahmen (Verschlüsselung mit Customer-Managed-Keys) empfohlen.',
    typical_for: 'Firmen mit Frontier-Qualitäts-Anspruch (GPT, Claude, Gemini) die das Cloud-Act-Risiko abgewogen und akzeptiert haben. Bestehende Hyperscaler-Verträge nutzbar.',
    invest: 'Pay-per-token, meist höchste Token-Preise. Enterprise-Agreements verfügbar.',
    pros: ['beste Modell-Auswahl (GPT-5, Claude, Gemini, Llama, Mistral nebeneinander)', 'Enterprise-grade SLAs', 'Integration in bestehende Cloud-Landschaft'],
    cons: ['US CLOUD Act anwendbar trotz EU-Region', 'Schrems-II-Compliance-Aufwand', 'für personenbezogene Daten kritisch zu bewerten']
  },
  B5: {
    id: 'B5',
    name: 'Vendor-Direct (außereuropäisch)',
    full: 'Direktzugriff auf Vendor-APIs ohne EU-Lokalisierung',
    short: 'OpenAI, Anthropic, xAI direkt, auch asiatische Vendor-APIs — niedrigste Hürde, höchste Compliance-Last.',
    sovereignty: 1,
    dsgvo: 'problematisch bei personenbezogenen Daten (Enterprise-Pläne bieten teils EU-Datenverarbeitung)',
    cloud_act: 'voll anwendbar',
    setup: 'Account beim Vendor, API-Key, fertig. Keine weitere Infrastruktur.',
    typical_for: 'Prototyping, Proof-of-Concept, nicht-sensible Use Cases (interne Research-Tools, Demo-Builds).',
    invest: 'Niedrigster Einstieg, pay-per-token. Credits oft sofort nutzbar.',
    pros: ['schnellster Start', 'neueste Features zuerst verfügbar', 'volle Vendor-Dokumentation'],
    cons: ['keine EU-spezifische Datenverarbeitung garantiert', 'Schrems-II-Problematik', 'für personenbezogene Daten nicht empfohlen', 'bei asiatischen Vendors weitere Regulierungsrisiken']
  }
};

function bucketsForModel(m) {
  const open = m.openness;
  const region = m.region;
  const result = [];
  const isOpenWeights = ['open-source', 'open-weights', 'public-domain'].includes(open);
  const isResearchWeights = open === 'weights-research';
  const isApiOrClosed = ['api-only', 'closed'].includes(open);
  const isEU = ['DACH', 'EU'].includes(region);
  const isUS = region === 'US';

  if (isOpenWeights) result.push({ id: 'B1' });
  else if (isResearchWeights) result.push({ id: 'B1', caveat: 'Research-Lizenz prüfen — oft non-commercial' });

  if (isOpenWeights || isResearchWeights) result.push({ id: 'B2' });

  if (isApiOrClosed && isEU) result.push({ id: 'B3' });

  if (isApiOrClosed && isUS) result.push({ id: 'B4' });
  else if (isOpenWeights) result.push({ id: 'B4', caveat: 'Verfügbarkeit via Bedrock Marketplace / Azure AI Foundry prüfen' });

  if (isApiOrClosed && !isEU) result.push({ id: 'B5' });

  return result;
}

function renderBucketsSection(m) {
  const applicable = bucketsForModel(m);
  const caveatMap = Object.fromEntries(applicable.map(b => [b.id, b.caveat]));
  const applicableIds = new Set(applicable.map(b => b.id));
  const cards = Object.values(BUCKETS).map(b => {
    const active = applicableIds.has(b.id);
    const caveat = caveatMap[b.id];
    const sovDots = Array.from({ length: 5 }, (_, i) => `<i class="${i < b.sovereignty ? 'on' : ''}"></i>`).join('');
    const icon = BUCKET_ICONS[b.id] || '';
    return `<div class="bucket-card ${active ? 'active' : 'inactive'} sov-${b.sovereignty}" onclick="showBucketDetail('${b.id}')" tabindex="0" role="button" aria-label="Bucket ${b.id} Details">
      <div class="bucket-head"><span class="bucket-icon">${icon}</span><span class="bucket-id">${b.id}</span><span class="bucket-sov" title="Souveränität ${b.sovereignty}/5">${sovDots}</span></div>
      <div class="bucket-name">${escapeHtml(b.name)}</div>
      <div class="bucket-short">${escapeHtml(b.short)}</div>
      <div class="bucket-status ${active ? 'yes' : 'no'}">${active ? '✓ einsetzbar' : '— nicht einsetzbar'}</div>
      ${caveat ? `<div class="bucket-caveat">⚠ ${escapeHtml(caveat)}</div>` : ''}
    </div>`;
  }).join('');
  return `<h3>Einsatz-Optionen${infoIcon('deployment_buckets')}</h3><div class="buckets-grid">${cards}</div>`;
}

function showBucketDetail(id) {
  const b = BUCKETS[id];
  if (!b) return;
  const titleEl = document.getElementById('bd-title');
  titleEl.innerHTML = `<span class="bd-icon sov-${b.sovereignty}">${BUCKET_ICONS[id] || ''}</span>${b.id} · ${escapeHtml(b.name)}`;
  document.getElementById('bd-sub').textContent = b.full;
  const sovDots = Array.from({ length: 5 }, (_, i) => `<i class="${i < b.sovereignty ? 'on' : ''}"></i>`).join('');
  document.getElementById('bd-body').innerHTML = `
    <div class="bd-meta">
      <div><div class="lbl">Souveränität</div><div class="val"><span class="sov-dots">${sovDots}</span> ${b.sovereignty}/5</div></div>
      <div><div class="lbl">DSGVO</div><div class="val">${escapeHtml(b.dsgvo)}</div></div>
      <div><div class="lbl">US CLOUD Act</div><div class="val">${escapeHtml(b.cloud_act)}</div></div>
    </div>
    <h4>Typisches Setup</h4><p>${escapeHtml(b.setup)}</p>
    <h4>Typisch für</h4><p>${escapeHtml(b.typical_for)}</p>
    <h4>Investition</h4><p>${escapeHtml(b.invest)}</p>
    <h4>Vorteile</h4><ul>${b.pros.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>
    <h4>Herausforderungen</h4><ul>${b.cons.map(c => `<li>${escapeHtml(c)}</li>`).join('')}</ul>
  `;
  showModal('bucket-detail-modal');
}

// ─── Tier-Kürzel für Quartett-Kreisbadge ───────────────────────────────────
const TIER_CODE = {
  'frontier-closed': 'FC',
  'frontier-open': 'FO',
  regional: 'RG',
  specialist: 'SP',
  research: 'RS'
};

// ─── Sprache → Land (für Flaggen via flagcdn.com) ──────────────────────────
const LANG_TO_COUNTRY = {
  de: 'de', en: 'gb', fr: 'fr', es: 'es', it: 'it', nl: 'nl', pt: 'pt',
  sv: 'se', fi: 'fi', no: 'no', da: 'dk', pl: 'pl', cs: 'cz', ro: 'ro',
  el: 'gr', hu: 'hu', sk: 'sk', sl: 'si', bg: 'bg', hr: 'hr',
  zh: 'cn', ja: 'jp', ko: 'kr', hi: 'in', bn: 'bd', ur: 'pk', ta: 'in',
  ar: 'sa', he: 'il', fa: 'ir', tr: 'tr',
  ru: 'ru', uk: 'ua',
  sw: 'ke', af: 'za', yo: 'ng',
  id: 'id', th: 'th', vi: 'vn', my: 'mm'
};

function flagUrl(lang) {
  const country = LANG_TO_COUNTRY[lang] || lang;
  return `https://flagcdn.com/${country}.svg`;
}

// ─── Modalitäts-Icons (Lucide-Style, inline SVG) ───────────────────────────
const MOD_ICONS = {
  text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>',
  audio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  speech: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  embedding: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>',
  '3d': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>'
};

// Mapping von modality-strings zu icon-keys
const MOD_NORMALIZE = {
  text: 'text', 'text-to-text': 'text', sprach: 'text',
  image: 'image', 'text-to-image': 'image', 'image-to-image': 'image', bild: 'image', vision: 'image',
  audio: 'audio', 'text-to-audio': 'audio', music: 'audio', musik: 'audio',
  speech: 'speech', 'speech-to-text': 'speech', 'text-to-speech': 'speech', 'sprache': 'speech', asr: 'speech', tts: 'speech', voice: 'speech',
  video: 'video', 'text-to-video': 'video', 'image-to-video': 'video',
  code: 'code', coding: 'code',
  embedding: 'embedding', embeddings: 'embedding', retrieval: 'embedding', rag: 'embedding',
  '3d': '3d', 'text-to-3d': '3d', model: '3d',
  search: 'search'
};

function modalityIcon(mod) {
  const key = MOD_NORMALIZE[String(mod).toLowerCase()] || null;
  return key ? MOD_ICONS[key] : null;
}

// Score-Helper für Bar-Visualisierung
function priceLevel(p) { return p ? p.length : 0; }
function germanLevel(g) { return { low: 1, medium: 2, high: 3 }[g] || 0; }
function contextScore(c) {
  if (!c) return null;
  const m = String(c).match(/(\d+)\s*([KMkm])?/);
  if (!m) return null;
  let n = parseInt(m[1]);
  const unit = (m[2] || '').toUpperCase();
  if (unit === 'K') n *= 1000;
  if (unit === 'M') n *= 1000000;
  return Math.min(1, Math.log10(n + 1) / 7);
}
function yearScore(y) {
  if (!y) return null;
  const n = parseInt(y);
  if (!n) return null;
  return Math.max(0, Math.min(1, (n - 2020) / 6));
}
function opennessScore(o) {
  const map = { 'public-domain': 1, 'open-source': 0.9, 'open-weights': 0.7, 'weights-research': 0.5, 'api-only': 0.25, closed: 0.1 };
  return map[o] ?? 0.5;
}
function cloudActScore(c) {
  const map = { none: 1, low: 0.75, medium: 0.4, high: 0.1 };
  return map[c] ?? 0.5;
}
function transparencyScore(t) {
  const map = { high: 1, medium: 0.66, low: 0.33, none: 0 };
  return map[t] ?? null;
}

// ─── API ───────────────────────────────────────────────────────────────────
async function apiGet(path) {
  const r = await fetch(path, { headers: { 'Cache-Control': 'no-store' } });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}
async function apiPost(path, body) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || `${path} → ${r.status}`), { status: r.status });
  return j;
}

async function loadAtlas(atlas) {
  if (STATE.data[atlas]) return STATE.data[atlas];
  const [modelsRes, metaRes] = await Promise.all([
    apiGet(`/api/models?atlas=${atlas}`),
    apiGet(`/api/meta?atlas=${atlas}`)
  ]);
  STATE.data[atlas] = {
    models: modelsRes.models,
    meta: metaRes.meta,
    licenses: metaRes.licenses
  };
  return STATE.data[atlas];
}

async function reloadCurrentAtlas() {
  STATE.data[STATE.atlas] = null;
  await loadAtlas(STATE.atlas);
}

// ─── Filtering ─────────────────────────────────────────────────────────────
function matches(m) {
  const f = STATE.filters;
  if (f.search) {
    const q = f.search.toLowerCase();
    const hay = (m.name + ' ' + m.vendor + ' ' + (m.insider || '') + ' ' + (m.specs || []).join(' ') + ' ' + (m.use_cases || []).join(' ')).toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.region.size && !f.region.has(m.region)) return false;
  if (f.tier.size && !f.tier.has(m.tier)) return false;
  if (f.openness.size && !f.openness.has(m.openness)) return false;
  if (f.usecase.size) {
    const ucs = m.use_cases || [];
    let any = false;
    for (const u of f.usecase) if (ucs.includes(u)) { any = true; break; }
    if (!any) return false;
  }
  if (f.sov && (m.sovereignty || 0) < f.sov) return false;
  if (f.price < 6 && priceLevel(m.pricing) > f.price) return false;
  if (STATE.atlas === 'conversational' && f.german && germanLevel(m.german_capability) < f.german) return false;
  if (f.onprem && f.onprem !== 'all' && m.on_prem !== f.onprem) return false;
  if (f.buckets && f.buckets.size > 0) {
    const modelBuckets = bucketsForModel(m).map(b => b.id);
    let any = false;
    for (const bid of f.buckets) if (modelBuckets.includes(bid)) { any = true; break; }
    if (!any) return false;
  }
  return true;
}

// ─── Swipe-Finder — 8 Ja/Nein-Fragen, die am Ende Filter setzen ────────────
const SWIPE_QUESTIONS = [
  {
    id: 'german',
    title: 'Hohe Deutsch-Kompetenz nötig?',
    text: 'Muss das Modell Deutsch auf nahezu muttersprachlichem Niveau beherrschen? (Ja schließt Modelle mit nur grundlegender oder mittlerer Deutsch-Kompetenz aus.)',
    icon: '🇩🇪',
    apply: s => { s.filters.german = 3; },
    summary: 'Deutsch-Kompetenz: mindestens „high"'
  },
  {
    id: 'onprem',
    title: 'On-Prem-Betrieb nötig?',
    text: 'Muss sich das Modell on-premise auf eigener Hardware betreiben lassen? (Ja schließt Cloud-only- und API-only-Modelle aus.)',
    icon: '🏛',
    apply: s => { s.filters.onprem = 'yes'; },
    summary: 'On-Prem-Betrieb: ja'
  },
  {
    id: 'eu',
    title: 'Hersteller-Sitz in EU oder DACH?',
    text: 'Muss der Hersteller seinen Sitz in Europa oder DACH haben? (Ja schließt US-, chinesische und andere nicht-europäische Modelle aus.)',
    icon: '🇪🇺',
    apply: s => { s.filters.region.add('DACH'); s.filters.region.add('EU'); },
    summary: 'Region: nur DACH oder EU'
  },
  {
    id: 'budget',
    title: 'Moderate Kosten wichtig?',
    text: 'Ist ein moderates Preisniveau wichtig? (Ja schließt Premium-Modelle oberhalb €€€ pro Million Tokens aus.)',
    icon: '€',
    apply: s => { s.filters.price = 3; },
    summary: 'Preis: maximal €€€ (mittlerer Bereich)'
  },
  {
    id: 'longcontext',
    title: 'Langer Kontext nötig?',
    text: 'Brauchst du ein Kontextfenster über 100K Tokens — für lange Dokumente, Codebasen, ganze Bücher? (Ja schließt Modelle mit kleinem Kontext aus.)',
    icon: '📚',
    apply: s => { s.filters.usecase.add('long-context'); },
    summary: 'Use Case: long-context'
  },
  {
    id: 'sovereignty',
    title: 'Hohe Souveränität gefordert?',
    text: 'Muss der Souveränitäts-Score mindestens 4 von 5 betragen? (Ja setzt EU-Hosting, Transparenz und offene Lizenz als Mindestanforderung.)',
    icon: '🛡',
    apply: s => { s.filters.sov = 4; },
    summary: 'Souveränität: mindestens 4/5'
  },
  {
    id: 'production',
    title: 'Nur produktionsreife Modelle?',
    text: 'Muss das Modell produktionsreif sein? (Ja schließt reine Forschungsmodelle ohne Stable-Release aus.)',
    icon: '⚡',
    apply: s => { ['frontier-closed', 'frontier-open', 'regional', 'specialist'].forEach(t => s.filters.tier.add(t)); },
    summary: 'Tier: keine Forschungsmodelle'
  },
  {
    id: 'open',
    title: 'Offene Gewichte nötig?',
    text: 'Muss das Modell Open-Source oder Open-Weights verfügbar sein? (Ja schließt rein kommerzielle API-only- und Closed-Modelle aus.)',
    icon: '🔓',
    apply: s => { s.filters.openness.add('open-source'); s.filters.openness.add('open-weights'); s.filters.openness.add('public-domain'); },
    summary: 'Offenheit: Open-Weights oder Open-Source'
  }
];

function ensureSwipeState() {
  if (!STATE.swipe) STATE.swipe = { index: 0, answers: {}, finished: false };
}

function renderFinder() {
  ensureSwipeState();
  const area = document.getElementById('finder-area');
  if (!area) return;

  if (STATE.swipe.finished) {
    renderFinderResult(area);
    return;
  }

  const total = SWIPE_QUESTIONS.length;
  const idx = STATE.swipe.index;
  if (idx >= total) {
    STATE.swipe.finished = true;
    renderFinderResult(area);
    return;
  }

  const q = SWIPE_QUESTIONS[idx];
  const progress = Math.round(((idx) / total) * 100);

  area.innerHTML = `
    <div class="finder-intro">
      <h2>Model-Finder</h2>
      <p>${total} kurze Fragen, dann zeigen wir dir die Modelle, die zu deinen Anforderungen passen. Swipe, klicke oder nutze die Tasten.</p>
    </div>
    <div class="swipe-progress"><div class="swipe-progress-bar" style="width:${progress}%"></div><span class="swipe-progress-label">Frage ${idx + 1} / ${total}</span></div>
    <div class="swipe-stack">
      <div class="swipe-card current" data-qid="${q.id}">
        <div class="swipe-icon">${q.icon}</div>
        <h3 class="swipe-title">${escapeHtml(q.title)}</h3>
        <p class="swipe-text">${escapeHtml(q.text)}</p>
        <div class="swipe-hints">
          <div class="swipe-hint-no">✕ Nein</div>
          <div class="swipe-hint-yes">Ja ✓</div>
        </div>
      </div>
    </div>
    <div class="swipe-actions">
      <button class="swipe-btn swipe-no" onclick="answerSwipe('no')" title="Nein (←)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
      </button>
      <button class="swipe-btn swipe-skip" onclick="answerSwipe('skip')" title="Überspringen (↑)">Egal</button>
      <button class="swipe-btn swipe-yes" onclick="answerSwipe('yes')" title="Ja (→)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
    </div>
    <div class="swipe-hint-keys">← Nein · ↑ Egal · → Ja · oder zieh die Karte</div>
  `;
  setupSwipeGestures();
}

function setupSwipeGestures() {
  const card = document.querySelector('.swipe-card.current');
  if (!card) return;
  let startX = 0, currentX = 0, dragging = false, startY = 0;
  const onStart = (e) => {
    dragging = true;
    const p = e.touches ? e.touches[0] : e;
    startX = p.clientX;
    startY = p.clientY;
    card.style.transition = 'none';
  };
  const onMove = (e) => {
    if (!dragging) return;
    const p = e.touches ? e.touches[0] : e;
    currentX = p.clientX - startX;
    const rotation = currentX * 0.05;
    card.style.transform = `translateX(${currentX}px) rotate(${rotation}deg)`;
    card.style.opacity = String(Math.max(0.4, 1 - Math.abs(currentX) / 600));
    const y = card.querySelector('.swipe-hint-yes');
    const n = card.querySelector('.swipe-hint-no');
    if (currentX > 40) { y?.classList.add('active'); n?.classList.remove('active'); }
    else if (currentX < -40) { n?.classList.add('active'); y?.classList.remove('active'); }
    else { y?.classList.remove('active'); n?.classList.remove('active'); }
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    const threshold = 80;
    if (currentX > threshold) answerSwipe('yes');
    else if (currentX < -threshold) answerSwipe('no');
    else { card.style.transition = 'transform .25s, opacity .25s'; card.style.transform = ''; card.style.opacity = ''; }
    currentX = 0;
  };
  card.addEventListener('mousedown', onStart);
  card.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, { passive: true });
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchend', onEnd);
}

function answerSwipe(dir) {
  ensureSwipeState();
  const q = SWIPE_QUESTIONS[STATE.swipe.index];
  if (!q) return;
  STATE.swipe.answers[q.id] = dir;
  // Flug-Animation
  const card = document.querySelector('.swipe-card.current');
  if (card) {
    card.style.transition = 'transform .3s, opacity .3s';
    if (dir === 'yes') { card.style.transform = 'translateX(500px) rotate(20deg)'; card.style.opacity = '0'; }
    else if (dir === 'no') { card.style.transform = 'translateX(-500px) rotate(-20deg)'; card.style.opacity = '0'; }
    else { card.style.transform = 'translateY(-300px)'; card.style.opacity = '0'; }
  }
  setTimeout(() => {
    STATE.swipe.index++;
    renderFinder();
  }, 280);
}

function computeFinderFilters() {
  // Temporärer Filter-State zum Zählen der Treffer
  const tempState = {
    filters: { search: '', region: new Set(), tier: new Set(), openness: new Set(), usecase: new Set(), buckets: new Set(), sov: 0, price: 6, german: 0, onprem: 'all' }
  };
  const appliedSummaries = [];
  for (const q of SWIPE_QUESTIONS) {
    if (STATE.swipe.answers[q.id] === 'yes') {
      q.apply(tempState);
      appliedSummaries.push(q.summary);
    }
  }
  return { tempState, appliedSummaries };
}

function renderFinderResult(area) {
  const { tempState, appliedSummaries } = computeFinderFilters();
  const d = STATE.data[STATE.atlas];
  if (!d) { area.innerHTML = '<div class="empty">Noch keine Daten geladen.</div>'; return; }
  // Hypothetische Treffer zählen
  const prevFilters = STATE.filters;
  STATE.filters = tempState.filters;
  const count = d.models.filter(matches).length;
  STATE.filters = prevFilters;

  const filtersHtml = appliedSummaries.length
    ? '<ul class="finder-result-filters">' + appliedSummaries.map(s => `<li>${escapeHtml(s)}</li>`).join('') + '</ul>'
    : '<p class="finder-result-empty">Du hast zu allen Fragen „Nein" oder „Egal" gesagt — keine Filter gesetzt.</p>';

  area.innerHTML = `
    <div class="finder-result">
      <div class="finder-result-icon">✓</div>
      <h2>${count} Modelle passen zu deinen Anforderungen</h2>
      <p class="finder-result-lead">Basierend auf deinen ${Object.keys(STATE.swipe.answers).length} Antworten haben wir folgende Filter für dich vorbereitet:</p>
      ${filtersHtml}
      <p class="finder-result-hint">Du siehst die gesetzten Filter auch in der linken Sidebar — beim nächsten Mal kannst du sie direkt dort drehen, ohne den Finder neu zu durchlaufen.</p>
      <div class="finder-result-actions">
        <button class="btn btn-primary" onclick="applySwipeAndShowList()">Die ${count} Modelle jetzt anzeigen</button>
        <button class="btn" onclick="restartFinder()">Nochmal swipen</button>
      </div>
    </div>
  `;
}

function applySwipeAndShowList() {
  const { tempState } = computeFinderFilters();
  STATE.filters = tempState.filters;
  // UI der Filter-Sidebar synchronisieren
  document.getElementById('search').value = '';
  document.getElementById('filter-sov').value = String(STATE.filters.sov || 0);
  document.getElementById('filter-price').value = String(STATE.filters.price || 6);
  const gSel = document.getElementById('filter-german');
  if (gSel) gSel.value = String(STATE.filters.german || 0);
  buildFilters();
  switchView('list');
  showToast(`Filter übernommen · ${document.querySelectorAll('.pill[aria-pressed="true"]').length} Pills aktiv`);
}

function restartFinder() {
  STATE.swipe = { index: 0, answers: {}, finished: false };
  renderFinder();
}

function filteredModels() {
  const d = STATE.data[STATE.atlas];
  if (!d) return [];
  return d.models.filter(matches);
}

// ─── Image Rendering ───────────────────────────────────────────────────────
function dicebearUrl(name) {
  // BG-Farbe passt zum dunklen Logo-Container
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(name)}&backgroundColor=32373C&shapeColor=0045C3,FF5833,FFFFFF`;
}
function logoImg(model, cls = 'logo-small') {
  const fb = dicebearUrl(model.name || model.id);
  const src = model.image_url || fb;
  const safe = escapeAttr(src);
  const fbSafe = escapeAttr(fb);
  return `<img class="${cls}" src="${safe}" alt="" onerror="this.onerror=null;this.src='${fbSafe}'">`;
}

// ─── Render: Filters ───────────────────────────────────────────────────────
function buildFilters() {
  const d = STATE.data[STATE.atlas];
  if (!d || !d.meta) return;
  const meta = d.meta;
  const filters = meta.filters || {};
  buildPillGroup('filter-region', filters.regions || [], REGION_LABEL, 'region');
  buildPillGroup('filter-tier', filters.tiers || [], TIER_LABEL, 'tier');
  buildPillGroup('filter-openness', filters.openness || [], OPEN_LABEL, 'openness');
  buildPillGroup('filter-usecase', filters.use_cases || [], null, 'usecase');
  buildBucketFilter();
  const germanField = document.getElementById('german-field');
  if (germanField) germanField.style.display = STATE.atlas === 'conversational' ? '' : 'none';
}

function buildBucketFilter() {
  const el = document.getElementById('filter-buckets');
  if (!el) return;
  el.innerHTML = '';
  Object.values(BUCKETS).forEach(b => {
    const active = STATE.filters.buckets.has(b.id);
    const btn = document.createElement('button');
    btn.className = `bucket-pill sov-${b.sovereignty}`;
    btn.setAttribute('aria-pressed', active);
    btn.title = `${b.name} — Souveränität ${b.sovereignty}/5`;
    btn.innerHTML = `<span class="bp-icon">${BUCKET_ICONS[b.id]}</span><span class="bp-label"><span class="bp-id">${b.id}</span>${escapeHtml(b.name)}</span>`;
    btn.onclick = () => {
      if (STATE.filters.buckets.has(b.id)) STATE.filters.buckets.delete(b.id);
      else STATE.filters.buckets.add(b.id);
      btn.setAttribute('aria-pressed', STATE.filters.buckets.has(b.id));
      render();
    };
    el.appendChild(btn);
  });
}

function buildPillGroup(id, items, labels, key) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  items.forEach(v => {
    const b = document.createElement('button');
    b.className = 'pill';
    b.textContent = labels ? (labels[v] || v) : v;
    b.setAttribute('aria-pressed', STATE.filters[key].has(v));
    b.onclick = () => {
      if (STATE.filters[key].has(v)) STATE.filters[key].delete(v);
      else STATE.filters[key].add(v);
      b.setAttribute('aria-pressed', STATE.filters[key].has(v));
      render();
    };
    el.appendChild(b);
  });
}

// ─── Render: Main ──────────────────────────────────────────────────────────
function render() {
  const list = filteredModels();
  const d = STATE.data[STATE.atlas];
  const countEl = document.getElementById('result-count');
  if (countEl) {
    let html = `<span class="status-dot"></span>${list.length} von ${d?.models.length || 0} Modellen`;
    if (STATE.edit.active) html += `<span class="editmode-indicator">Edit aktiv: ${escapeHtml(STATE.edit.editor || 'anonym')}</span>`;
    countEl.innerHTML = html;
  }
  // Finder-Mode deaktiviert den normalen Content
  const finderMode = STATE.view === 'finder';
  document.body.classList.toggle('finder-active', finderMode);
  document.getElementById('quartett-toolbar').style.display = (!finderMode && STATE.view === 'quartett') ? 'flex' : 'none';
  document.getElementById('qconfig').style.display = (!finderMode && STATE.view === 'quartett' && STATE.quartett.configOpen) ? 'block' : 'none';

  if (finderMode) {
    renderFinder();
  } else if (STATE.view === 'quartett') {
    renderQuartett(list);
  } else {
    renderList(list);
  }
  // Tab-Counts
  if (STATE.data.conversational) document.getElementById('cnt-conv').textContent = STATE.data.conversational.models.length;
  if (STATE.data.specialized) document.getElementById('cnt-spec').textContent = STATE.data.specialized.models.length;
}

function renderList(list) {
  const grid = document.getElementById('grid');
  grid.className = 'grid';
  const sorted = sortedModels(list);
  if (sorted.length === 0) {
    grid.innerHTML = '<div class="empty">Keine Modelle entsprechen den aktuellen Filtern.</div>';
    return;
  }
  grid.innerHTML = sorted.map(listCard).join('');
}

function listCard(m) {
  const sov = Math.max(0, Math.min(5, m.sovereignty || 0));
  const dots = Array.from({ length: 5 }, (_, i) => `<i class="${i < sov ? 'on-' + sov : ''}"></i>`).join('');
  const useCases = (m.use_cases || []).slice(0, 4).map(u => `<span class="tag">${escapeHtml(u)}</span>`).join('');
  const region = REGION_LABEL[m.region] || m.region || '—';
  return `<div class="card" onclick="openModel('${escapeAttr(m.id)}')" tabindex="0" onkeypress="if(event.key==='Enter')openModel('${escapeAttr(m.id)}')">
    <button class="edit-btn" onclick="event.stopPropagation();openEdit('${escapeAttr(m.id)}')" title="Edit">✎</button>
    <div class="name">${logoImg(m, 'logo-small')}<span class="name-text">${escapeHtml(m.name)}</span></div>
    <div class="vendor">${escapeHtml(m.vendor || '')}</div>
    <div class="badges">
      <span class="badge region">${region}</span>
      <span class="badge tier-${m.tier}">${TIER_LABEL[m.tier] || m.tier || ''}</span>
    </div>
    <div class="row">
      <span class="sov" title="Souveränität ${sov}/5">${dots}</span>
      <span class="price" title="Preisindikation">${m.pricing || '—'}</span>
    </div>
    <div class="insider">${escapeHtml(m.insider || '')}</div>
    <div class="tags">${useCases}</div>
  </div>`;
}

// ─── Quartett rendering ────────────────────────────────────────────────────
function renderQuartett(list) {
  const grid = document.getElementById('grid');
  grid.className = 'quartett-grid';
  const sorted = sortedModels(list);
  if (sorted.length === 0) {
    grid.innerHTML = '<div class="empty">Keine Modelle entsprechen den aktuellen Filtern.</div>';
    return;
  }
  grid.innerHTML = sorted.map((m, i) => quartettCard(m, i, sorted.length)).join('');
  renderQuartettConfig();
  // QR-Codes nach dem DOM-Fill generieren
  setTimeout(generateQRs, 0);
}

function initial(s) {
  return String(s || '?').trim()[0]?.toUpperCase() || '?';
}

function truncate(s, max) {
  if (!s) return '';
  s = String(s);
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trim() + '…';
}

function getPrimaryLang(m) {
  const langs = m.supported_languages || [];
  return langs.length > 0 ? langs[0] : 'en';
}

function regionFlagCountry(region) {
  return { DACH: 'de', EU: 'eu', US: 'us', CN: 'cn', KR: 'kr', JP: 'jp', IN: 'in', MENA: 'ae', AF: 'za', RU: 'ru', INTL: 'un' }[region] || 'un';
}

function renderOnPremBadge(onPrem) {
  if (onPrem === 'yes') {
    return '<span class="onprem-badge yes" title="Kann on-premise betrieben werden — DSGVO-konform, Cloud-Act-resilient"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg> On-Prem</span>';
  }
  if (onPrem === 'hybrid') {
    return '<span class="onprem-badge hybrid" title="Teilweise on-premise möglich (z.B. Inference lokal, Training in Cloud)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Hybrid</span>';
  }
  if (onPrem === 'no') {
    return '<span class="onprem-badge no" title="Nur über Cloud-API verfügbar — Cloud-Act-Exposition prüfen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M4.93 4.93l14.14 14.14"/></svg> Cloud only</span>';
  }
  return '';
}

function renderStat(m, key) {
  const def = STAT_DEFS[key];
  if (!def) return '';
  const val = def.get(m);
  if (def.asDots) {
    const n = Math.max(0, Math.min(5, parseInt(val) || 0));
    const dots = Array.from({ length: 5 }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
    return `<div class="qstat"><span class="qstat-label">${def.label}</span><span class="qstat-value"><span class="sov-dots">${dots}</span></span></div>`;
  }
  return `<div class="qstat"><span class="qstat-label">${def.label}</span><span class="qstat-value">${escapeHtml(String(val))}</span></div>`;
}

function quartettCard(m, index, total) {
  const tier = m.tier || 'specialist';
  const tierCode = TIER_CODE[tier] || '—';
  const region = m.region || 'INTL';
  const vendorInfo = m.vendor_info;
  const brandColor = vendorInfo?.brand_color;
  // Modell-Override (image_url) hat Vorrang vor Vendor-Default-Logo
  const logoUrl = m.image_url || vendorInfo?.logo_url;
  const flagCountry = regionFlagCountry(region);

  const stats = STATE.quartett.stats.slice(0, 4).map(k => renderStat(m, k)).join('');

  const langs = (m.supported_languages || []).slice(0, 5);
  const langHtml = langs.length
    ? langs.map(l => `<div class="mini-flag" title="${escapeAttr(l.toUpperCase())}"><img src="${flagUrl(l)}" alt="${escapeAttr(l)}" onerror="this.parentNode.remove()"></div>`).join('')
    : '';

  const mods = (m.modalities && m.modalities.length ? m.modalities : ['text']).slice(0, 6);
  const modHtml = mods.map(mod => {
    const icon = modalityIcon(mod);
    return icon ? `<span class="modal-icon" title="${escapeAttr(mod)}">${icon}</span>` : '';
  }).filter(Boolean).join('');

  const qrUrl = m.url || 'https://bosses-foundation-models.vercel.app';
  const qrId = `qr-${STATE.atlas}-${m.id}`;

  const cardNum = String(index + 1).padStart(3, '0');
  const cardTotal = String(total).padStart(3, '0');

  const style = brandColor ? `style="--qbrand:${brandColor}"` : '';
  const logoHtml = logoUrl
    ? `<img src="${escapeAttr(logoUrl)}" alt="" crossorigin="anonymous" onerror="this.onerror=null;this.outerHTML='<span class=qlogo-initial>${escapeAttr(initial(m.vendor))}</span>'">`
    : `<span class="qlogo-initial">${escapeAttr(initial(m.vendor))}</span>`;

  return `<div class="qcard region-${region}" ${style} onclick="openModel('${escapeAttr(m.id)}')" tabindex="0">
    <button class="qedit-btn" onclick="event.stopPropagation();openEdit('${escapeAttr(m.id)}')" title="Bearbeiten">✎</button>
    <button class="qpdf-btn" onclick="event.stopPropagation();downloadCardPdf('${escapeAttr(m.id)}')" title="Als PDF herunterladen">⬇</button>
    <div class="qhead">
      <div class="qtier" title="${escapeAttr(TIER_LABEL[tier] || tier)}">${tierCode}</div>
      <div class="qflag" title="${region}"><img src="https://flagcdn.com/${regionFlagCountry(region)}.svg" alt="${region}" onerror="this.parentNode.style.display='none'"></div>
    </div>
    <div class="qtitle">
      <div class="qname">${escapeHtml(m.name)}</div>
      <div class="qvendor">${escapeHtml(m.vendor || '')}</div>
      ${renderOnPremBadge(m.on_prem)}
    </div>
    <div class="qlogo-wrap">${logoHtml}</div>
    <div class="qinsider">${escapeHtml(truncate(m.insider || '', 130))}</div>
    <div class="qstats">${stats}</div>
    <div class="qfoot">
      <div class="qfoot-meta">
        <div class="qfoot-row">${langHtml}</div>
        <div class="qfoot-row">${modHtml}</div>
      </div>
      <div class="qqr" id="${qrId}" data-url="${escapeAttr(qrUrl)}"></div>
    </div>
    <div class="qindex">${cardNum} / ${cardTotal}</div>
  </div>`;
}

// ─── Sortierung — neutrale und bewertende Kriterien, bidirektional ─────────
function sortedModels(models) {
  const sort = STATE.sort || 'alpha';
  const copy = [...models];
  const tierOrder = { 'frontier-closed': 1, 'frontier-open': 2, regional: 3, specialist: 4, research: 5 };
  const cloudOrder = { none: 1, low: 2, medium: 3, high: 4 };
  const transOrder = { high: 1, medium: 2, low: 3, none: 4 };
  const opennessOrder = { 'public-domain': 1, 'open-source': 2, 'open-weights': 3, 'weights-research': 4, 'api-only': 5, closed: 6 };
  const germanOrder = { high: 1, medium: 2, low: 3 };
  const onPremOrder = { yes: 1, hybrid: 2, unknown: 3, no: 4 };
  const parseParams = p => {
    if (!p) return 0;
    const m = String(p).match(/([\d.]+)\s*([BTM])?/i);
    if (!m) return 0;
    let n = parseFloat(m[1]);
    const u = (m[2] || 'B').toUpperCase();
    if (u === 'T') n *= 1000;
    if (u === 'M') n *= 0.001;
    return n;
  };
  const byName = (a, b) => (a.name || '').localeCompare(b.name || '', 'de');

  switch (sort) {
    // ── Neutral
    case 'alpha':       return copy.sort((a, b) => (a.vendor + ' ' + a.name).localeCompare(b.vendor + ' ' + b.name, 'de'));
    case 'name':        return copy.sort(byName);
    case 'name-desc':   return copy.sort((a, b) => -byName(a, b));
    case 'vendor':      return copy.sort((a, b) => (a.vendor || '').localeCompare(b.vendor || '', 'de') || byName(a, b));
    case 'region':      return copy.sort((a, b) => (a.region || '').localeCompare(b.region || '') || byName(a, b));
    case 'tier':        return copy.sort((a, b) => (tierOrder[a.tier] || 99) - (tierOrder[b.tier] || 99) || byName(a, b));
    case 'year-desc':   return copy.sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0) || byName(a, b));
    case 'year-asc':    return copy.sort((a, b) => (parseInt(a.year) || 9999) - (parseInt(b.year) || 9999) || byName(a, b));

    // ── Souveränität
    case 'sovereignty-desc': return copy.sort((a, b) => (b.sovereignty || 0) - (a.sovereignty || 0) || byName(a, b));
    case 'sovereignty-asc':  return copy.sort((a, b) => (a.sovereignty || 0) - (b.sovereignty || 0) || byName(a, b));
    case 'eu_host-desc':     return copy.sort((a, b) => (b.eu_host ? 1 : 0) - (a.eu_host ? 1 : 0) || byName(a, b));
    case 'eu_host-asc':      return copy.sort((a, b) => (a.eu_host ? 1 : 0) - (b.eu_host ? 1 : 0) || byName(a, b));
    case 'cloud_act-asc':    return copy.sort((a, b) => (cloudOrder[a.cloud_act] || 99) - (cloudOrder[b.cloud_act] || 99) || byName(a, b));
    case 'cloud_act-desc':   return copy.sort((a, b) => (cloudOrder[b.cloud_act] || 0) - (cloudOrder[a.cloud_act] || 0) || byName(a, b));
    case 'transparency-desc': return copy.sort((a, b) => (transOrder[a.transparency] || 99) - (transOrder[b.transparency] || 99) || byName(a, b));
    case 'transparency-asc':  return copy.sort((a, b) => (transOrder[b.transparency] || 0) - (transOrder[a.transparency] || 0) || byName(a, b));
    case 'on_prem-desc':     return copy.sort((a, b) => (onPremOrder[a.on_prem] || 99) - (onPremOrder[b.on_prem] || 99) || byName(a, b));
    case 'on_prem-asc':      return copy.sort((a, b) => (onPremOrder[b.on_prem] || 0) - (onPremOrder[a.on_prem] || 0) || byName(a, b));

    // ── Technische Metriken
    case 'context-desc':  return copy.sort((a, b) => (contextScore(b.context) || 0) - (contextScore(a.context) || 0) || byName(a, b));
    case 'context-asc':   return copy.sort((a, b) => (contextScore(a.context) || 0) - (contextScore(b.context) || 0) || byName(a, b));
    case 'params-desc':   return copy.sort((a, b) => parseParams(b.params) - parseParams(a.params) || byName(a, b));
    case 'params-asc':    return copy.sort((a, b) => parseParams(a.params) - parseParams(b.params) || byName(a, b));

    // ── Kommerz & Sprache
    case 'price-asc':     return copy.sort((a, b) => priceLevel(a.pricing) - priceLevel(b.pricing) || byName(a, b));
    case 'price-desc':    return copy.sort((a, b) => priceLevel(b.pricing) - priceLevel(a.pricing) || byName(a, b));
    case 'openness':      return copy.sort((a, b) => (opennessOrder[a.openness] || 99) - (opennessOrder[b.openness] || 99) || byName(a, b));
    case 'openness-desc': return copy.sort((a, b) => (opennessOrder[b.openness] || 0) - (opennessOrder[a.openness] || 0) || byName(a, b));
    case 'german-desc':   return copy.sort((a, b) => (germanOrder[a.german_capability] || 99) - (germanOrder[b.german_capability] || 99) || byName(a, b));
    case 'german-asc':    return copy.sort((a, b) => (germanOrder[b.german_capability] || 0) - (germanOrder[a.german_capability] || 0) || byName(a, b));

    default: return copy;
  }
}

// ─── QR-Code-Generation (qrcode-generator via CDN) ─────────────────────────
function generateQRs() {
  if (typeof qrcode === 'undefined') {
    setTimeout(generateQRs, 200);
    return;
  }
  document.querySelectorAll('.qqr[data-url]').forEach(el => {
    const url = el.dataset.url;
    if (!url || el.dataset.rendered) return;
    try {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      el.innerHTML = qr.createSvgTag({ margin: 0, scalable: true, cellColor: () => '#32373C' });
      el.dataset.rendered = '1';
    } catch (e) {
      console.warn('QR-Gen fehlgeschlagen für', url, e);
    }
  });
}

function renderQuartettConfig() {
  const el = document.getElementById('qconfig');
  if (!el) return;
  el.innerHTML = '';
  const heading = document.createElement('h3');
  heading.textContent = 'Quartett-Karten: Wähle bis zu 4 Statistik-Felder';
  el.appendChild(heading);
  const grid = document.createElement('div');
  grid.className = 'stats-grid';
  Object.entries(STAT_DEFS).forEach(([key, def]) => {
    const selected = STATE.quartett.stats.includes(key);
    const label = document.createElement('label');
    label.className = selected ? 'selected' : '';
    label.innerHTML = `<input type="checkbox" ${selected ? 'checked' : ''}> ${def.label}`;
    label.querySelector('input').onchange = (ev) => {
      if (ev.target.checked) {
        if (STATE.quartett.stats.length < 4) STATE.quartett.stats.push(key);
        else { ev.target.checked = false; alert('Maximal 4 Statistiken pro Karte (sonst wird es zu eng).'); return; }
      } else {
        STATE.quartett.stats = STATE.quartett.stats.filter(s => s !== key);
      }
      render();
    };
    grid.appendChild(label);
  });
  el.appendChild(grid);
  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = `Aktuell ausgewählt: ${STATE.quartett.stats.length} / 4. PDF-Download pro Karte (Hover auf Karte).`;
  el.appendChild(hint);
}

// ─── PDF-Download pro Karte (pdf-lib via CDN) ──────────────────────────────
async function downloadCardPdf(modelId) {
  if (typeof PDFLib === 'undefined') {
    alert('PDF-Library wird noch geladen. Bitte einen Moment warten.');
    return;
  }
  const d = STATE.data[STATE.atlas];
  const m = d?.models.find(x => x.id === modelId);
  if (!m) { alert('Modell nicht gefunden.'); return; }

  try {
    const bytes = await buildCardPdf(m);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safe = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    a.download = `bvdw-atlas-${safe(m.vendor)}-${safe(m.name)}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  } catch (err) {
    console.error('PDF-Fehler:', err);
    alert('PDF-Export fehlgeschlagen: ' + (err.message || 'unbekannt'));
  }
}

async function buildCardPdf(m) {
  const { PDFDocument, rgb, StandardFonts } = PDFLib;
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold);
  const helvO = await doc.embedFont(StandardFonts.HelveticaOblique);

  // BVDW-Farben als rgb-Objekte
  const COBALT = rgb(0, 0x45 / 255, 0xC3 / 255);
  const OUTER = rgb(0x32 / 255, 0x37 / 255, 0x3C / 255);
  const OFF_WHITE = rgb(0xFA / 255, 0xF8 / 255, 0xF5 / 255);
  const SUB = rgb(0x5E / 255, 0x65 / 255, 0x70 / 255);

  // A6 Hochformat: 105 × 148mm = 297.6 × 419.5 pt
  const W = 298, H = 420;
  const page = doc.addPage([W, H]);

  // Off-White Hintergrund
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: OFF_WHITE });

  // Brand-Color-Leiste links
  const brand = m.vendor_info?.brand_color ? hexToRgb(m.vendor_info.brand_color) : COBALT;
  page.drawRectangle({ x: 0, y: 0, width: 6, height: H, color: brand });

  // Tier-Kreis oben links
  const tier = m.tier || 'specialist';
  const tierCode = TIER_CODE[tier] || '—';
  page.drawCircle({ x: 30, y: H - 30, size: 14, borderColor: brand, borderWidth: 1.5, color: rgb(1, 1, 1) });
  const tierTextWidth = helvB.widthOfTextAtSize(tierCode, 10);
  page.drawText(tierCode, { x: 30 - tierTextWidth / 2, y: H - 33, font: helvB, size: 10, color: brand });

  // Name zentriert
  const name = m.name || '';
  const nameSize = name.length > 26 ? 14 : 18;
  const nameLines = wrapText(name, helvB, nameSize, W - 40);
  let y = H - 72;
  nameLines.slice(0, 2).forEach(line => {
    const tw = helvB.widthOfTextAtSize(line, nameSize);
    page.drawText(line, { x: (W - tw) / 2, y, font: helvB, size: nameSize, color: OUTER });
    y -= nameSize + 2;
  });

  // Vendor
  const vendor = m.vendor || '';
  const vw = helv.widthOfTextAtSize(vendor, 9);
  page.drawText(vendor, { x: (W - vw) / 2, y: y - 6, font: helv, size: 9, color: SUB });

  // Logo-Box (Canvas-basiert, robust für PNG/JPG/SVG)
  const logoY = 200;
  const logoH = 80;
  page.drawRectangle({ x: 25, y: logoY, width: W - 50, height: logoH, color: rgb(1, 1, 1), borderColor: rgb(0.92, 0.9, 0.87), borderWidth: 0.5 });
  const logoUrl = m.image_url || m.vendor_info?.logo_url;
  let logoEmbedded = false;
  if (logoUrl) {
    const imgBytes = await fetchImageBytes(logoUrl);
    if (imgBytes) {
      try {
        const img = await doc.embedPng(imgBytes);
        const maxW = (W - 60) * 0.7;
        const maxH = logoH * 0.8;
        const scale = Math.min(maxW / img.width, maxH / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        page.drawImage(img, { x: (W - dw) / 2, y: logoY + (logoH - dh) / 2, width: dw, height: dh });
        logoEmbedded = true;
      } catch {
        // fall through
      }
    }
  }
  if (!logoEmbedded) drawLogoFallback(page, helvB, m, W, logoY, logoH, brand);

  // Insider
  const insider = truncate(m.insider || '', 140);
  const insLines = wrapText(insider, helvO, 8, W - 40);
  let iy = 185;
  insLines.slice(0, 3).forEach(line => {
    const tw = helvO.widthOfTextAtSize(line, 8);
    page.drawText(line, { x: (W - tw) / 2, y: iy, font: helvO, size: 8, color: SUB });
    iy -= 10;
  });

  // Stats
  let sy = 140;
  const rowH = 14;
  STATE.quartett.stats.slice(0, 4).forEach(key => {
    const def = STAT_DEFS[key];
    if (!def) return;
    const val = def.asDots ? `${def.get(m)}/5` : String(def.get(m));
    page.drawText(def.label.toUpperCase(), { x: 20, y: sy, font: helv, size: 7, color: SUB });
    const vw = helvB.widthOfTextAtSize(val, 9);
    page.drawText(val, { x: W - 20 - vw, y: sy - 1, font: helvB, size: 9, color: OUTER });
    page.drawLine({ start: { x: 20, y: sy - 4 }, end: { x: W - 20, y: sy - 4 }, thickness: 0.3, color: rgb(0.88, 0.86, 0.83) });
    sy -= rowH;
  });

  // Sprachen (Text, nicht Flagge — pdf-lib kein SVG)
  const langs = (m.supported_languages || []).slice(0, 6).map(l => l.toUpperCase()).join(' · ');
  if (langs) {
    page.drawText(langs, { x: 18, y: 60, font: helv, size: 7, color: SUB });
  }

  // Modalitäten als Text
  const mods = (m.modalities || ['text']).slice(0, 5).join(' · ').toUpperCase();
  if (mods) {
    page.drawText(mods, { x: 18, y: 48, font: helvB, size: 7, color: OUTER });
  }

  // QR-Code
  try {
    const qrSvg = await buildQRPng(m.url || 'https://bosses-foundation-models.vercel.app');
    if (qrSvg) {
      const qrImg = await doc.embedPng(qrSvg);
      const qrSize = 48;
      page.drawImage(qrImg, { x: W - qrSize - 18, y: 20, width: qrSize, height: qrSize });
    }
  } catch (e) {
    console.warn('QR-Embed-Fehler', e);
  }

  // Karten-Index
  const total = STATE.data[STATE.atlas]?.models.filter(x => !x._deleted).length || 0;
  const idxStr = `${String(total).padStart(3, '0')} Karten · BVDW AI Tech Lab`;
  page.drawText(idxStr, { x: 18, y: 8, font: helv, size: 6, color: SUB });

  // ─── Seite 2: Generische Rückseite ─────────────────────────────────────
  const back = doc.addPage([W, H]);
  back.drawRectangle({ x: 0, y: 0, width: W, height: H, color: COBALT });

  // BVDW-Logo auf Rückseite (weißes Logo auf Cobalt-Hintergrund)
  const logoBytes = await fetchImageBytes('/assets/bvdw-logo/bvdw-white.png');
  if (logoBytes) {
    try {
      const logoImg = await doc.embedPng(logoBytes);
      const lw = 120;
      const scale = lw / logoImg.width;
      const lh = logoImg.height * scale;
      back.drawImage(logoImg, { x: (W - lw) / 2, y: H - 160, width: lw, height: lh });
    } catch (e) {
      console.warn('BVDW-Logo embed failed:', e);
    }
  }

  const t1 = 'Foundation Models Atlas';
  const t1w = helvB.widthOfTextAtSize(t1, 16);
  back.drawText(t1, { x: (W - t1w) / 2, y: H / 2, font: helvB, size: 16, color: rgb(1, 1, 1) });

  const t2 = 'AI Tech Lab';
  const t2w = helv.widthOfTextAtSize(t2, 10);
  back.drawText(t2, { x: (W - t2w) / 2, y: H / 2 - 20, font: helv, size: 10, color: rgb(1, 1, 1, 0.85) });

  const t3 = 'Bundesverband Digitale Wirtschaft';
  const t3w = helv.widthOfTextAtSize(t3, 8);
  back.drawText(t3, { x: (W - t3w) / 2, y: H / 2 - 34, font: helv, size: 8, color: rgb(1, 1, 1, 0.7) });

  // QR zum Atlas
  try {
    const qrBytes = await buildQRPng('https://bosses-foundation-models.vercel.app');
    if (qrBytes) {
      const qrImg = await doc.embedPng(qrBytes);
      const qrSize = 80;
      back.drawImage(qrImg, { x: (W - qrSize) / 2, y: 80, width: qrSize, height: qrSize });
    }
  } catch {}

  const urlT = 'bosses-foundation-models.vercel.app';
  const uw = helv.widthOfTextAtSize(urlT, 8);
  back.drawText(urlT, { x: (W - uw) / 2, y: 60, font: helv, size: 8, color: rgb(1, 1, 1, 0.85) });

  const today = new Date();
  const stand = `Stand · ${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const sw = helv.widthOfTextAtSize(stand, 7);
  back.drawText(stand, { x: (W - sw) / 2, y: 40, font: helv, size: 7, color: rgb(1, 1, 1, 0.6) });

  return await doc.save();
}

// Hilfsfunktionen für PDF

function drawLogoFallback(page, font, m, W, y, h, color) {
  const init = initial(m.vendor);
  const size = 36;
  const tw = font.widthOfTextAtSize(init, size);
  page.drawText(init, { x: (W - tw) / 2, y: y + h / 2 - size / 3, font, size, color });
}

function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const { rgb } = PDFLib;
  return rgb(r || 0, g || 0, b || 0);
}

function wrapText(text, font, size, maxWidth) {
  const words = String(text || '').split(/\s+/);
  const lines = [];
  let current = '';
  for (const w of words) {
    const test = current ? current + ' ' + w : w;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Bild als PNG-Bytes: via Canvas, robust für PNG/JPG/SVG, benötigt CORS am Server
async function fetchImageBytes(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(null), 6000);
    img.onload = () => {
      try {
        clearTimeout(timer);
        const w = img.naturalWidth || 200;
        const h = img.naturalHeight || 200;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(blob => {
          if (!blob) { resolve(null); return; }
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsArrayBuffer(blob);
        }, 'image/png');
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}

async function buildQRPng(url) {
  if (typeof qrcode === 'undefined') return null;
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const count = qr.getModuleCount();
  const cellSize = 6;
  const margin = 2;
  const size = (count + margin * 2) * cellSize;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#32373C';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        ctx.fillRect((c + margin) * cellSize, (r + margin) * cellSize, cellSize, cellSize);
      }
    }
  }
  return await new Promise(resolve => {
    canvas.toBlob(blob => {
      if (!blob) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsArrayBuffer(blob);
    }, 'image/png');
  });
}

// ─── Model detail modal ────────────────────────────────────────────────────
function openModel(id, opts = {}) {
  const d = STATE.data[STATE.atlas];
  if (!d) return;
  const m = d.models.find(x => x.id === id);
  if (!m) return;
  // Deeplink-URL setzen (außer wenn wir selbst gerade aus der URL laden)
  if (!opts.fromHash) {
    try {
      history.replaceState(null, '', `#m/${STATE.atlas}/${encodeURIComponent(id)}`);
    } catch {}
  }
  STATE.currentModelId = id;
  document.getElementById('m-name').textContent = m.name;
  document.getElementById('m-vendor').textContent = `${m.vendor || ''} · ${m.country || ''} · ${TIER_LABEL[m.tier] || m.tier || ''}`;
  const isConv = STATE.atlas === 'conversational';
  const sov = m.sovereignty || 0;
  const dots = Array.from({ length: 5 }, (_, i) => `<i class="${i < sov ? 'on-' + sov : ''}"></i>`).join('');
  const meta = [
    ['region', 'Region', REGION_LABEL[m.region] || m.region || '—'],
    ['year', 'Release', m.year || '—'],
    ['params', 'Parameter', m.params || '—']
  ];
  if (isConv) {
    meta.push(['context', 'Kontext', m.context || '—']);
    meta.push(['modalities', 'Modalitäten', (m.modalities || ['text']).join(', ')]);
    meta.push(['german_capability', 'Deutsch', m.german_capability || '—']);
  } else {
    meta.push(['modalities', 'Eingang', m.modality_in || '—']);
    meta.push(['modalities', 'Ausgang', m.modality_out || '—']);
    meta.push([null, 'Task', m.task_type || '—']);
    meta.push([null, 'Sprachsupport', m.language_support || '—']);
  }
  meta.push(['pricing', 'Preis', m.pricing || '—']);
  meta.push(['openness', 'Offenheit', OPEN_LABEL[m.openness] || m.openness || '—']);
  const metaHtml = meta.map(([key, label, v]) => {
    const info = key ? infoIcon(key) : '';
    return `<div><div class="lbl">${label}${info}</div><div class="val">${escapeHtml(String(v))}</div></div>`;
  }).join('');
  const sovGrid = `<div class="sovgrid">
    <div><span>EU-Hosting${infoIcon('eu_host')}</span><b>${m.eu_host ? 'ja' : 'nein'}</b></div>
    <div><span>US Cloud Act${infoIcon('cloud_act')}</span><b>${m.cloud_act || '—'}</b></div>
    <div><span>Transparenz${infoIcon('transparency')}</span><b>${m.transparency || '—'}</b></div>
    <div><span>Sovereignty-Score${infoIcon('sovereignty')}</span><b>${sov}/5</b></div>
    <div><span>On-Prem-Betrieb${infoIcon('on_prem')}</span><b>${ONPREM_LABEL[m.on_prem] || '—'}</b></div>
  </div>`;
  const ucs = (m.use_cases || []).map(u => `<span>${escapeHtml(u)}</span>`).join('');
  const specs = (m.specs || []).map(s => `<span>${escapeHtml(s)}</span>`).join('');
  const sources = (m.sources || []).map(s => `<a href="${escapeAttr(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.label)} ↗</a>`).join('');
  const lic = d.licenses[m.license_id];
  const licBtn = lic ? `<span class="lic-link" onclick="openLicense('${escapeAttr(m.license_id)}')">${escapeHtml(lic.name)}</span>` : `<span style="color:var(--text-sub);font-size:12px">${escapeHtml(m.license_id || '—')}</span>`;
  const weights = m.weights ? `<h3>Modellgewichte / Repository</h3><a href="${escapeAttr(m.weights)}" target="_blank" rel="noopener">${escapeHtml(m.weights)} ↗</a>` : '';
  const url = m.url ? `<h3>Hersteller / Projekt</h3><a href="${escapeAttr(m.url)}" target="_blank" rel="noopener">${escapeHtml(m.url)} ↗</a>` : '';
  const hf = m.huggingface_url
    ? `<h3>Benchmarks & Community${infoIcon('benchmarks')}</h3><a class="hf-link" href="${escapeAttr(m.huggingface_url)}" target="_blank" rel="noopener"><svg viewBox="0 0 32 32" aria-hidden="true"><path fill="#FFD21E" d="M15.5 3.5c-5.8 0-10.5 4.7-10.5 10.5 0 2.1.6 4.1 1.7 5.7-.8.5-1.4 1.4-1.4 2.4 0 1.6 1.3 2.9 2.9 2.9.4 0 .8-.1 1.2-.2 1.6 1 3.5 1.5 5.5 1.5h.5c2.1 0 4-.5 5.7-1.5.4.2.8.2 1.2.2 1.6 0 2.9-1.3 2.9-2.9 0-1.1-.6-2-1.4-2.5 1-1.7 1.6-3.6 1.6-5.7 0-5.7-4.7-10.4-10.4-10.4z"/><circle cx="12" cy="13" r="1.5" fill="#32373C"/><circle cx="19" cy="13" r="1.5" fill="#32373C"/><path d="M11 17c0 2.2 2 4 4.5 4s4.5-1.8 4.5-4" stroke="#32373C" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg><span><strong>Hugging Face Model Card</strong><small>Aktuelle Benchmarks, Community-Diskussion, Downloads</small></span><span class="arrow">↗</span></a><div class="hf-hint">Für Vergleichswerte wie MMLU, GPQA, HumanEval etc. verweisen wir auf die externe HF-Model-Card — das ist transparent, stets aktuell und wartungsfrei.</div>`
    : '';
  const heroRow = m.image_url || m.hero_image_url ? `<h3>Bilder</h3><div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap">${m.image_url ? `<div><div style="font-size:10px;color:var(--text-sub);margin-bottom:4px">Logo</div><img src="${escapeAttr(m.image_url)}" style="width:64px;height:64px;object-fit:contain;background:var(--bg-soft);border-radius:6px;padding:6px" onerror="this.style.display='none'"></div>` : ''}${m.hero_image_url ? `<div><div style="font-size:10px;color:var(--text-sub);margin-bottom:4px">Hero</div><img src="${escapeAttr(m.hero_image_url)}" style="width:120px;height:64px;object-fit:cover;background:var(--bg-soft);border-radius:6px" onerror="this.style.display='none'"></div>` : ''}</div>` : '';
  const versionInfo = `<div class="version-info">Version ${m._version || 1} · aktualisiert ${m._updated_at ? new Date(m._updated_at).toLocaleString('de-DE') : '—'}${m._updated_by ? ' · ' + escapeHtml(m._updated_by) : ''} · <a href="javascript:void(0)" onclick="openSingleModelHistory('${escapeAttr(m.id)}')">Historie</a></div>`;

  document.getElementById('m-body').innerHTML = `
    <div class="meta-grid">${metaHtml}</div>
    <h3>Praxisnotiz${infoIcon('insider')}</h3>
    <div class="insider-full">${escapeHtml(m.insider || '')}</div>
    <h3>Souveränität${infoIcon('sovereignty')} <span class="sov" style="margin-left:8px">${dots}</span></h3>
    ${sovGrid}
    <h3>Lizenz${infoIcon('license')}</h3>
    ${licBtn}
    <h3>Use Cases${infoIcon('use_cases')}</h3>
    <div class="uc-list">${ucs || '<span>—</span>'}</div>
    ${specs ? '<h3>Eigenschaften' + infoIcon('specs') + '</h3><div class="uc-list">' + specs + '</div>' : ''}
    ${renderBucketsSection(m)}
    ${url}
    ${weights}
    ${hf}
    ${heroRow}
    <h3>Quellen</h3>
    <div class="source-list">${sources || '<span style="color:var(--text-sub);font-size:12px">Keine externen Quellen hinterlegt</span>'}</div>
    ${versionInfo}
  `;
  showModal('model-modal');
}

// ─── License modal ─────────────────────────────────────────────────────────
function openLicense(id) {
  const lic = STATE.data[STATE.atlas].licenses[id];
  if (!lic) return;
  document.getElementById('l-name').textContent = lic.name;
  document.getElementById('l-cat').textContent = lic.category || '';
  document.getElementById('l-plain').textContent = lic.plain;
  const a = document.getElementById('l-url');
  a.href = lic.url || '#';
  a.style.display = lic.url ? 'inline-block' : 'none';
  showModal('license-modal');
}

// ─── Edit-mode activation ──────────────────────────────────────────────────
async function toggleEditMode() {
  if (STATE.edit.active) {
    // Deactivate
    STATE.edit.active = false;
    STATE.edit.password = null;
    sessionStorage.removeItem('bvdw_edit_pw');
    document.body.classList.remove('edit-mode');
    document.querySelector('header.site').classList.remove('edit-mode');
    document.getElementById('edit-toggle').classList.remove('active');
    document.getElementById('edit-toggle').textContent = 'Edit Mode';
    closeHistoryFlyout();
    render();
    return;
  }
  // Show activation dialog
  showModal('edit-activate-modal');
  const savedEditor = localStorage.getItem('bvdw_editor_name') || '';
  document.getElementById('activate-editor').value = savedEditor;
  setTimeout(() => document.getElementById('activate-password').focus(), 100);
}

async function submitActivation() {
  const pw = document.getElementById('activate-password').value;
  const ed = document.getElementById('activate-editor').value.trim();
  const errEl = document.getElementById('activate-err');
  errEl.classList.remove('show');
  if (!pw) { errEl.textContent = 'Passwort erforderlich.'; errEl.classList.add('show'); return; }
  if (!ed) { errEl.textContent = 'Bitte gib deinen Namen an, damit Edits zuordenbar sind.'; errEl.classList.add('show'); return; }
  try {
    await apiPost('/api/auth', { password: pw });
  } catch (e) {
    errEl.textContent = e.status === 401 ? 'Passwort ungültig.' : (e.message || 'Fehler bei der Anmeldung.');
    errEl.classList.add('show');
    return;
  }
  STATE.edit.active = true;
  STATE.edit.password = pw;
  STATE.edit.editor = ed;
  sessionStorage.setItem('bvdw_edit_pw', pw);
  localStorage.setItem('bvdw_editor_name', ed);
  closeModal('edit-activate-modal');
  document.body.classList.add('edit-mode');
  document.querySelector('header.site').classList.add('edit-mode');
  const btn = document.getElementById('edit-toggle');
  btn.classList.add('active');
  btn.textContent = 'Edit beenden';
  render();
}

function tryRestoreEdit() {
  const pw = sessionStorage.getItem('bvdw_edit_pw');
  const ed = localStorage.getItem('bvdw_editor_name');
  if (pw && ed) {
    STATE.edit.active = true;
    STATE.edit.password = pw;
    STATE.edit.editor = ed;
    document.body.classList.add('edit-mode');
    document.querySelector('header.site').classList.add('edit-mode');
    const btn = document.getElementById('edit-toggle');
    btn.classList.add('active');
    btn.textContent = 'Edit beenden';
  }
}

// ─── Edit modal ────────────────────────────────────────────────────────────
const EDIT_FIELDS = [
  { key: 'name', label: 'Name', type: 'text', full: true },
  { key: 'vendor', label: 'Vendor / Hersteller', type: 'text' },
  { key: 'country', label: 'Land (ISO-2)', type: 'text' },
  { key: 'region', label: 'Region', type: 'text' },
  { key: 'tier', label: 'Tier', type: 'text' },
  { key: 'year', label: 'Release-Jahr', type: 'number' },
  { key: 'context', label: 'Kontextfenster', type: 'text' },
  { key: 'params', label: 'Parameter', type: 'text' },
  { key: 'license_id', label: 'License ID', type: 'text' },
  { key: 'openness', label: 'Offenheit', type: 'text' },
  { key: 'url', label: 'URL / Homepage', type: 'url' },
  { key: 'weights', label: 'Weights-URL', type: 'url' },
  { key: 'huggingface_url', label: 'Hugging Face Model Card (für Benchmarks/Community)', type: 'url', full: true },
  { key: 'image_url', label: 'Logo-URL (image_url) — überschreibt Vendor-Default wenn gesetzt', type: 'url', full: true },
  { key: 'hero_image_url', label: 'Hero-Bild-URL (hero_image_url)', type: 'url', full: true },
  { key: 'eu_host', label: 'EU-Hosting (true/false)', type: 'text' },
  { key: 'cloud_act', label: 'Cloud Act (none/low/medium/high)', type: 'text' },
  { key: 'transparency', label: 'Transparenz', type: 'text' },
  { key: 'sovereignty', label: 'Souveränität (1-5)', type: 'number' },
  { key: 'on_prem', label: 'On-Prem (yes/hybrid/no/unknown)', type: 'text' },
  { key: 'german_capability', label: 'Deutsch (low/medium/high)', type: 'text' },
  { key: 'pricing', label: 'Preis (€ bis €€€€€€)', type: 'text' },
  { key: 'supported_languages', label: 'Sprachen (kommasepariert, ISO-Codes)', type: 'text', full: true, arr: true },
  { key: 'modalities', label: 'Modalitäten (kommasepariert)', type: 'text', full: true, arr: true },
  { key: 'specs', label: 'Specs (kommasepariert)', type: 'text', full: true, arr: true },
  { key: 'use_cases', label: 'Use Cases (kommasepariert)', type: 'text', full: true, arr: true },
  { key: 'insider', label: 'Praxisnotiz (insider)', type: 'textarea', full: true }
];

let EDIT_CURRENT = null;

function openEdit(id) {
  if (!STATE.edit.active) { alert('Bitte erst den Edit-Mode aktivieren.'); return; }
  const d = STATE.data[STATE.atlas];
  const m = d.models.find(x => x.id === id);
  if (!m) return;
  EDIT_CURRENT = m;
  document.getElementById('e-title').textContent = m.name;
  document.getElementById('e-sub').textContent = `${m.vendor} · Version ${m._version || 1}`;
  const grid = document.getElementById('e-grid');
  grid.innerHTML = EDIT_FIELDS.map(f => {
    const val = f.arr ? (m[f.key] || []).join(', ') : (m[f.key] != null ? m[f.key] : '');
    const cls = f.full ? 'field full' : 'field';
    if (f.type === 'textarea') {
      return `<div class="${cls}"><label>${f.label}</label><textarea data-key="${f.key}">${escapeHtml(String(val))}</textarea></div>`;
    }
    return `<div class="${cls}"><label>${f.label}</label><input type="${f.type}" data-key="${f.key}" value="${escapeAttr(String(val))}"></div>`;
  }).join('');
  document.getElementById('e-summary').value = '';
  document.getElementById('e-status').textContent = '';
  document.getElementById('e-status').className = 'status-msg';
  showModal('edit-modal');
}

async function deleteModel() {
  if (!STATE.edit.active || !EDIT_CURRENT) return;
  const name = EDIT_CURRENT.name;
  const confirmOk = confirm(`Modell "${name}" wirklich als gelöscht markieren?\n\nGelöschte Modelle verschwinden sofort aus der Liste, bleiben aber in der Datenbank und können über die Historie wiederhergestellt werden.`);
  if (!confirmOk) return;
  const reason = prompt(`Optionaler Grund für die Historie (leer lassen = ohne):\nBeispiel: "URL offline", "Vendor eingestellt", "Doppeleintrag"`, '');
  if (reason === null) return; // abgebrochen
  const statusEl = document.getElementById('e-status');
  statusEl.textContent = 'Lösche...';
  statusEl.className = 'status-msg';
  try {
    const res = await apiPost('/api/delete', {
      password: STATE.edit.password,
      atlas: STATE.atlas,
      id: EDIT_CURRENT.id,
      editor_name: STATE.edit.editor,
      reason
    });
    statusEl.textContent = `Gelöscht (Version ${res.version})`;
    statusEl.className = 'status-msg ok';
    await reloadCurrentAtlas();
    render();
    setTimeout(() => closeModal('edit-modal'), 900);
  } catch (e) {
    statusEl.textContent = 'Fehler: ' + (e.message || 'Unbekannt');
    statusEl.className = 'status-msg error';
  }
}

async function saveEdit() {
  if (!EDIT_CURRENT) return;
  const inputs = document.querySelectorAll('#edit-modal [data-key]');
  const next = { ...EDIT_CURRENT };
  // Strip internal fields that were added by API
  delete next._version;
  delete next._updated_at;
  delete next._updated_by;
  inputs.forEach(inp => {
    const key = inp.dataset.key;
    const def = EDIT_FIELDS.find(f => f.key === key);
    let v = inp.value;
    if (def.arr) v = v.split(',').map(s => s.trim()).filter(Boolean);
    else if (def.type === 'number') v = v === '' ? null : parseFloat(v);
    else if (key === 'eu_host') v = v === 'true' || v === 'ja' || v === '1';
    else if (v === '') v = null;
    next[key] = v;
  });
  const summary = document.getElementById('e-summary').value.trim();
  const statusEl = document.getElementById('e-status');
  statusEl.textContent = 'Speichere...';
  statusEl.className = 'status-msg';
  try {
    const res = await apiPost('/api/edit', {
      password: STATE.edit.password,
      atlas: STATE.atlas,
      id: EDIT_CURRENT.id,
      data: next,
      editor_name: STATE.edit.editor,
      edit_summary: summary
    });
    statusEl.textContent = `Gespeichert (Version ${res.version})`;
    statusEl.className = 'status-msg ok';
    // Refresh atlas data
    await reloadCurrentAtlas();
    render();
    setTimeout(() => closeModal('edit-modal'), 800);
  } catch (e) {
    statusEl.textContent = 'Fehler: ' + (e.message || 'Unbekannt');
    statusEl.className = 'status-msg error';
  }
}

// ─── History flyout ────────────────────────────────────────────────────────
async function openHistoryFlyout() {
  STATE.historyOpen = true;
  STATE.historyMode = 'feed';
  STATE.historyModelId = null;
  document.getElementById('history-panel').classList.add('open');
  document.getElementById('history-title').textContent = 'Aktivität (alle Modelle)';
  await loadHistoryFeed();
}

function closeHistoryFlyout() {
  STATE.historyOpen = false;
  document.getElementById('history-panel').classList.remove('open');
}

async function loadHistoryFeed() {
  const body = document.getElementById('history-body');
  body.innerHTML = '<div class="empty">Lade Historie...</div>';
  try {
    const res = await apiGet(`/api/history?atlas=${STATE.atlas}&limit=80`);
    if (!res.versions.length) {
      body.innerHTML = '<div class="empty">Noch keine Edits in diesem Atlas.</div>';
      return;
    }
    body.innerHTML = res.versions.map(v => {
      const ts = new Date(v.created_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
      const summary = v.edit_summary ? `<div class="summary">"${escapeHtml(v.edit_summary)}"</div>` : '';
      return `<div class="hentry" onclick="openSingleModelHistory('${escapeAttr(v.model_id)}')">
        <div class="top"><span>${escapeHtml(v.model_name)}</span><span class="ver">v${v.version}</span></div>
        <div class="meta-row"><span>${escapeHtml(v.edited_by || 'anonym')}</span><span>${ts}</span></div>
        ${summary}
      </div>`;
    }).join('');
  } catch (e) {
    body.innerHTML = `<div class="empty">Fehler: ${escapeHtml(e.message)}</div>`;
  }
}

async function openSingleModelHistory(id) {
  STATE.historyOpen = true;
  STATE.historyMode = 'single';
  STATE.historyModelId = id;
  document.getElementById('history-panel').classList.add('open');
  const d = STATE.data[STATE.atlas];
  const m = d?.models.find(x => x.id === id);
  document.getElementById('history-title').textContent = `Historie: ${m?.name || id}`;
  const body = document.getElementById('history-body');
  body.innerHTML = '<div class="empty">Lade Versionen...</div>';
  try {
    const res = await apiGet(`/api/history?atlas=${STATE.atlas}&id=${encodeURIComponent(id)}`);
    if (!res.versions.length) {
      body.innerHTML = '<div class="empty">Noch keine Versionen.</div>';
      return;
    }
    const current = m?._version;
    body.innerHTML = `<div class="section-title">${res.versions.length} Version(en)</div>` + res.versions.map(v => {
      const ts = new Date(v.created_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
      const isCurrent = v.version === current;
      const revertBtn = !isCurrent && STATE.edit.active ? `<button class="revert-btn" onclick="revertToVersion('${escapeAttr(id)}',${v.version})">Diese Version wiederherstellen</button>` : '';
      const summary = v.edit_summary ? ` · "${escapeHtml(v.edit_summary)}"` : '';
      return `<div class="ventry ${isCurrent ? 'current' : ''}">
        <span class="ver-num">v${v.version}</span> · ${escapeHtml(v.edited_by || 'anonym')} · ${ts}${summary}
        ${revertBtn}
      </div>`;
    }).join('');
  } catch (e) {
    body.innerHTML = `<div class="empty">Fehler: ${escapeHtml(e.message)}</div>`;
  }
}

async function revertToVersion(id, version) {
  if (!STATE.edit.active) return;
  if (!confirm(`Modell auf Version ${version} zurücksetzen? Die aktuelle Fassung wird als neue Version archiviert.`)) return;
  try {
    await apiPost('/api/revert', {
      password: STATE.edit.password,
      atlas: STATE.atlas,
      id,
      target_version: version,
      editor_name: STATE.edit.editor
    });
    await reloadCurrentAtlas();
    render();
    await openSingleModelHistory(id);
  } catch (e) {
    alert('Fehler beim Zurücksetzen: ' + (e.message || 'Unbekannt'));
  }
}

// ─── Tab / View switching ──────────────────────────────────────────────────
async function switchTab(atlas) {
  STATE.atlas = atlas;
  STATE.filters = { search: '', region: new Set(), tier: new Set(), openness: new Set(), usecase: new Set(), sov: 0, price: 6, german: 0 };
  document.getElementById('tab-conv').setAttribute('aria-selected', atlas === 'conversational');
  document.getElementById('tab-spec').setAttribute('aria-selected', atlas === 'specialized');
  document.getElementById('search').value = '';
  document.getElementById('filter-sov').value = '0';
  document.getElementById('filter-price').value = '6';
  document.getElementById('filter-german').value = '0';
  try {
    await loadAtlas(atlas);
    buildFilters();
    render();
    if (STATE.historyOpen && STATE.historyMode === 'feed') loadHistoryFeed();
  } catch (e) {
    document.getElementById('result-count').textContent = 'Fehler: ' + e.message;
  }
}

function switchView(view) {
  STATE.view = view;
  document.getElementById('view-finder').setAttribute('aria-pressed', view === 'finder');
  document.getElementById('view-list').setAttribute('aria-pressed', view === 'list');
  document.getElementById('view-quartett').setAttribute('aria-pressed', view === 'quartett');
  render();
}

function toggleQuartettConfig() {
  STATE.quartett.configOpen = !STATE.quartett.configOpen;
  render();
}

function resetFilters() {
  STATE.filters = { search: '', region: new Set(), tier: new Set(), openness: new Set(), usecase: new Set(), buckets: new Set(), sov: 0, price: 6, german: 0, onprem: 'all' };
  document.getElementById('search').value = '';
  document.getElementById('filter-sov').value = '0';
  document.getElementById('filter-price').value = '6';
  document.getElementById('filter-german').value = '0';
  buildFilters();
  render();
}

// ─── Modals & escaping ─────────────────────────────────────────────────────
function showModal(id) { document.getElementById(id).setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; }
function closeModal(id) {
  document.getElementById(id).setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  // Deeplink entfernen wenn Model-Modal geschlossen wird
  if (id === 'model-modal' && location.hash.startsWith('#m/')) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch {}
    STATE.currentModelId = null;
  }
}

// ─── Deeplink: Modell aus URL-Hash auto-öffnen ─────────────────────────────
async function openFromHash() {
  const m = location.hash.match(/^#m\/(conversational|specialized)\/(.+)$/);
  if (!m) return;
  const [, atlas, rawId] = m;
  const id = decodeURIComponent(rawId);
  if (STATE.atlas !== atlas) {
    await switchTab(atlas);
  } else if (!STATE.data[atlas]) {
    await loadAtlas(atlas);
  }
  // Kurz warten, bis Daten geladen sind (switchTab ruft render() synchron auf, aber safety first)
  setTimeout(() => openModel(id, { fromHash: true }), 50);
}

// ─── Share / Deeplink kopieren ─────────────────────────────────────────────
async function shareModel() {
  const id = STATE.currentModelId;
  if (!id) return;
  const url = `${location.origin}${location.pathname}#m/${STATE.atlas}/${encodeURIComponent(id)}`;
  const d = STATE.data[STATE.atlas];
  const m = d?.models.find(x => x.id === id);
  const title = m ? `${m.name} — BVDW Foundation Models Atlas` : 'BVDW Foundation Models Atlas';

  // Web-Share-API (mobile/moderne Browser)
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
      // sonst auf Clipboard-Fallback
    }
  }
  // Clipboard-Fallback
  try {
    await navigator.clipboard.writeText(url);
    showToast('Link kopiert — bereit zum Einfügen');
    const btn = document.getElementById('m-share');
    if (btn) { btn.classList.add('copied'); setTimeout(() => btn.classList.remove('copied'), 1200); }
  } catch {
    prompt('Link manuell kopieren:', url);
  }
}

// ─── Toast-Notification ────────────────────────────────────────────────────
let toastTimer = null;
function showToast(message, ms = 2200) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), ms);
}

// ─── Neues Modell anlegen ──────────────────────────────────────────────────
function openCreateModal() {
  if (!STATE.edit.active) { alert('Bitte erst den Edit-Mode aktivieren.'); return; }
  // Felder zurücksetzen
  ['c-name', 'c-vendor', 'c-country', 'c-year', 'c-url', 'c-params', 'c-context', 'c-id', 'c-insider'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Atlas auf aktuellen voreinstellen
  const atlasRadio = document.querySelector(`input[name="c-atlas"][value="${STATE.atlas}"]`);
  if (atlasRadio) atlasRadio.checked = true;
  document.getElementById('c-status').textContent = '';
  document.getElementById('c-status').className = 'status-msg';
  // Auto-Slug: wenn Vendor oder Name sich ändert, ID nachziehen (sofern User sie nicht manuell editiert hat)
  let userEditedId = false;
  const idInput = document.getElementById('c-id');
  const autoSlug = () => {
    if (userEditedId) return;
    const v = document.getElementById('c-vendor').value;
    const n = document.getElementById('c-name').value;
    idInput.value = (v + '-' + n).toLowerCase()
      .replace(/ö/g, 'oe').replace(/ä/g, 'ae').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  };
  document.getElementById('c-vendor').oninput = autoSlug;
  document.getElementById('c-name').oninput = autoSlug;
  idInput.oninput = () => { userEditedId = true; };
  showModal('create-modal');
  setTimeout(() => document.getElementById('c-name').focus(), 100);
}

async function submitCreate() {
  const atlas = document.querySelector('input[name="c-atlas"]:checked')?.value || 'conversational';
  const name = document.getElementById('c-name').value.trim();
  const vendor = document.getElementById('c-vendor').value.trim();
  const statusEl = document.getElementById('c-status');
  if (!name) { statusEl.textContent = 'Name ist erforderlich.'; statusEl.className = 'status-msg error'; return; }
  if (!vendor) { statusEl.textContent = 'Vendor ist erforderlich.'; statusEl.className = 'status-msg error'; return; }

  const yearVal = parseInt(document.getElementById('c-year').value);
  const data = {
    name,
    vendor,
    country: document.getElementById('c-country').value.trim().toUpperCase() || null,
    region: document.getElementById('c-region').value,
    tier: document.getElementById('c-tier').value,
    openness: document.getElementById('c-openness').value,
    year: Number.isInteger(yearVal) ? yearVal : null,
    url: document.getElementById('c-url').value.trim() || null,
    params: document.getElementById('c-params').value.trim() || null,
    context: document.getElementById('c-context').value.trim() || null,
    german_capability: document.getElementById('c-german').value,
    on_prem: document.getElementById('c-onprem').value,
    insider: document.getElementById('c-insider').value.trim() || '',
    sovereignty: 3,
    pricing: '',
    use_cases: [],
    specs: [],
    sources: []
  };
  const id = document.getElementById('c-id').value.trim();

  statusEl.textContent = 'Lege an...';
  statusEl.className = 'status-msg';
  try {
    const res = await apiPost('/api/create', {
      password: STATE.edit.password,
      atlas,
      id,
      data,
      editor_name: STATE.edit.editor
    });
    statusEl.textContent = `Angelegt als "${res.id}"`;
    statusEl.className = 'status-msg ok';
    // Ziel-Atlas ggf. wechseln und neu laden
    if (STATE.atlas !== atlas) {
      await switchTab(atlas);
    } else {
      await reloadCurrentAtlas();
      render();
    }
    setTimeout(() => {
      closeModal('create-modal');
      openModel(res.id);
      showToast(`Modell "${name}" angelegt — jetzt im Edit-Modus weiter ausfüllen`);
    }, 600);
  } catch (e) {
    statusEl.textContent = 'Fehler: ' + (e.message || 'Unbekannt');
    statusEl.className = 'status-msg error';
  }
}
function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
function escapeAttr(s) { return escapeHtml(s).replace(/\n/g, ' '); }

// ─── Init ──────────────────────────────────────────────────────────────────
// ─── Globales Tooltip-System für .info-icon ────────────────────────────────
// Ein einziger Tooltip-Container auf body-Ebene, dynamisch positioniert mit
// Viewport-Clamping — löst Overflow-Clipping in Modal/Flyout.
function setupInfoTooltips() {
  if (document.getElementById('global-tooltip')) return;
  const tip = document.createElement('div');
  tip.id = 'global-tooltip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);

  let currentIcon = null;

  function position(icon) {
    const rect = icon.getBoundingClientRect();
    // Zunächst Content setzen, damit wir die Größe messen können
    tip.textContent = icon.dataset.tip || '';
    tip.classList.add('visible');
    tip.classList.remove('above', 'below');
    // Force reflow to measure
    const tipRect = tip.getBoundingClientRect();
    const margin = 8;
    const gap = 10;
    const iconCenterX = rect.left + rect.width / 2;

    // Versuch: oberhalb des Icons zentriert
    let top = rect.top - tipRect.height - gap;
    let placement = 'above';
    if (top < margin) {
      // nicht genug Platz oben → unterhalb
      top = rect.bottom + gap;
      placement = 'below';
    }

    // Horizontal zentrieren, dann an Viewport clampen
    let left = iconCenterX - tipRect.width / 2;
    if (left < margin) left = margin;
    if (left + tipRect.width > window.innerWidth - margin) {
      left = window.innerWidth - tipRect.width - margin;
    }

    // Arrow-Offset berechnen (relativ zur Tooltip-Position)
    const arrowX = Math.max(12, Math.min(tipRect.width - 12, iconCenterX - left));

    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
    tip.style.setProperty('--arrow-x', arrowX + 'px');
    tip.classList.add(placement);
  }

  function hide() {
    tip.classList.remove('visible', 'above', 'below');
    currentIcon = null;
  }

  document.addEventListener('mouseover', e => {
    const icon = e.target.closest?.('.info-icon');
    if (icon && icon !== currentIcon) {
      currentIcon = icon;
      position(icon);
    }
  });
  document.addEventListener('mouseout', e => {
    const icon = e.target.closest?.('.info-icon');
    if (!icon) return;
    const goingTo = e.relatedTarget?.closest?.('.info-icon');
    if (goingTo === icon) return;
    hide();
  });
  document.addEventListener('focusin', e => {
    const icon = e.target.closest?.('.info-icon');
    if (icon) { currentIcon = icon; position(icon); }
  });
  document.addEventListener('focusout', e => {
    const icon = e.target.closest?.('.info-icon');
    if (icon) hide();
  });
  // Bei Scroll/Resize Tooltip neu positionieren oder verstecken
  window.addEventListener('scroll', hide, true);
  window.addEventListener('resize', hide);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
}

function renderMethodologyLegend() {
  const el = document.getElementById('methodology-defs');
  if (!el) return;
  const html = Object.entries(FIELD_EXPLAIN).map(([key, e]) => {
    const detail = e.detail ? `<div class="detail">${escapeHtml(e.detail)}</div>` : '';
    return `<details class="def" id="legend-${key}"><summary>${escapeHtml(e.label)}</summary><div class="short">${escapeHtml(e.short)}</div>${detail}</details>`;
  }).join('');
  el.innerHTML = html;
}

async function init() {
  tryRestoreEdit();
  setupInfoTooltips();
  renderMethodologyLegend();
  document.getElementById('search').addEventListener('input', e => { STATE.filters.search = e.target.value; render(); });
  document.getElementById('filter-sov').addEventListener('change', e => { STATE.filters.sov = parseInt(e.target.value); render(); });
  document.getElementById('filter-price').addEventListener('change', e => { STATE.filters.price = parseInt(e.target.value); render(); });
  const germanSel = document.getElementById('filter-german');
  if (germanSel) germanSel.addEventListener('change', e => { STATE.filters.german = parseInt(e.target.value); render(); });
  const sortSel = document.getElementById('sort-select');
  if (sortSel) sortSel.addEventListener('change', e => { STATE.sort = e.target.value; render(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      ['model-modal', 'license-modal', 'edit-modal', 'edit-activate-modal', 'create-modal', 'bucket-detail-modal'].forEach(id => closeModal(id));
      closeHistoryFlyout();
    }
    // Swipe-Keyboard-Shortcuts wenn Finder aktiv und keine Modals offen
    if (STATE.view === 'finder' && !STATE.swipe?.finished) {
      const modalOpen = document.querySelector('.modal-bg[aria-hidden="false"]');
      if (modalOpen) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); answerSwipe('no'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); answerSwipe('yes'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); answerSwipe('skip'); }
    }
  });
  // Meta-Daten zeigen
  try {
    await loadAtlas('conversational');
    const meta = STATE.data.conversational.meta;
    if (meta && meta.last_updated) document.getElementById('last-updated').textContent = meta.last_updated;
    buildFilters();
    render();
    // Deeplink auto-open, falls URL-Hash auf ein Modell zeigt
    await openFromHash();
    // Back/Forward-Navigation: bei hashchange reagieren
    window.addEventListener('hashchange', () => {
      if (location.hash.startsWith('#m/')) {
        openFromHash();
      } else if (STATE.currentModelId) {
        closeModal('model-modal');
      }
    });
  } catch (e) {
    document.getElementById('result-count').textContent = 'Fehler beim Laden: ' + e.message;
  }
}

// Expose for inline handlers
window.switchTab = switchTab;
window.switchView = switchView;
window.resetFilters = resetFilters;
window.openModel = openModel;
window.openLicense = openLicense;
window.openEdit = openEdit;
window.saveEdit = saveEdit;
window.toggleEditMode = toggleEditMode;
window.submitActivation = submitActivation;
window.openHistoryFlyout = openHistoryFlyout;
window.closeHistoryFlyout = closeHistoryFlyout;
window.openSingleModelHistory = openSingleModelHistory;
window.revertToVersion = revertToVersion;
window.toggleQuartettConfig = toggleQuartettConfig;
window.closeModal = closeModal;
window.deleteModel = deleteModel;
window.downloadCardPdf = downloadCardPdf;
window.shareModel = shareModel;
window.openCreateModal = openCreateModal;
window.submitCreate = submitCreate;
window.showBucketDetail = showBucketDetail;
window.answerSwipe = answerSwipe;
window.applySwipeAndShowList = applySwipeAndShowList;
window.restartFinder = restartFinder;

init();
