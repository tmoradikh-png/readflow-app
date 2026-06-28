// Generate app icons from the designer's CLEAN source (app-icon-rF-clean.png).
// icon.png and splash.png preserve the approved PNG byte-for-byte.
// adaptive-icon.png must be different: Android treats it as a foreground layer
// and crops anything outside the adaptive safe zone, so the full artwork is
// scaled/inset there to keep the red spine and the right side of F visible.
const path = require("path");
const fs = require("fs");
const sharp = require(path.join(__dirname, "..", "backend", "node_modules", "sharp"));

const SRC =
  "C:/Users/Greencom/Downloads/Icon cleanup request/uploads/PDF Reader App Design (1)/app-icon-rF-clean.png";
const OUT = path.join(__dirname, "assets");
const S = 1024;
const ADAPTIVE_SCALE = 0.66;

(async () => {
  const srcBytes = fs.readFileSync(SRC);
  const adaptiveSize = Math.round(S * ADAPTIVE_SCALE);
  const adaptiveOffset = Math.round((S - adaptiveSize) / 2);
  const adaptiveArt = await sharp(srcBytes)
    .resize(adaptiveSize, adaptiveSize, { fit: "fill" })
    .png()
    .toBuffer();
  const adaptive = await sharp({
    create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: adaptiveArt, left: adaptiveOffset, top: adaptiveOffset }])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(OUT, "icon.png"), srcBytes);
  fs.writeFileSync(path.join(OUT, "adaptive-icon.png"), adaptive);
  fs.writeFileSync(path.join(OUT, "splash.png"), srcBytes);
  await sharp(srcBytes).resize(96, 96).png().toFile(path.join(OUT, "favicon.png"));
  console.log(
    "wrote icon.png, splash.png, favicon.png + adaptive-icon.png",
    `(scale ${ADAPTIVE_SCALE}, inset ${adaptiveOffset}px)`
  );
  console.log("done.");
})();
