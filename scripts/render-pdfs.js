// Rendert die Markdown-Übergabe-Dokumente als schöne PDFs.
// Nutzt marked (MD→HTML) und Chrome Headless (HTML→PDF).
// Verwendung: npm run render-pdfs
import { marked } from 'marked';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TMP = join(ROOT, '.tmp-pdf');
mkdirSync(TMP, { recursive: true });

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!existsSync(CHROME)) {
  console.error('Fehler: Google Chrome nicht unter /Applications/ gefunden. Bitte Pfad anpassen.');
  process.exit(1);
}

// ─── HTML-Template mit BVDW-Branding ───────────────────────────────────────
function wrapHtml({ title, subtitle, body, docNumber, date }) {
  const logoPath = join(ROOT, 'assets/bvdw-logo/bvdw-cobalt.png');
  const logoB64 = existsSync(logoPath)
    ? `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`
    : null;

  return `<!doctype html>
<html lang="de"><head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  @page { size: A4; margin: 22mm 20mm 22mm 20mm; }
  @page:first { margin-top: 0; }

  html, body { font-family: -apple-system, "Inter", "Helvetica Neue", Arial, sans-serif; color: #32373C; font-size: 10.5pt; line-height: 1.55; margin: 0; padding: 0; }

  /* Titelseite */
  .cover { page-break-after: always; padding: 55mm 20mm 30mm; display: flex; flex-direction: column; height: 100vh; box-sizing: border-box; background: linear-gradient(180deg, #fff 0%, #F4F7FC 100%); }
  .cover .logo { width: 72px; height: 72px; margin-bottom: 32px; }
  .cover .doc-number { font-size: 10pt; letter-spacing: .16em; text-transform: uppercase; color: #5E6570; font-weight: 600; margin-bottom: 18px; }
  .cover h1 { font-size: 36pt; font-weight: 800; color: #0045C3; letter-spacing: -.02em; line-height: 1.1; margin: 0 0 16px; }
  .cover .subtitle { font-size: 14pt; color: #32373C; font-weight: 500; line-height: 1.4; margin: 0 0 auto; max-width: 85%; }
  .cover .meta { font-size: 9.5pt; color: #5E6570; line-height: 1.7; border-top: 2px solid #0045C3; padding-top: 16px; margin-top: auto; }
  .cover .meta strong { color: #32373C; font-weight: 600; }

  /* Fließtext */
  .content { padding-top: 0; }
  h1 { font-size: 20pt; font-weight: 800; color: #0045C3; letter-spacing: -.01em; margin: 0 0 14pt; page-break-before: auto; page-break-after: avoid; border-bottom: 3px solid #0045C3; padding-bottom: 8pt; }
  h1:first-child { page-break-before: avoid; }
  h2 { font-size: 14pt; font-weight: 700; color: #0045C3; margin: 24pt 0 10pt; letter-spacing: -.005em; page-break-after: avoid; }
  h3 { font-size: 11.5pt; font-weight: 700; color: #32373C; margin: 18pt 0 6pt; page-break-after: avoid; }
  h4 { font-size: 10pt; font-weight: 700; color: #32373C; margin: 14pt 0 4pt; text-transform: uppercase; letter-spacing: .04em; page-break-after: avoid; }
  p { margin: 0 0 8pt; }
  a { color: #0045C3; text-decoration: none; border-bottom: 1px solid #C4D5F0; }

  ul, ol { margin: 0 0 10pt; padding-left: 18pt; }
  li { margin-bottom: 3pt; }
  ul li::marker { color: #0045C3; }
  ol li::marker { color: #0045C3; font-weight: 600; }

  /* Code */
  code { background: #F2F4F9; border: 1px solid #E4E6EE; padding: 1pt 4pt; border-radius: 2pt; font-family: "SF Mono", "Menlo", monospace; font-size: 9pt; color: #32373C; }
  pre { background: #F6F7FA; border-left: 3px solid #0045C3; padding: 10pt 12pt; border-radius: 2pt; overflow-x: auto; margin: 10pt 0; page-break-inside: avoid; }
  pre code { background: transparent; border: none; padding: 0; font-size: 9pt; line-height: 1.45; color: #32373C; display: block; white-space: pre-wrap; word-break: break-word; }

  /* Tabellen */
  table { border-collapse: collapse; margin: 12pt 0; width: 100%; font-size: 9.5pt; page-break-inside: avoid; }
  thead { background: #0045C3; color: #fff; }
  th { padding: 6pt 8pt; text-align: left; font-weight: 600; letter-spacing: .02em; font-size: 9pt; text-transform: uppercase; }
  td { padding: 6pt 8pt; border-bottom: 1px solid #E4E6EE; vertical-align: top; }
  tr:nth-child(even) td { background: #F6F7FA; }

  /* Blockquote */
  blockquote { border-left: 3px solid #FF5833; padding: 6pt 12pt; margin: 10pt 0; background: #FFF5F1; color: #5E6570; font-style: italic; }

  hr { border: none; border-top: 1px solid #E4E6EE; margin: 18pt 0; }

  /* Listenkontrollen (Checkboxen in Checklisten) */
  ul.contains-task-list { list-style: none; padding-left: 0; }
  li.task-list-item { padding-left: 0; }
  input[type="checkbox"] { margin-right: 8pt; vertical-align: middle; }

  /* Footer auf jeder Seite über @page-Running-Header (Chrome unterstützt das) */
  /* Chrome headless rendert @bottom-right leider nicht, deshalb am Ende explizit: */
  .page-footer { position: running(footer); text-align: right; font-size: 8pt; color: #5E6570; }

  strong { color: #0045C3; font-weight: 700; }
  em { color: #32373C; }
</style>
</head><body>
  <div class="cover">
    ${logoB64 ? `<img class="logo" src="${logoB64}" alt="BVDW">` : ''}
    <div class="doc-number">${docNumber}</div>
    <h1>${title}</h1>
    <div class="subtitle">${subtitle}</div>
    <div class="meta">
      <strong>Projekt:</strong> Foundation Models Atlas · AI Tech Lab<br>
      <strong>Stand:</strong> ${date}<br>
      <strong>Aktuelle URL:</strong> bosses-foundation-models.vercel.app
    </div>
  </div>
  <div class="content">
    ${body}
  </div>
</body></html>`;
}

// ─── Ein Dokument rendern ──────────────────────────────────────────────────
async function render(mdPath, pdfPath, options) {
  console.log(`\n→ ${mdPath}`);
  const md = readFileSync(mdPath, 'utf-8');

  // Erste H1 aus dem Markdown entfernen, damit die nicht zweimal im PDF ist
  // (die Titelseite hat ja schon den Titel)
  const mdBody = md.replace(/^#\s+.+\n/, '').trimStart();

  const html = marked.parse(mdBody, { gfm: true, breaks: false });
  const fullHtml = wrapHtml({ ...options, body: html });

  const htmlPath = join(TMP, `${options.slug}.html`);
  writeFileSync(htmlPath, fullHtml);

  // Chrome Headless PDF
  const cmd = [
    `"${CHROME}"`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=3000',
    `--print-to-pdf="${pdfPath}"`,
    '--no-pdf-header-footer',
    `"file://${htmlPath}"`
  ].join(' ');

  try {
    execSync(cmd, { stdio: 'pipe', timeout: 30000 });
    console.log(`✓ ${pdfPath}`);
  } catch (err) {
    console.error(`✗ Chrome-Fehler:`, err.message);
    throw err;
  }
}

async function main() {
  console.log('BVDW Atlas — PDF-Rendering der Übergabe-Dokumente\n');
  const today = new Date();
  const dateDE = today.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

  await render(
    join(ROOT, 'HANDOVER_BVDW.md'),
    join(ROOT, 'HANDOVER_BVDW.pdf'),
    {
      slug: 'handover-bvdw',
      title: 'Übergabe-Dokument für das BVDW-Team',
      subtitle: 'Technische Übergabe des Foundation Models Atlas an den BVDW — inkl. Account-Setup, Migrations-Anleitung und Betriebsempfehlungen.',
      docNumber: 'Technische Übergabe · Dokument 01',
      date: dateDE
    }
  );

  await render(
    join(ROOT, 'HANDOVER.md'),
    join(ROOT, 'HANDOVER.pdf'),
    {
      slug: 'handover',
      title: 'Team-Handover für Redaktion',
      subtitle: 'Arbeitsanleitung für Kolleg:innen im BVDW AI Tech Lab — Edit-Mode, Historie, Versions-Rollback und Bild-Pflege.',
      docNumber: 'Redaktionelle Übergabe · Dokument 02',
      date: dateDE
    }
  );

  console.log('\n✓ Beide PDFs gerendert.');
  console.log('  → HANDOVER_BVDW.pdf (technische Übergabe)');
  console.log('  → HANDOVER.pdf (redaktionelle Anleitung)');
}

main().catch(err => {
  console.error('\n✗ Fehler:', err.message || err);
  process.exit(1);
});
