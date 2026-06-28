/* eslint-disable */
// One-off asset generator for ReadFlow (paper/Reflow theme).
// Renders the brand "spine" mark to PNGs with sharp.
//   node gen-assets.js
// sharp is resolved from the backend's node_modules.
//
// DISABLED: OLD generator. Shipped icons come from the provided package via
// backend/render-icons-master.js. Running this would clobber the correct assets.
// Set ICON_FORCE=1 to override (NOT recommended).
if (process.env.ICON_FORCE !== "1") {
  console.error(
    "gen-assets.js is DISABLED (it overwrites the shipped icons). " +
      "Use backend/render-icons-master.js. Set ICON_FORCE=1 to override."
  );
  process.exit(1);
}
const path = require("path");
const fs = require("fs");
const sharp = require(path.join(__dirname, "..", "backend", "node_modules", "sharp"));

const OUT = path.join(__dirname, "assets");
fs.mkdirSync(OUT, { recursive: true });

const INK = "#20180F";
const ACCENT = "#E5533A";
const CREAM = "#EBDFC6";
const MUTED = "#86806F";
const PAPER = "#F4ECD6";

// The reading "page": an accent spine bar + cream text lines.
// cx is the canvas centre; scale lets us size it for full-bleed vs. safe-zone.
function pageMark(cx, scale) {
  const barX = cx - 255 * scale;
  const barW = 70 * scale;
  const barY = cx - 212 * scale;
  const barH = 424 * scale;
  const rxBar = 34 * scale;
  const lineX = cx - 125 * scale;
  const lineH = 48 * scale;
  const rxLine = 22 * scale;
  const gap = 90 * scale;
  const y0 = cx - 168 * scale;
  const lines = [
    { w: 380, c: CREAM },
    { w: 240, c: CREAM },
    { w: 330, c: CREAM },
    { w: 170, c: MUTED },
  ];
  let svg = `<rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="${rxBar}" fill="${ACCENT}"/>`;
  lines.forEach((ln, i) => {
    const y = y0 + i * gap;
    svg += `<rect x="${lineX}" y="${y}" width="${ln.w * scale}" height="${lineH}" rx="${rxLine}" fill="${ln.c}"/>`;
  });
  return svg;
}

function svgIcon(size, { bg, tile }) {
  const c = size / 2;
  let body = "";
  if (bg) body += `<rect width="${size}" height="${size}" fill="${bg}"/>`;
  if (tile) {
    const t = tile.size;
    const x = c - t / 2;
    body += `<rect x="${x}" y="${x}" width="${t}" height="${t}" rx="${t * 0.22}" fill="${INK}"/>`;
  }
  body += pageMark(c, size / 1024);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`
  );
}

async function render(name, svg) {
  await sharp(svg).png().toFile(path.join(OUT, name));
  console.log("  ✓", name);
}

(async () => {
  // Full-bleed app icon (iOS + Expo "icon"): dark page on ink.
  await render("icon.png", svgIcon(1024, { bg: INK }));

  // Android adaptive foreground: same mark, transparent (bg color set in app.json).
  await render("adaptive-icon.png", svgIcon(1024, { bg: null }));

  // Splash: centered dark tile with the mark, on paper.
  await render("splash.png", svgIcon(1024, { bg: PAPER, tile: { size: 660 } }));

  // Web favicon.
  await render("favicon.png", svgIcon(96, { bg: INK }));

  console.log("Done. Assets in", OUT);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
