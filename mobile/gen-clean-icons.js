// Generate app icons from the designer's CLEAN source (app-icon-rF-clean.png).
// Two distinct outputs:
//   icon.png        — full-bleed square (iOS / Play / legacy, masked by the OS).
//                     Spine flush to the absolute left edge, corners filled so the
//                     OS squircle never reveals a transparent gap.
//   adaptive-icon.png — Android foreground. The whole mark is scaled DOWN into the
//                     adaptive safe zone (so the launcher doesn't crop the red
//                     book-spine off, the v1.0.12/13 bug) and a WIDE red spine is
//                     drawn flush-left so a healthy red bar survives the mask.
//                     Outside stays transparent; app.json adaptiveIcon.backgroundColor
//                     (#F4ECD6 cream) fills the rest.
const path = require("path");
const sharp = require(path.join(__dirname, "..", "backend", "node_modules", "sharp"));

const SRC =
  "C:/Users/Greencom/Downloads/Icon cleanup request/uploads/PDF Reader App Design (1)/app-icon-rF-clean.png";
const OUT = path.join(__dirname, "assets");
const S = 1024;
const CREAM = { r: 0xf4, g: 0xec, b: 0xd6, alpha: 1 };
const RED = { r: 0xe5, g: 0x53, b: 0x3a, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };
const SPINE_W = 120; // measured red spine width in the source @1024

async function makeIcon() {
  const redBar = await sharp({
    create: { width: SPINE_W + 6, height: S, channels: 4, background: RED },
  })
    .png()
    .toBuffer();
  const art = await sharp(SRC).resize(S, S, { fit: "fill" }).png().toBuffer();
  const out = await sharp({
    create: { width: S, height: S, channels: 4, background: CREAM },
  })
    .composite([
      { input: redBar, left: 0, top: 0 },
      { input: art, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
  await sharp(out).png().toFile(path.join(OUT, "icon.png"));
  await sharp(out).resize(96, 96).png().toFile(path.join(OUT, "favicon.png"));
  console.log("wrote icon.png + favicon.png");
}

async function makeAdaptive() {
  // Scale the WHOLE mark (red spine + cream body + rF, one cohesive tile) DOWN
  // into the adaptive safe zone and center it on a cream field. Because the spine
  // is no longer at the absolute edge, the launcher mask can't crop it off (the
  // v1.0.12/13 disappearing-spine bug) — and the smaller mark fixes "a bit zoomed
  // in". The art's rounded corners reveal the same cream, so it reads as a cream
  // icon with a red book-spine on the left + rF.
  const scale = 0.82;
  const aw = Math.round(S * scale);
  const off = Math.round((S - aw) / 2);
  const artScaled = await sharp(SRC).resize(aw, aw, { fit: "fill" }).png().toBuffer();
  const out = await sharp({
    create: { width: S, height: S, channels: 4, background: CREAM },
  })
    .composite([{ input: artScaled, left: off, top: off }])
    .png()
    .toBuffer();
  await sharp(out).png().toFile(path.join(OUT, "adaptive-icon.png"));
  console.log("wrote adaptive-icon.png (scale", scale, "inset", off, ")");
}

(async () => {
  await makeIcon();
  await makeAdaptive();
  console.log("done.");
})();
