const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '../..');
const generated = path.join(root, 'mobile/src/services/offline');
const ocrNames = new Set([
  'SUPPORTED_OCR_LANGS', 'resolveOcrLang', 'needsOcr', 'looksCorrupted',
  'shouldTreatEmbeddedLatinAsCorrupt', 'countLatinStuckToScript',
  'scriptRangeForLang', 'scriptProfile', 'tidy', 'normalizeOcrText',
  'cleanOcrLine', 'repairLatinOcrWordBreaks', 'isMostlyLatinLine',
  'NON_LATIN_SCRIPT_RANGES', 'COMMON_LATIN_OCR_JOIN_WORDS', 'joinKnownWord',
]);
const pdfExclude = new Set(['pdfParse', 'extractPdf', 'importPdfJs', 'detectRasterImagePages']);
for (const [sourceName, outputName] of [['pdfExtract', 'PdfLayout'], ['ocrExtract', 'OcrText']]) {
  const source = fs.readFileSync(path.join(root, `backend/src/services/${sourceName}.ts`), 'utf8');
  const ast = ts.createSourceFile(`${sourceName}.ts`, source, ts.ScriptTarget.Latest, true);
  const selected = ast.statements.filter(node => {
    if (ts.isImportDeclaration(node)) return false;
    const names = ts.isVariableStatement(node)
      ? node.declarationList.declarations.map(d => d.name.getText(ast))
      : node.name ? [node.name.text] : [];
    return names.length && (sourceName === 'pdfExtract'
      ? names.every(name => !pdfExclude.has(name))
      : names.every(name => ocrNames.has(name)));
  }).map(node => node.getText(ast));
  let output = '// Generated from the existing backend text rules by scripts/sync-offline-text.cjs.\n';
  if (sourceName === 'ocrExtract') output += 'const OCR_LANG = "eng";\n';
  output += selected.join('\n\n') + '\n';
  if (sourceName === 'ocrExtract') output += '\nexport { normalizeOcrText };\n';
  const destination = path.join(generated, `${outputName}.ts`);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8') !== output) {
      throw new Error(`${outputName} is out of sync with the regression-tested text rules`);
    }
  } else {
    fs.mkdirSync(generated, { recursive: true });
    fs.writeFileSync(destination, output);
  }
}
