// Verifies the SHIPPED assets match the provided master/foreground spec,
// and simulates the Android adaptive mask (circle + squircle) so we see the
// real launcher result BEFORE building.
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const ASSETS = path.resolve(__dirname, "../mobile/assets");
const OUT = path.resolve(__dirname, "_icon_verify");
fs.mkdirSync(OUT, { recursive: true });

const CREAM = [244, 236, 214]; // #F4ECD6
const RED = [229, 83, 58]; // #E5533A
const INK = [30, 24, 18]; // #1E1812

async function load(file) {
  const img = await loadImage(fs.readFileSync(file));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  return { c, ctx, w: img.width, h: img.height };
}

function near(px, rgb, tol = 14) {
  return (
    Math.abs(px[0] - rgb[0]) <= tol &&
    Math.abs(px[1] - rgb[1]) <= tol &&
    Math.abs(px[2] - rgb[2]) <= tol
  );
}
function label(px) {
  if (px[3] === 0) return "transparent";
  if (near(px, CREAM)) return "CREAM";
  if (near(px, RED)) return "RED-spine";
  if (near(px, INK)) return "INK-glyph";
  return `other(${px[0]},${px[1]},${px[2]},a${px[3]})`;
}

async function main() {
// ---------- 1) icon.png pixel assertions (from app-icon-master.svg) ----------
const icon = await load(path.join(ASSETS, "icon.png"));
const ip = (x, y) => icon.ctx.getImageData(x, y, 1, 1).data;
console.log("=== icon.png (master) " + icon.w + "x" + icon.h + " ===");
const iconChecks = [
  ["corner 10,10 -> RED (spine flush to left edge)", ip(10, 10), "RED-spine"],
  ["spine 60,512 -> RED (x0..120)", ip(60, 512), "RED-spine"],
  ["field 400,512 -> CREAM (right of seam)", ip(400, 512), "CREAM"],
  ["top-right corner 1014,10 -> CREAM", ip(1014, 10), "CREAM"],
];
let allPass = true;
for (const [desc, px, want] of iconChecks) {
  const got = label(px);
  const ok = got === want;
  allPass = allPass && ok;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${desc}  => ${got}`);
}
// scan: is there INK (glyph) ink to the right of the spine?
let inkCount = 0;
const big = icon.ctx.getImageData(0, 0, icon.w, icon.h).data;
for (let i = 0; i < big.length; i += 4) {
  if (near([big[i], big[i + 1], big[i + 2]], INK)) inkCount++;
}
console.log(`  glyph ink pixels (rF): ${inkCount} (should be > 20000)`);
allPass = allPass && inkCount > 20000;

// ---------- 2) adaptive-icon.png transparency + safe-zone ----------
const adp = await load(path.join(ASSETS, "adaptive-icon.png"));
const ap = (x, y) => adp.ctx.getImageData(x, y, 1, 1).data;
console.log("\n=== adaptive-icon.png (foreground) " + adp.w + "x" + adp.h + " ===");
const adpChecks = [
  ["corner 4,4 -> RED (spine bleeds to corner)", ap(4, 4), "RED-spine"],
  ["spine 60,512 -> RED (bleeds to edge)", ap(60, 512), "RED-spine"],
  ["far-right field 960,512 -> CREAM", ap(960, 512), "CREAM"],
];
for (const [desc, px, want] of adpChecks) {
  const got = label(px);
  const ok = got === want;
  allPass = allPass && ok;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${desc}  => ${got}`);
}

// safe-zone bbox of non-transparent art -> must sit within center ~66% (x175..849)
let minX = adp.w, minY = adp.h, maxX = 0, maxY = 0;
const adata = adp.ctx.getImageData(0, 0, adp.w, adp.h).data;
for (let y = 0; y < adp.h; y++) {
  for (let x = 0; x < adp.w; x++) {
    const a = adata[(y * adp.w + x) * 4 + 3];
    if (a > 8) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
console.log(`  art bbox: x[${minX}..${maxX}] y[${minY}..${maxY}]`);
const safe = minX >= 150 && maxX <= 874 && minY >= 150 && maxY <= 874;
console.log(`  ${safe ? "PASS" : "WARN"}  art inside safe zone (~x150..874)`);

// ---------- 3) simulate Android launcher masks (what the phone shows) ----------
function compositeOnCream(fg) {
  const c = createCanvas(fg.w, fg.h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#F4ECD6"; // adaptiveIcon.backgroundColor
  ctx.fillRect(0, 0, fg.w, fg.h);
  ctx.drawImage(fg.c, 0, 0); // reuse the already-decoded foreground canvas
  return c;
}
function maskAndSave(name, shape) {
  const base = compositeOnCream(adp);
  const c = createCanvas(adp.w, adp.h);
  const ctx = c.getContext("2d");
  const r = adp.w / 2;
  ctx.beginPath();
  if (shape === "circle") {
    ctx.arc(r, r, r, 0, Math.PI * 2);
  } else {
    // squircle-ish rounded square (Android "rounded" mask), 22% radius
    const rad = adp.w * 0.22;
    const x = 0, y = 0, w = adp.w, h = adp.h;
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
  }
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(base, 0, 0);
  fs.writeFileSync(path.join(OUT, name), c.toBuffer("image/png"));
  console.log("  wrote launcher preview:", name);
}
console.log("\n=== Android launcher mask previews ===");
maskAndSave("launcher_circle.png", "circle");
maskAndSave("launcher_squircle.png", "squircle");

console.log("\n================ RESULT:", allPass ? "ALL PIXEL CHECKS PASS" : "FAILURES ABOVE", "================");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
