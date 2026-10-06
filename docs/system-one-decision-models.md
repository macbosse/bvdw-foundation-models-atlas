# Entscheidungsmodelle („System One“ / Decision AI) im Foundation Models Atlas

**Stand: 6. Oktober 2026 · Autor: BVDW AI Tech Lab · Status: umgesetzt (Stufe 1), Stufe 2 als Roadmap**

Dieses Dokument fasst zusammen, was die im September 2026 entstandene Modellklasse der „System-One“- oder Decision-Modelle ist, wie belastbar die Faktenlage ist, und wie sie in den Atlas integriert wird. Quellen sind nach Typ gekennzeichnet: **[O]** Hersteller, **[I]** unabhängig (Presse, Wissenschaft, benannte Experten), **[S]** SEO-/Vendor-Blog.

---

## 1. Was ist ein System-One-Modell?

TypeSafe AI, das die Klasse mit dem Modell **Jev** am 15. September 2026 ausgerufen hat, definiert sie als *„a class of AI models built to make fast, structured decisions that software can use directly“* [O]. Konkret:

- **Eingabe:** ein Zustand als Text oder JSON plus vordefinierte, typisierte Fragen.
- **Ausgabe:** keine Sätze, sondern typisierte Werte mit Wahrscheinlichkeiten. Drei Primitive: **Choice** (eine Option aus bis zu 255, mit Verteilung), **Score** (Position auf 2–10 benannten Stufen), **Noul** (Ja/Nein als Wahrscheinlichkeit 0–1).
- **Mechanik:** alle Fragen werden parallel in einem Durchlauf beantwortet („non-autoregressive sampler“), trainiert per „Reinforcement Learning for Calibrated Decisions“. Kalibriert heißt: Was mit 0,2 bewertet wird, soll in rund 20 % der Fälle eintreten [O].
- **Was es nicht tut:** Text, Code oder Begründungen erzeugen.

Der Name ist Marketing (Kahnemans schnelles „System 1“); Meta FAIR hatte den Begriff 2024 in anderer Bedeutung benutzt [I, arXiv 2407.06023]. Die unabhängige Kurzfassung lautet: *„lightweight non-generative classifiers that return typed, calibrated verdicts“* [I, arXiv 2609.28940].

### Abgrenzung zu bekannten Bausteinen

| Baustein | Unterschied zum System-One-Modell |
|---|---|
| LLM mit JSON-Mode / Structured Output / Function Calling | Erzeugt weiterhin Token sequenziell und liefert einen String, den Code parsen muss. System One liefert direkt eine Verteilung über vorgegebene Optionen, daher Latenz im Bereich 10²–10³ ms und Input-only-Preis. Ein eigenständiger **Genauigkeits**-Vorteil des typisierten Readouts ist nicht belegt; belegt sind Latenz, Kosten und der Nutzen der Konfidenz für Kaskaden [I, arXiv 2609.32160]. |
| Klassische ML-Klassifikatoren | Brauchen Labels und ein festes Label-Set. System One ist zero-shot, Labels werden pro Anfrage definiert. Mit vorhandenen Labels bleibt ein kleiner trainierter Klassifikator auf Intents aber oft genauer und vollständig im Haus [I, Rafe/Das, arXiv 2610.00346]. |
| Guardrail-/Moderationsmodelle (Llama Guard, ShieldGemma) | Feste Taxonomie, meist ein Urteil. System One ist frei konfigurierbar; Vergleichsmetriken gegen Llama Guard fehlen, und bei Prompt-Injection zeigen sich systematische Lücken trotz guter Durchschnittskalibrierung [I, arXiv 2609.33401]. |
| Reranker / Embeddings | Reranking ist ein deklarierter Use Case (Score pro Passage), aber ohne Vektorrepräsentation und teurer pro Kandidat als ein Embedding. |
| Decision Transformer / World Models | Modellieren Trajektorien. System One beantwortet isolierte Fragen zu einem Zustand ohne Gedächtnis oder Planung. |

**Typische Einsatzfelder** laut Hersteller-Use-Case-Map und Community-Auswertung von über 2.000 GitHub-Projekten [O/I]: Intent- und Ticket-Routing, Modell-Routing nach Konfidenz, Guardrails, Fraud-/Risk-Flags, Lead-Scoring, Reranking und RAG-Filter, Aktions-Gates in Agenten, begrenzte Extraktion.

---

## 2. Marktstand Oktober 2026

Innerhalb von drei Wochen ist aus einem Produkt ein Segment geworden. Der Endpunkt `POST /v1/systemone` wird von Ollama, Upstage, meraGPT und OpenRouter übernommen; Perplexity und Cloudflare nutzen dieselben Fragetypen. Das senkt API-Lock-in, nicht aber Modell-Lock-in.

| Modell | Anbieter (Land) | Verfügbarkeit | Offenheit | Belegt durch |
|---|---|---|---|---|
| **Jev** (jev-1.13.0) | TypeSafe AI (US) | API, Gateways (Vercel, Cloudflare, OpenRouter), Databricks `ai_decide` | api-only, keine Gewichte, kein On-Prem | [O] Docs, [I] TechCrunch, Business Wire, 6+ arXiv-Arbeiten |
| **OpenAI Decisions API** (auf GPT-6 Luna) | OpenAI (US) | Limited Preview seit 29.09. | api-only | [I] TechCrunch; keine Doku, keine Preise |
| **Clef 27B / Clef-flash 9B** | Cloudflare (US) | Workers AI + offene Gewichte | Apache 2.0 (Qwen-Basis) | [O] Blog, Hugging Face |
| **pplx-decider-v1-27b** | Perplexity (US) | API ($0.04/M Input) + Gewichte | Apache 2.0 laut Drittquelle | [O] Docs; Lizenz nur Drittquelle |
| **Strands Decider 2B** | AWS (US) | lokal lauffähig | Apache 2.0 | [I] SiliconANGLE |
| **Laya** (421M / 322M multilingual) | Convai Innovations (IN, Drittquelle) | Self-Hosting, CPU-fähig, 100+ Sprachen | Apache 2.0 | [O] Modelcard; zero-shot nahe Zufall, Kalibrierung erst nach Fine-Tuning |
| **Kev** (0.8B–27B) | Jared Palmer, Einzelentwickler | Gewichte, OpenRouter (4B) | Apache 2.0 | [I] Willison, Rafe/Das; Primärseiten nicht geprüft |
| **GLiNER2.5-Decide** (340M) | Fastino Labs | Gewichte, CPU < 200 ms | Apache 2.0 | [O] Blog; Parameterzahl widersprüchlich |
| **CLM v0.1-8B** | Contrastive-LM (Stanford-nah) | Gewichte | Apache 2.0 | akademisch, Decision Index weit hinter Jev |
| **Decision 1.0** (6 Modelle, 0.6B–9B) | vLLM Semantic Router | Gewichte | Apache 2.0 | nur Vendor-Benchmarks |
| Tev1, d1, Solar Decide, Decider 1, Span-01, Mercury Decide | Together, Liquid AI, Upstage, meraGPT, Respan, Inception | API / Early Access | überwiegend api-only, Lizenz Tev1 unklar | nur Drittverzeichnis, kaum Doku → **nicht aufgenommen**, beobachtet |

**Unabhängige Evidenz zu Jev** (alle für Version 1.13.0, 1–3 Wochen nach Release): Uni Bonn/Lamarr/Fraunhofer IAIS messen über 37 Datensätze eine Kalibrierung mit ECE 0,028 bei Choice, 86,7 % auf Belebele über 122 Sprachvarianten, Schwächen bei Low-Resource-Sprachen und Rubrik-Scoring [I, arXiv 2609.37647]. Texas State findet 31 % akzeptierte Out-of-Scope-Anfragen und zeigt, dass Kaskaden Jev-Genauigkeit bei 43 % der Kosten erreichen [I, arXiv 2610.00346]. Ein Umbenennen der Optionen von 0/1 zu no/yes senkt die AUC von 0,94 auf 0,23 [I, arXiv 2609.26758]. inovex testete deutsche Support-Tickets ohne Metriken und sah Streuung von 0,67–0,76 bei identischen Läufen [I]. **Deutsche Benchmarks fehlen komplett.**

**Hersteller-Claims, nicht unabhängig belegt:** „193,6× schneller / 444,6× günstiger“ stammen aus TypeSafes eigenem Vier-Workflow-Eval gegen ein Mittel aus GPT-6 Astra und Claude Fable 5.1, mit eigenem Caveat „higher end of real world gains“; „Zero Hallucinations“; Bewertungsgerüchte von 200 Mio. bis über 10 Mrd. US-Dollar; keine namentlich genannten zahlenden Kunden.

**Kein europäischer Anbieter** in der Klasse gefunden. Aleph Alphas Kolibri (3. Oktober) ist ein souveränes LLM, kein Entscheidungsmodell. Die Haltung von Anthropic, Google und Mistral konnte nicht abschließend geprüft werden.

---

## 3. Integrationsoptionen und Empfehlung

| Option | Beschreibung | Aufwand | Bewertung |
|---|---|---|---|
| **A – Tag im Spezial-Atlas** | Entscheidungsmodelle als eigener Task-Typ `decision`, Ausgangsmodalität `decision` und Modellklasse `system-one` in der bestehenden Liste „Spezial-Modalitäten“. Eigene Filter-Pille, Badge, Methodik-Eintrag. | gering (JSONB-Felder, Filter, Labels) | **Empfohlen für jetzt.** Zehn belastbare Einträge rechtfertigen keinen eigenen Tab; die Klasse ist drei Wochen alt und ihre Grenzen zu klassischen Klassifikatoren sind noch in Bewegung. |
| **B – Eigener Atlas-Tab „Entscheidungsmodelle“** | Dritte Liste mit eigenem Schema (Primitive, Kalibrierung, Latenz, Schema-Limits, API-Kompatibilität). | mittel (DB-Constraint `atlas IN (...)`, API-Validierung, Frontend-Tab, Create-Dialog, Quartett-Statistiken) | Sinnvoll, sobald **≥ 10–15 relevante Modelle mit unabhängigen Messwerten** vorliegen und mindestens ein EU-Anbieter existiert. Dann lohnt sich ein eigenes Vergleichsschema. |
| **C – Querschnittsdimension „Modellklasse“ in beiden Listen** | `model_class` als Filter überall (LLM, System One, Diffusion …). | gering bis mittel | Als Ergänzung zu A sinnvoll; als alleinige Lösung zu unscharf, weil die Klasse eigene Felder braucht. |

**Umgesetzt (Oktober 2026): Option A plus das Datenfeld aus C.**

- Spezial-Atlas: Filter-Vokabular um `task_types: decision`, `modality_in: json`, `modality_out: decision` und die Use Cases `kundenkommunikation`, `datenanalyse`, `agent`, `compliance` erweitert.
- Neues Feld `model_class` (Wert `system-one`), sichtbar als Badge in Liste und Detail, editierbar im Edit-Mode.
- Neuer Filter „Task-Typ“ (erscheint nur im Spezial-Atlas) mit deutschem Label „Entscheidung (System One)“.
- Methodik-Legende und Footer um die Klasse ergänzt; neutraler Hinweis, dass Kalibrierungs- und Geschwindigkeitsangaben überwiegend von Herstellern stammen.
- Aufnahme von zehn Modellen (siehe Tabelle oben, Zeilen 1–10); sechs weitere wurden wegen fehlender Primärdokumentation nicht aufgenommen und bleiben auf der Beobachtungsliste.

### Aufnahmekriterien für Entscheidungsmodelle (Ergänzung zu den Hygienefaktoren)

1. **Zugänglichkeit:** öffentliche API, offene Gewichte oder kommerzielle Lizenz. Early Access ohne Doku reicht nicht; „Limited Preview“ großer Anbieter wird mit Status `preview` geführt.
2. **Primärdokumentation:** mindestens eine Hersteller-Quelle (Docs, Modelcard oder Blog) mit Fragetypen, Limits und Lizenz. Reine Verzeichniseinträge genügen nicht.
3. **Text-/JSON-Eingabe** und typisierte Ausgabe mit Wahrscheinlichkeit; reine Klassifikatoren mit festem Label-Set gehören nicht in die Klasse.
4. Deutsch ist **kein** Hygienefaktor (wie im Spezial-Atlas üblich), aber die Sprachabdeckung wird im Feld `language_support` und in der Praxisnotiz ausgewiesen.

### Felder, die ein künftiger eigener Tab (Option B) erfassen sollte

Primitive (choice/score/noul), maximale Optionen und Fragen pro Aufruf, Score-Stufen, Eingabemodalität und State-Budget, Determinismus/Seed, Kalibrierung getrennt nach Hersteller-Claim und unabhängiger Messung (ECE, Brier, Version), Robustheit (Optionsnamen- und Positions-Bias, Out-of-Scope), Latenz (Claim vs. Messung, Hardware), Preismodell (Input-only), Basisarchitektur (eigenständig vs. Head/LoRA auf Qwen/ModernBERT), API-Kompatibilität zu `/v1/systemone`, Compliance (EU-Region, Zero Data Retention, DPA/SCC, Zertifikate, Training auf Kundendaten), Liste unabhängiger Evaluationen mit Datum.

---

## 4. Relevanz für den deutschen Mittelstand

- **Realistischer Nutzen:** billige, schnelle Vorentscheidungen in hohem Volumen (E-Mail- und Ticket-Triage, Lead-Scoring, Moderations-Flags, Agenten-Gates, RAG-Filter) mit Konfidenz-Routing zu Mensch oder LLM. Größenordnung: 346.000 Anfragen für 9,15 US-Dollar in der Bonner Studie.
- **Grenzen** laut inovex [I]: keine Begründungen, schwach bei abhängigen Merkmalen, Zählen, Datumslogik, doppelter Verneinung und unternehmensspezifischen Kategorien. Geeignet für unabhängige Einzelklassifikationen niedriger Kritikalität.
- **Einstieg ohne US-Transfer:** offene Modelle (Laya, Kev, Clef-Gewichte, Strands Decider, Decision 1.0) lokal oder in einer EU-Cloud betreiben und mit eigenen Daten nachkalibrieren. Aufwand für Fine-Tuning und Schwellenwert-Fitting einplanen. Jev selbst nur mit anonymisierten oder synthetischen Daten testen.

---

## 5. Souveränität und Compliance

- **Cloud Act / DSGVO:** Jev wird aus den USA betrieben, ohne EU-Region und ohne On-Prem. DPA mit EU-Standardvertragsklauseln, irisches Recht, Zero Data Retention nur für Enterprise, keine veröffentlichten SOC-2- oder ISO-27001-Nachweise (Stand 4. Oktober). Gateways ändern nichts am Verarbeitungsort. Souveränitäts-Score im Atlas: 1/5.
- **Art. 22 DSGVO:** Bei HR-, Kredit- oder Versicherungsentscheidungen liegt eine automatisierte Einzelentscheidung vor; ein Konfidenzwert ersetzt keine Begründung. DSFA, menschliche Überprüfung und Datensparsamkeit sind nötig [I, dr-dsgvo].
- **EU AI Act:** Dieselben Einsatzfelder fallen nach Anhang III in Hochrisiko; das Modell liefert keine Erklärung, der Orchestrator muss Transparenz und Audit-Trail liefern. Als zweckgebundene Klassifikatoren sind System-One-Modelle vermutlich nicht GPAI-pflichtig (eigene Einschätzung, offen).
- **EU-Alternativen:** derzeit nur offene Gewichte aus den USA und Indien zum Selbsthosten. Offene Hypothese: ein europäisches Basismodell wie Kolibri könnte Grundlage eines EU-Decision-Heads sein.

---

## 6. Kritik und offene Fragen

- Benchmarks sind fast ausschließlich herstellerdefiniert; unabhängige Arbeiten decken wenige Wochen und eine Modellversion ab.
- Kalibrierung ist im Durchschnitt gut (Choice), aber mit verdeckter Unsicherheit, Überkonfidenz bei Multi-Label-Noul und Verdacht auf „Konsens statt Wahrheit“. Optionsnamen- und Positions-Bias: „type-safe“ heißt nicht „error-free“.
- Erklärbarkeit: reines Black-Box-Urteil, Bias nur statistisch messbar.
- Governance: dynamische Rate-Limits, keine Versionshistorie, Use-Case-Map ohne Ausschlussfälle, Dual-Use-Hinweise (The Register).
- Offen: EU-Hosting-Pläne von TypeSafe, deutsche Benchmarks, Haltung europäischer Anbieter, Lizenz von Tev1, Firmensitze mehrerer Kleinanbieter.

**Empfohlene Wiedervorlage:** Januar 2027. Prüfpunkte: EU-Anbieter oder EU-Region, unabhängige deutsche Evaluationen, Anzahl belastbarer Modelle für Option B.

---

## 7. Quellen (Auswahl)

**[O] Hersteller:** [typesafe.ai](https://typesafe.ai/) · [Launch-Post](https://typesafe.ai/blog/introducing-system-one-models-and-jev) · [Docs: System One](https://docs.typesafe.ai/concepts/system-one) · [Docs: Models](https://docs.typesafe.ai/models) · [Docs: Primitives](https://docs.typesafe.ai/primitives) · [Docs: Confidence](https://docs.typesafe.ai/confidence) · [Docs: Jaggedness jev-1.13](https://docs.typesafe.ai/model-jaggedness/jev-1.13) · [Legal](https://docs.typesafe.ai/legal) · [DPA](https://typesafe.ai/legal/data-processing) · [Cloudflare Clef](https://blog.cloudflare.com/clef-decision-models/) · [Perplexity Decisions](https://docs.perplexity.ai/docs/decisions/quickstart) · [Databricks ai_decide](https://www.databricks.com/blog/introducing-aidecide-make-fast-decisions-your-governed-data) · [Ollama](https://ollama.com/blog/ollama-now-supports-jev-style-decision-models) · [Fastino](https://fastino.ai/blog/gliner-2-5-decide-open-weight-decision-model) · [vLLM-SR](https://vllm-sr.ai/blog/decision-models/) · [Laya Modelcard](https://huggingface.co/convaiinnovations/laya)

**[I] Presse:** [TechCrunch 18.09.](https://techcrunch.com/2026/09/18/a-new-kind-of-ai-model-from-a-chatgpt-inventor-is-thrilling-developers/) · [TechCrunch 30.09. (OpenAI)](https://techcrunch.com/2026/09/30/openais-jev-clone-could-help-the-frontier-lab-stop-its-swarming-agents) · [The Register](https://www.theregister.com/ai-and-ml/2026/09/16/typesafe-ai-debuts-model-for-machines-that-plays-doom/5296711) · [SiliconANGLE (TypeSafe)](https://siliconangle.com/2026/09/16/typesafe-ai-exits-stealth-with-40m-to-build-ai-for-use-by-software/) · [SiliconANGLE (AWS)](https://siliconangle.com/2026/10/01/aws-debuts-strands-decider-2b-a-first-lightweight-decision-model-for-accelerate-agentic-workflows/) · [Pressemitteilung Seed](https://finance.yahoo.com/technology/ai/articles/typesafe-ai-emerges-stealth-40m-190000776.html)

**[I] Wissenschaft:** [arXiv 2609.37647 (Deußer et al.)](https://arxiv.org/abs/2609.37647) · [arXiv 2610.00346 (Rafe/Das)](https://arxiv.org/abs/2610.00346) · [arXiv 2609.26758 (Optionsnamen-Bias)](https://arxiv.org/abs/2609.26758) · [arXiv 2609.33401 (Agent-Security)](https://arxiv.org/abs/2609.33401v1) · [arXiv 2609.32160 (Evidence Audit)](https://arxiv.org/abs/2609.32160) · [arXiv 2609.28940 (Pentest-Harness)](https://arxiv.org/abs/2609.28940) · [arXiv 2407.06023 (Meta FAIR)](https://arxiv.org/abs/2407.06023)

**[I] Experten und Tests:** [inovex (DE, Test auf Deutsch)](https://www.inovex.de/de/blog/typesafe-ai-jev-im-test-wie-gut-ist-das-neue-modell-fuer-ki-klassifikation/) · [dr-dsgvo (Art. 22)](https://dr-dsgvo.de/jev-typesafe-ai-system-one-model-ki-automatisierung/) · [Simon Willison](https://simonw.substack.com/p/jev-introduces-a-new-shape-of-llm) · [Kai Waehner (Architektur)](https://www.kai-waehner.de/blog/2026/09/28/how-system-one-models-like-jev-change-enterprise-ai-architecture/) · [JevBench v1.2](https://github.com/fstandhartinger/jevbench/blob/main/RESULTS-v1.2.md) · [systemonemodels.org (unabhängiges Verzeichnis)](https://systemonemodels.org/)

**[S] Einordnungen:** [innfactory](https://innfactory.ai/en/ai-models/typesafe-jev/) · [ki-mittelstand.eu](https://www.ki-mittelstand.eu/blog/jev-typesafe-entscheidungsmodell) · [DataCamp](https://www.datacamp.com/blog/system-one-models-jev)
