"""Generate ReadFlow app icons: an "rF" lettermark (reMarkable rM style) in brand colors.

Brand colors:
  accent  = #E5533A (warm red-orange)
  cream   = #F4ECD6 (paper background)
  espresso= #20180F (near-black)

Outputs (overwrites): assets/icon.png, assets/adaptive-icon.png, assets/splash.png, assets/favicon.png

DISABLED: This is the OLD generator. The shipped icons are rendered from the
provided package via backend/render-icons-master.js. Running this would clobber
the correct assets. Set ICON_FORCE=1 to override (NOT recommended).
"""
import os
if os.environ.get("ICON_FORCE") != "1":
    raise SystemExit(
        "make_icon.py is DISABLED (it overwrites the shipped icons). "
        "Use backend/render-icons-master.js. Set ICON_FORCE=1 to override."
    )
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(HERE, "assets")
FONT = os.path.join(
    HERE, "node_modules", "@expo-google-fonts", "spectral", "700Bold", "Spectral_700Bold.ttf"
)

ACCENT = (229, 83, 58, 255)
CREAM = (244, 236, 214, 255)
ESPRESSO = (32, 24, 15, 255)


def rounded(size, radius, color):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=color)
    return img


def draw_mark(img, text, color, box, weight_font, shift_y=0.0):
    """Center `text` within `box` (x0,y0,x1,y1) using the largest font that fits."""
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    d = ImageDraw.Draw(img)
    fs = int(bh)
    while fs > 8:
        f = ImageFont.truetype(weight_font, fs)
        l, t, r, b = d.textbbox((0, 0), text, font=f)
        if (r - l) <= bw and (b - t) <= bh:
            break
        fs -= 4
    f = ImageFont.truetype(weight_font, fs)
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    tw, th = r - l, b - t
    cx = x0 + (bw - tw) / 2 - l
    cy = y0 + (bh - th) / 2 - t + shift_y * bh
    d.text((cx, cy), text, font=f, fill=color)


def make_icon():
    S = 1024
    img = rounded(S, int(S * 0.22), ACCENT)
    # Letters occupy the central ~62% so they read clearly even when masked.
    pad = int(S * 0.19)
    draw_mark(img, "rF", CREAM, (pad, pad, S - pad, S - pad), FONT, shift_y=-0.02)
    img.save(os.path.join(ASSETS, "icon.png"))
    return img


def make_adaptive():
    # Foreground only; Android composites it over the adaptive backgroundColor.
    S = 1024
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    # Keep the mark within the 66% safe zone so launchers never crop it.
    pad = int(S * 0.30)
    draw_mark(img, "rF", CREAM, (pad, pad, S - pad, S - pad), FONT, shift_y=-0.02)
    img.save(os.path.join(ASSETS, "adaptive-icon.png"))


def make_splash():
    S = 1024
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))  # transparent; splash bg set in app.json
    pad = int(S * 0.34)
    draw_mark(img, "rF", ACCENT, (pad, pad, S - pad, S - pad), FONT, shift_y=-0.02)
    img.save(os.path.join(ASSETS, "splash.png"))


def make_favicon():
    icon = Image.open(os.path.join(ASSETS, "icon.png")).convert("RGBA")
    icon.resize((96, 96), Image.LANCZOS).save(os.path.join(ASSETS, "favicon.png"))


if __name__ == "__main__":
    make_icon()
    make_adaptive()
    make_splash()
    make_favicon()
    print("Icons generated:", os.listdir(ASSETS))
