// Generate app icons from the designer's CLEAN source (app-icon-rF-clean.png).
// The 1024px app assets intentionally preserve that PNG byte-for-byte so the
// shipped icon stays exactly like the approved artwork. Only favicon is resized.
const path = require("path");
const fs = require("fs");
const sharp = require(path.join(__dirname, "..", "backend", "node_modules", "sharp"));

const SRC =
  "C:/Users/Greencom/Downloads/Icon cleanup request/uploads/PDF Reader App Design (1)/app-icon-rF-clean.png";
const OUT = path.join(__dirname, "assets");

(async () => {
  const srcBytes = fs.readFileSync(SRC);
  fs.writeFileSync(path.join(OUT, "icon.png"), srcBytes);
  fs.writeFileSync(path.join(OUT, "adaptive-icon.png"), srcBytes);
  fs.writeFileSync(path.join(OUT, "splash.png"), srcBytes);
  await sharp(srcBytes).resize(96, 96).png().toFile(path.join(OUT, "favicon.png"));
  console.log("wrote icon.png, adaptive-icon.png, splash.png + favicon.png");
  console.log("done.");
})();
