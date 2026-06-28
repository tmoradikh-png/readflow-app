// Faithful renderer for the PROVIDED icon package (app-icon-master.svg / app-icon-foreground.svg).
// Bakes the Spectral 600 font into PNGs so Android/EAS never has to render live SVG text.
// Geometry is copied 1:1 from the provided SVGs:
//   bg rect: full-bleed #F4ECD6 (master only; foreground is transparent)
//   spine:   x=338 y=324 w=46 h=376 rx=6  fill #E5533A
//   text:    x=430 y=512 font-size=430 letter-spacing=-16 anchor=start baseline=central
//            ink #1E1812, "r" (roman SemiBold) + "F" (italic SemiBold)
const path = require("path");
const fs = require("fs");
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");

const CREAM = "#F4ECD6";
const RED = "#E5533A";
const INK = "#1E1812";
const S = 1024;

// --- register the exact fonts the design specifies (Spectral 600 SemiBold roman + italic) ---
const SPECTRAL_DIR = path.resolve(
  __dirname,
  "../mobile/node_modules/@expo-google-fonts/spectral"
);
const ROMAN = path.join(SPECTRAL_DIR, "600SemiBold/Spectral_600SemiBold.ttf");
const ITALIC = path.join(
  SPECTRAL_DIR,
  "600SemiBold_Italic/Spectral_600SemiBold_Italic.ttf"
);
for (const f of [ROMAN, ITALIC]) {
  if (!fs.existsSync(f)) {
    console.error("MISSING FONT:", f);
    process.exit(1);
  }
}
GlobalFonts.registerFromPath(ROMAN, "SpectralSB");
GlobalFonts.registerFromPath(ITALIC, "SpectralSBItalic");

// rounded rect helper (matches rx=6 on the spine)
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawArtwork(ctx, withCream) {
  if (withCream) {
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, S, S);
  }

  // spine — exact rect from the SVG
  ctx.fillStyle = RED;
  roundRect(ctx, 338, 324, 46, 376, 6);
  ctx.fill();

  // monogram — "r" roman + "F" italic, font-size 430, letter-spacing -16
  const FS = 430;
  const LS = -16; // letter-spacing
  const xStart = 430; // text-anchor=start -> left edge
  const yMid = 512; // dominant-baseline=central
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  // glyph 1: "r" (roman)
  ctx.font = `${FS}px SpectralSB`;
  const wR = ctx.measureText("r").width;
  ctx.fillText("r", xStart, yMid);

  // advance by glyph width + letter-spacing, then glyph 2: "F" (italic)
  const xF = xStart + wR + LS;
  ctx.font = `${FS}px SpectralSBItalic`;
  ctx.fillText("F", xF, yMid);
}

function renderPng(file, withCream) {
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, S, S); // transparent base
  drawArtwork(ctx, withCream);
  fs.writeFileSync(file, canvas.toBuffer("image/png"));
  console.log("wrote", file);
}

function renderFavicon(srcMasterCanvasFile, outFile) {
  // downscale the master to 64x64
  const big = createCanvas(S, S);
  const bctx = big.getContext("2d");
  drawArtwork(bctx, true);
  const fav = createCanvas(64, 64);
  const fctx = fav.getContext("2d");
  fctx.drawImage(big, 0, 0, 64, 64);
  fs.writeFileSync(outFile, fav.toBuffer("image/png"));
  console.log("wrote", outFile);
}

const ASSETS = path.resolve(__dirname, "../mobile/assets");
const PREVIEW = path.resolve(__dirname, "_icon_preview");
fs.mkdirSync(PREVIEW, { recursive: true });

// icon.png  <- app-icon-master.svg (full-bleed cream)
renderPng(path.join(ASSETS, "icon.png"), true);
renderPng(path.join(PREVIEW, "icon.png"), true);

// adaptive-icon.png <- app-icon-foreground.svg (transparent)
renderPng(path.join(ASSETS, "adaptive-icon.png"), false);
renderPng(path.join(PREVIEW, "adaptive-icon.png"), false);

// favicon.png (optional)
renderFavicon(null, path.join(ASSETS, "favicon.png"));

// a cream-backed preview of the adaptive foreground so we can SEE it against #F4ECD6
{
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, S, S);
  drawArtwork(ctx, false);
  fs.writeFileSync(
    path.join(PREVIEW, "adaptive-on-cream.png"),
    canvas.toBuffer("image/png")
  );
  console.log("wrote preview adaptive-on-cream.png");
}

console.log("DONE");
