const QR = require("qrcode-terminal/vendor/QRCode");
const QRErrorCorrectLevel = require("qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel");
const fs = require("fs");

const url = process.argv[2] || "exp://192.168.38.209:8082";
const m = new QR(-1, QRErrorCorrectLevel.L);
m.addData(url);
m.make();

const n = m.getModuleCount();
const s = 12; // px per module
const pad = 4; // quiet zone in modules
const size = (n + pad * 2) * s;

let rects = "";
for (let y = 0; y < n; y++) {
  for (let x = 0; x < n; x++) {
    if (m.isDark(y, x)) {
      rects += `<rect x="${(x + pad) * s}" y="${(y + pad) * s}" width="${s}" height="${s}"/>`;
    }
  }
}

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
  `<rect width="${size}" height="${size}" fill="#ffffff"/>` +
  `<g fill="#000000">${rects}</g>` +
  `</svg>`;

const html =
  `<!doctype html><html><head><meta charset="utf-8"><title>ReadFlow QR</title></head>` +
  `<body style="margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#0f1115;color:#e8eaed">` +
  `<h2>Scan with Expo Go</h2>${svg}` +
  `<p style="margin-top:16px">${url}</p>` +
  `</body></html>`;

fs.writeFileSync(__dirname + "/../qr.svg", svg);
fs.writeFileSync(__dirname + "/../qr.html", html);
console.log("QR written: ReadFlow/qr.html and ReadFlow/qr.svg  (" + n + "x" + n + " modules) for " + url);
