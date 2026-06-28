// Use the DESIGNER'S exact exported PNG (app-icon-rF-clean.png) as source of truth.
// No font re-rendering, no SVG re-draw — just the designer's own pixels.
//   icon.png          : the exact art, including transparent rounded corners
//   adaptive-icon.png : the same exact art for Android
//   splash.png        : same clean icon, for a consistent launch screen
//   favicon.png       : 64 downscale
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const SRC =
  "C:/Users/Greencom/Downloads/Icon cleanup request/uploads/PDF Reader App Design (1)/app-icon-rF-clean.png";
const OUT = path.resolve(__dirname, "../mobile/assets");
const CREAM = "#F4ECD6";
const S = 1024;

(async () => {
  const art = await loadImage(fs.readFileSync(SRC));
  const srcBytes = fs.readFileSync(SRC);

  // Scale only when a smaller derivative is needed.
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

  fs.writeFileSync(path.join(OUT, "icon.png"), srcBytes);
  console.log("wrote icon.png (1024, exact designer PNG)");

  fs.writeFileSync(path.join(OUT, "adaptive-icon.png"), srcBytes);
  console.log("wrote adaptive-icon.png (1024, exact designer PNG)");

  fs.writeFileSync(path.join(OUT, "splash.png"), srcBytes);
  console.log("wrote splash.png (1024, exact designer PNG)");

  fs.writeFileSync(path.join(OUT, "favicon.png"), composite(64, false).toBuffer("image/png"));
  console.log("wrote favicon.png (64)");

  console.log("DONE — used designer PNG verbatim");
})();
