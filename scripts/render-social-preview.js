// Rendert ein Social-Preview-Image (1280×640 PNG) für GitHub / Twitter / LinkedIn.
// Verwendung: npm run render-preview
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'assets/social');
const OUT_PNG = join(OUT_DIR, 'social-preview.png');
mkdirSync(OUT_DIR, { recursive: true });

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const logoPath = join(ROOT, 'assets/bvdw-logo/bvdw-white.png');
const logoB64 = existsSync(logoPath)
  ? `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`
  : null;

// HTML-Template für das Social-Preview-Image
const html = `<!doctype html>
<html lang="de"><head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1280px; height: 640px; overflow: hidden; font-family: -apple-system, "Inter", "Helvetica Neue", Arial, sans-serif; }
  .bg { width: 1280px; height: 640px; background: linear-gradient(135deg, #0045C3 0%, #002a78 100%); color: #fff; position: relative; overflow: hidden; }
  .bg::before {
    content: "";
    position: absolute;
    top: -200px; right: -200px;
    width: 700px; height: 700px;
    background: radial-gradient(circle, rgba(255,88,51,0.18) 0%, transparent 70%);
    pointer-events: none;
  }
  .bg::after {
    content: "";
    position: absolute;
    bottom: -300px; left: -150px;
    width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
    pointer-events: none;
  }
  .container { display: flex; height: 100%; position: relative; z-index: 2; }
  .left { flex: 1; padding: 80px; display: flex; flex-direction: column; justify-content: space-between; }
  .right { flex: 0 0 420px; padding: 60px 60px 60px 0; display: flex; align-items: center; justify-content: center; position: relative; }

  .brand-row { display: flex; align-items: center; gap: 18px; }
  .brand-row img { width: 64px; height: 64px; object-fit: contain; }
  .brand { font-size: 14px; letter-spacing: 4px; text-transform: uppercase; opacity: 0.85; font-weight: 600; }

  h1 { font-size: 82px; font-weight: 800; letter-spacing: -0.025em; line-height: 0.95; margin-top: 18px; }
  .subtitle { font-size: 24px; opacity: 0.88; margin-top: 24px; line-height: 1.35; max-width: 100%; font-weight: 400; }

  .footer { font-size: 15px; opacity: 0.65; letter-spacing: 0.04em; display: flex; justify-content: space-between; align-items: center; }
  .badge { padding: 6px 14px; background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.22); border-radius: 3px; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; font-weight: 700; }

  /* Stilisierte Quartett-Karten rechts */
  .deck { position: relative; width: 300px; height: 440px; }
  .card { position: absolute; width: 220px; height: 330px; background: rgba(255, 255, 255, 0.08); border: 1.5px solid rgba(255, 255, 255, 0.25); border-radius: 8px; backdrop-filter: blur(8px); padding: 18px; display: flex; flex-direction: column; }
  .card .cid { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; opacity: 0.7; font-family: Georgia, serif; }
  .card .cname { font-size: 18px; font-weight: 800; letter-spacing: -0.01em; line-height: 1.15; margin-top: 8px; }
  .card .cvendor { font-size: 11px; opacity: 0.7; margin-top: 4px; }
  .card .clogo { width: 56px; height: 56px; margin: 20px auto; border-radius: 4px; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 800; }
  .card .cstats { margin-top: auto; display: flex; flex-direction: column; gap: 3px; font-size: 10px; opacity: 0.85; }
  .card .crow { display: flex; justify-content: space-between; border-bottom: 1px dotted rgba(255,255,255,0.2); padding: 2px 0; }
  .card .crow:last-child { border-bottom: none; }
  .card.c1 { left: 0; top: 30px; transform: rotate(-8deg); }
  .card.c2 { left: 50px; top: 60px; transform: rotate(2deg); background: rgba(255, 88, 51, 0.12); border-color: rgba(255, 88, 51, 0.4); }
  .card.c3 { left: 80px; top: 90px; transform: rotate(8deg); }
</style>
</head><body>
<div class="bg">
  <div class="container">
    <div class="left">
      <div>
        <div class="brand-row">
          ${logoB64 ? `<img src="${logoB64}" alt="BVDW">` : ''}
          <div class="brand">BVDW · AI Tech Lab</div>
        </div>
        <h1>Foundation<br>Models<br>Atlas</h1>
        <div class="subtitle">148 AI-Modelle · Neutral kuratiert<br>Mit europäischer Souveränitätsperspektive</div>
      </div>
      <div class="footer">
        <span>github.com/macbosse/bvdw-foundation-models-atlas</span>
        <span class="badge">Open Source · MIT</span>
      </div>
    </div>
    <div class="right">
      <div class="deck">
        <div class="card c1">
          <div class="cid">FC · EU</div>
          <div class="cname">Mistral<br>Large 2</div>
          <div class="cvendor">Mistral AI</div>
          <div class="clogo">M</div>
          <div class="cstats">
            <div class="crow"><span>Context</span><span>128K</span></div>
            <div class="crow"><span>Deutsch</span><span>HIGH</span></div>
          </div>
        </div>
        <div class="card c2">
          <div class="cid">RG · DACH</div>
          <div class="cname">Pharia<br>1 LLM 7B</div>
          <div class="cvendor">Aleph Alpha</div>
          <div class="clogo">A</div>
          <div class="cstats">
            <div class="crow"><span>On-Prem</span><span>JA</span></div>
            <div class="crow"><span>Sov.</span><span>5/5</span></div>
          </div>
        </div>
        <div class="card c3">
          <div class="cid">FO · CN</div>
          <div class="cname">DeepSeek<br>V3</div>
          <div class="cvendor">DeepSeek AI</div>
          <div class="clogo">D</div>
          <div class="cstats">
            <div class="crow"><span>Context</span><span>128K</span></div>
            <div class="crow"><span>Open</span><span>weights</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</body></html>`;

const tmpHtml = join(OUT_DIR, '_preview.html');
writeFileSync(tmpHtml, html);

const cmd = [
  `"${CHROME}"`,
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--window-size=1280,640',
  `--screenshot="${OUT_PNG}"`,
  '--default-background-color=00000000',
  `"file://${tmpHtml}"`
].join(' ');

console.log('Rendering social preview image...');
execSync(cmd, { stdio: 'pipe', timeout: 30000 });
console.log(`✓ ${OUT_PNG}`);
console.log('\nNächster Schritt:');
console.log('  Öffne GitHub → Repo-Settings → Social preview → „Edit" → Datei hochladen');
console.log(`  Direktpfad: ${OUT_PNG}`);
