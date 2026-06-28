// Use the DESIGNER'S exact exported PNG (app-icon-rF.png) as source of truth.
// No font re-rendering, no SVG re-draw — just the designer's own pixels.
//   icon.png          : the exact art, on a cream full-bleed 1024 square
//                       (fills the baked transparent corners with cream so iOS/Play
//                        mask it cleanly; the art itself is untouched & centered)
//   adaptive-icon.png : same cream full-bleed 1024 (Android masks it to squircle)
//   favicon.png       : 64 downscale
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const SRC = "C:/Users/Greencom/Downloads/PDF Reader App Design (1)/assets/app-icon-rF.png";
const OUT = path.resolve(__dirname, "../mobile/assets");
const CREAM = "#F4ECD6";
const S = 1024;

(async () => {
  const art = await loadImage(fs.readFileSync(SRC));
  // scale the designer art to fill the full 1024 square (it's a square source)
  function composite(size, withCream) {
    const c = createCanvas(size, size);
    const ctx = c.getContext("2d");
    if (withCream) {
      ctx.fillStyle = CREAM;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(art, 0, 0, size, size);
    return c;
  }

  fs.writeFileSync(path.join(OUT, "icon.png"), composite(S, true).toBuffer("image/png"));
  console.log("wrote icon.png (1024, cream full-bleed, designer art)");

  fs.writeFileSync(path.join(OUT, "adaptive-icon.png"), composite(S, true).toBuffer("image/png"));
  console.log("wrote adaptive-icon.png (1024, cream full-bleed)");

  fs.writeFileSync(path.join(OUT, "favicon.png"), composite(64, true).toBuffer("image/png"));
  console.log("wrote favicon.png (64)");

  console.log("DONE — used designer PNG verbatim");
})();
