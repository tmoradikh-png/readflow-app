const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const revision = '87416418657359cb625c412a48b6e1d6d41c29bd';
const languages = ['eng', 'spa', 'fra', 'deu', 'ita', 'por', 'nld', 'swe', 'nor', 'dan', 'fin', 'tur', 'ind', 'vie', 'jpn', 'kor', 'chi_sim', 'hin', 'rus', 'ara', 'fas', 'tha'];
const dir = path.resolve(__dirname, '../native/readflow-offline/assets/tessdata');
const manifestPath = path.join(dir, 'manifest.json');
const digest = (data) => crypto.createHash('sha256').update(data).digest('hex');

async function main() {
  fs.mkdirSync(dir, { recursive: true });
  const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null;
  const manifest = { repository: 'https://github.com/tesseract-ocr/tessdata_fast', revision, files: {} };
  for (const name of [...languages.map((lang) => `${lang}.traineddata`), 'LICENSE']) {
    const target = path.join(dir, name);
    const known = previous?.revision === revision && previous.files[name];
    if (known && fs.existsSync(target) && digest(fs.readFileSync(target)) === known.sha256) {
      manifest.files[name] = known;
      continue;
    }
    if (process.argv.includes('--check')) throw new Error(`Missing or changed OCR asset: ${name}`);
    const response = await fetch(`https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/${revision}/${name}`, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`Download failed (${response.status}): ${name}`);
    const data = Buffer.from(await response.arrayBuffer());
    if (name.endsWith('.traineddata') && data.length < 10000) throw new Error(`Invalid OCR data: ${name}`);
    fs.writeFileSync(target + '.part', data);
    fs.renameSync(target + '.part', target);
    manifest.files[name] = { bytes: data.length, sha256: digest(data) };
    console.log(`Prepared ${name}: ${data.length} bytes`);
  }
  if (!process.argv.includes('--check')) fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Offline OCR assets verified: ${languages.length} languages`);
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
