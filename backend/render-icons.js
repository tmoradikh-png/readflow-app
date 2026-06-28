// One-off icon renderer for ReadFlow. Reproduces the BOLD master design
// (PDF Reader App Design / assets / app-icon-rF.svg) using @napi-rs/canvas +
// the real Spectral font, so the "rF" monogram is crisp and bold.
//
// Bold spec (from app-icon-rF.svg):
//   cream field #F4ECD6
//   spine  : rect x=0  w=120 full-height          fill #E5533A
//   seam   : rect x=120 w=14  full-height          #000 @ 0.05
//   monogram: "r" (roman) + "F" (italic) Spectral 600,
//             font-size 660, letter-spacing -26, centred at x=582 / y=512
//
// Outputs (to ../mobile/assets):
//   icon.png          1024 FULL-BLEED cream square (iOS / Play Store / legacy).
//                     No rounded corners — the OS adds its own mask.
//   adaptive-icon.png 1024 TRANSPARENT foreground for Android. The bold artwork
//                     (spine + monogram) is scaled into the adaptive SAFE ZONE
//                     (centre ~66%) so the launcher mask never clips the spine.
//                     Pair with backgroundColor #F4ECD6 in app.json.
//   favicon.png       64  (downscaled from the cream master)
//
// DISABLED: This is the OLD "rF" generator (app-icon-rF.svg, which the design
// README says NOT to ship). The shipped icons are rendered from the provided
// master/foreground package via render-icons-master.js. Running this would
// clobber the correct assets. Set ICON_FORCE=1 to override (NOT recommended).
if (process.env.ICON_FORCE !== "1") {
  console.error(
    "render-icons.js is DISABLED (old rF design, overwrites shipped icons). " +
      "Use render-icons-master.js. Set ICON_FORCE=1 to override."
  );
  process.exit(1);
}
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const fs = require("fs");
const path = require("path");

const FONT_DIR = path.resolve(__dirname, "../mobile/node_modules/@expo-google-fonts/spectral");
GlobalFonts.registerFromPath(path.join(FONT_DIR, "Spectral_600SemiBold.ttf"), "SpectralSB");
GlobalFonts.registerFromPath(
  path.join(FONT_DIR, "Spectral_600SemiBold_Italic.ttf"),
  "SpectralSBItalic"
);

const OUT = path.resolve(__dirname, "../mobile/assets");

const CREAM = "#F4ECD6";
const RED = "#E5533A";
const INK = "#1E1812";

const S = 1024;

// ---- exact spec from app-icon-rF.svg ----
const SPINE_W = 120;
const SEAM_W = 14;
// Full-bleed master monogram (icon.png / favicon).
const MONO = { cx: 582, cy: 512, size: 660, tracking: -26 };
// Adaptive foreground monogram: smaller + nudged toward true centre so the
// launcher's circular/squircle mask never clips it (safe zone = centre ~66%,
// i.e. x 174..850). The spine still bleeds full-height to the physical edge.
const MONO_ADAPTIVE = { cx: 548, cy: 512, size: 470, tracking: -18 };

/**
 * Paint the spine + seam + "rF" monogram into ctx (1024 coordinate space).
 * If withCream is true the cream field is filled first (full bleed).
 */
function paintArtwork(ctx, withCream, mono = MONO) {
  if (withCream) {
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, S, S);
  }

  // spine + seam — flush to the LEFT edge (bleeds; the OS mask rounds it)
  ctx.fillStyle = RED;
  ctx.fillRect(0, 0, SPINE_W, S);
  ctx.fillStyle = "rgba(0,0,0,0.05)";
  ctx.fillRect(SPINE_W, 0, SEAM_W, S);

  // monogram: r (roman) + F (italic), centred on cx
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  ctx.font = `${mono.size}px SpectralSB`;
  const rW = ctx.measureText("r").width;
  ctx.font = `italic ${mono.size}px SpectralSBItalic`;
  const fW = ctx.measureText("F").width;

  const total = rW + mono.tracking + fW;
  const startX = mono.cx - total / 2;

  ctx.font = `${mono.size}px SpectralSB`;
  ctx.fillText("r", startX, mono.cy);
  ctx.font = `italic ${mono.size}px SpectralSBItalic`;
  ctx.fillText("F", startX + rW + mono.tracking, mono.cy);
}

// ---- icon.png : full-bleed cream master (bold) ----
{
  const canvas = createCanvas(S, S);
  paintArtwork(canvas.getContext("2d"), true);
  fs.writeFileSync(path.join(OUT, "icon.png"), canvas.toBuffer("image/png"));
  console.log("wrote icon.png");
}

// ---- adaptive-icon.png : FULL-BLEED cream foreground (bold book look) ----
{
  // Full bleed so the red spine reaches the physical edge and the launcher mask
  // rounds it into a proper "book spine". The monogram is the smaller adaptive
  // size so it stays inside the masked safe zone.
  const canvas = createCanvas(S, S);
  paintArtwork(canvas.getContext("2d"), true, MONO_ADAPTIVE);
  fs.writeFileSync(path.join(OUT, "adaptive-icon.png"), canvas.toBuffer("image/png"));
  console.log("wrote adaptive-icon.png");
}

// ---- favicon.png : 64 downscaled from the cream master ----
{
  const f = 64;
  const big = createCanvas(S, S);
  paintArtwork(big.getContext("2d"), true);
  const canvas = createCanvas(f, f);
  canvas.getContext("2d").drawImage(big, 0, 0, f, f);
  fs.writeFileSync(path.join(OUT, "favicon.png"), canvas.toBuffer("image/png"));
  console.log("wrote favicon.png");
}

console.log("done");
