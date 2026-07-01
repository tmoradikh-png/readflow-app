from __future__ import annotations

import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "artifacts" / "play-store"
SOURCE_ICON = Path(
    "C:/Users/Greencom/Downloads/Icon cleanup request/uploads/"
    "PDF Reader App Design (1)/app-icon-rF-clean.png"
)
LIFESTYLE_SOURCE = ROOT / "pic" / "result.jpg"
NANO_READING_PATTERN = "Nano Banana 2 - put this picture on the guys phone display so that it looks like he is reading this_1.png"

CREAM = "#fbf7e9"
PAPER = "#fffdf6"
INK = "#1f1a14"
MUTED = "#6d675f"
LINE = "#e5ded0"
ACCENT = "#d2623f"
GREEN = "#2f7f71"
GREEN_DARK = "#1f5e55"
BLUE = "#2f5d87"
GOLD = "#b98235"


def font(size: int, bold: bool = False, serif: bool = False) -> ImageFont.FreeTypeFont:
    if serif:
        names = ["georgiab.ttf" if bold else "georgia.ttf", "timesbd.ttf" if bold else "times.ttf"]
    else:
        names = ["segoeuib.ttf" if bold else "segoeui.ttf", "arialbd.ttf" if bold else "arial.ttf"]
    for name in names:
        p = Path("C:/Windows/Fonts") / name
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


F = {
    "hero": font(58, True, True),
    "h1": font(52, True, True),
    "h2": font(40, True),
    "h3": font(30, True),
    "body": font(25),
    "body_bold": font(25, True),
    "small": font(20),
    "tiny": font(17),
    "logo": font(42, True, True),
}


def rounded(draw: ImageDraw.ImageDraw, box, radius=26, fill=PAPER, outline=None, width=2):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text(draw: ImageDraw.ImageDraw, xy, value, fnt, fill=INK, max_width=None, line_gap=6):
    x, y = xy
    if not max_width:
        draw.text((x, y), value, font=fnt, fill=fill)
        return y + draw.textbbox((x, y), value, font=fnt)[3] - y

    words = value.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textlength(candidate, font=fnt) <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)

    for line in lines:
        draw.text((x, y), line, font=fnt, fill=fill)
        bbox = draw.textbbox((x, y), line, font=fnt)
        y = bbox[3] + line_gap
    return y


def center_text(draw, box, value, fnt, fill=INK):
    x1, y1, x2, y2 = box
    bbox = draw.textbbox((0, 0), value, font=fnt)
    draw.text((x1 + (x2 - x1 - (bbox[2] - bbox[0])) / 2, y1 + (y2 - y1 - (bbox[3] - bbox[1])) / 2), value, font=fnt, fill=fill)


def icon(size: int) -> Image.Image:
    src = SOURCE_ICON if SOURCE_ICON.exists() else OUT / "app-icon-512.png"
    im = Image.open(src).convert("RGBA")
    return im.resize((size, size), Image.Resampling.LANCZOS)


def nano_reading_source() -> Path | None:
    exact = ROOT / "pic" / NANO_READING_PATTERN
    if exact.exists():
        return exact
    asset_source = OUT / "source-real-reading-nano.png"
    if asset_source.exists():
        return asset_source
    matches = sorted((ROOT / "pic").glob("*this_1.png"))
    return matches[0] if matches else None


def perspective_coeffs(output_points, input_points):
    import numpy as np

    matrix = []
    for (x_out, y_out), (x_in, y_in) in zip(output_points, input_points):
        matrix.append([x_out, y_out, 1, 0, 0, 0, -x_in * x_out, -x_in * y_out])
        matrix.append([0, 0, 0, x_out, y_out, 1, -y_in * x_out, -y_in * y_out])
    a = np.asarray(matrix, dtype=float)
    b = np.asarray(input_points, dtype=float).reshape(8)
    return np.linalg.lstsq(a, b, rcond=None)[0]


def embedded_phone_screen() -> Image.Image:
    w, h = 360, 690
    im = Image.new("RGB", (w, h), CREAM)
    draw = ImageDraw.Draw(im)
    draw.rectangle((0, 0, w, 60), fill=PAPER)
    draw.text((18, 14), "readFlow", font=font(22, True), fill=INK)
    draw.text((18, 78), "Chapter 1", font=font(34, True, True), fill=INK)
    draw.text((20, 124), "Page 6 of 288", font=font(18), fill=MUTED)
    y = 170
    lines = [
        "Dawn breaks over",
        "South-Central Ramadi.",
        "",
        "The fixed PDF page",
        "becomes comfortable",
        "flowing text on",
        "your phone.",
    ]
    for line in lines:
        if line == "becomes comfortable":
            draw.rounded_rectangle((14, y - 4, w - 14, y + 32), radius=10, fill="#fde8df")
        draw.text((22, y), line, font=font(22), fill=INK)
        y += 36
    draw.rounded_rectangle((18, 505, w - 18, 575), radius=20, fill=ACCENT)
    center_text(draw, (18, 505, w - 18, 575), "Listen", font(27, True), "white")
    draw.rounded_rectangle((w - 80, 422, w - 18, 478), radius=16, fill=ACCENT)
    center_text(draw, (w - 80, 422, w - 18, 478), "AI", font(22, True), "white")
    return im


def product_phone(width: int = 300, height: int = 610) -> Image.Image:
    im = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    shadow = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((10, 10, width - 8, height - 6), radius=42, fill=(0, 0, 0, 80))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    im.alpha_composite(shadow, (0, 0))
    draw.rounded_rectangle((18, 4, width - 18, height - 18), radius=38, fill="#17130f")
    draw.rounded_rectangle((31, 18, width - 31, height - 34), radius=28, fill=CREAM)
    draw.rounded_rectangle((width // 2 - 34, 27, width // 2 + 34, 39), radius=6, fill="#17130f")

    sx, sy = 48, 56
    draw.text((sx, sy), "readFlow", font=font(22, True), fill=INK)
    draw.text((sx, sy + 58), "Ask AI", font=font(36, True, True), fill=ACCENT)
    draw.text((sx, sy + 108), "Chapter 2", font=font(22, True), fill=INK)
    y = sy + 154
    for line in ["The PDF page becomes", "comfortable flowing text.", "Listen aloud, highlight", "lines, and ask AI."]:
        draw.text((sx, y), line, font=font(19), fill=INK)
        y += 33
    draw.rounded_rectangle((sx - 6, y + 8, width - sx, y + 112), radius=16, fill="#f4efe3", outline=LINE)
    draw.text((sx + 12, y + 28), "AI summary", font=font(20, True), fill=INK)
    draw.text((sx + 12, y + 62), "Key ideas appear here.", font=font(17), fill=MUTED)
    draw.rounded_rectangle((sx - 6, height - 128, width - sx, height - 70), radius=18, fill=ACCENT)
    center_text(draw, (sx - 6, height - 128, width - sx, height - 70), "Listen", font(23, True), "white")
    return im


def lifestyle_with_mockup(caption: bool = True, save: bool = True) -> Image.Image | None:
    if not LIFESTYLE_SOURCE.exists():
        return None
    base = Image.open(LIFESTYLE_SOURCE).convert("RGBA")
    # Keep the original photo natural; the clear product screen is a foreground
    # mockup, because the real phone screen in the photo is too small and angled
    # for a credible replacement.
    wash = Image.new("RGBA", base.size, (251, 247, 233, 18))
    base = Image.alpha_composite(base, wash)

    phone = product_phone(305, 610).rotate(-7, expand=True, resample=Image.Resampling.BICUBIC)
    base.alpha_composite(phone, (500, 535))
    if caption:
        gradient = Image.new("RGBA", base.size, (0, 0, 0, 0))
        pixels = gradient.load()
        start = int(base.height * 0.68)
        for y in range(start, base.height):
            alpha = int(105 * (y - start) / max(1, base.height - start))
            for x in range(base.width):
                pixels[x, y] = (0, 0, 0, alpha)
        base = Image.alpha_composite(base, gradient)
        draw = ImageDraw.Draw(base)
        draw.rounded_rectangle((46, 1010, 690, 1190), radius=28, fill=(31, 26, 20, 218))
        draw.text((82, 1045), "PDF reader with AI", font=F["h2"], fill="white")
        draw.text((84, 1108), "Reflow PDFs. Listen aloud. Ask AI as you read.", font=F["body"], fill="#f7efe1")
    out = base.convert("RGB")
    if save:
        out.save(OUT / "lifestyle-readflow-mockup.jpg", quality=92)
    return out


def lifestyle_real_reader() -> Image.Image | None:
    source = nano_reading_source()
    if not source:
        return None
    out = Image.open(source).convert("RGB")
    source_copy = OUT / "source-real-reading-nano.png"
    if source.resolve() != source_copy.resolve():
        out.save(source_copy)
    out.save(OUT / "lifestyle-readflow-screen.jpg", quality=94)
    phone = out.copy()
    target_ratio = 1080 / 1920
    w, h = phone.size
    current_ratio = w / h
    if current_ratio > target_ratio:
        new_w = int(h * target_ratio)
        left = (w - new_w) // 2
        phone = phone.crop((left, 0, left + new_w, h))
    else:
        new_h = int(w / target_ratio)
        top = (h - new_h) // 2
        phone = phone.crop((0, top, w, top + new_h))
    phone = phone.resize((1080, 1920), Image.Resampling.LANCZOS)
    phone.save(OUT / "phone-00-real-reading.png")
    return out


def replace_lifestyle_phone_screen() -> Image.Image | None:
    if not LIFESTYLE_SOURCE.exists():
        return None
    base = Image.open(LIFESTYLE_SOURCE).convert("RGB")
    screen = embedded_phone_screen()
    # Visible screen corners in the source photo, clockwise from the phone
    # screen's top-left/top-right/bottom-right/bottom-left. These points stay
    # inside the real handset so the app looks like it is on the actual phone.
    dst = [(694, 817), (757, 846), (699, 930), (638, 905)]
    src = [(0, 0), (screen.width, 0), (screen.width, screen.height), (0, screen.height)]
    coeffs = perspective_coeffs(dst, src)
    warped = screen.transform(base.size, Image.Transform.PERSPECTIVE, coeffs, Image.Resampling.BICUBIC)
    mask_src = Image.new("L", screen.size, 255)
    mask = mask_src.transform(base.size, Image.Transform.PERSPECTIVE, coeffs, Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(0.8))
    out = Image.composite(warped, base, mask)
    out.save(OUT / "lifestyle-readflow-screen.jpg", quality=92)
    return out


def draw_status(draw, w):
    draw.text((52, 42), "09:41", font=F["small"], fill=INK)
    draw.text((w - 210, 42), "5G  96%", font=F["small"], fill=INK)


def draw_brand(draw, im):
    mark = icon(72)
    im.paste(mark, (52, 90), mark)
    draw.text((138, 106), "readFlow", font=F["body_bold"], fill=INK)


def chip(draw, x, y, label, fill="#f4efe3", outline=LINE, color=INK, pad_x=20):
    tw = draw.textlength(label, font=F["small"])
    box = (x, y, x + tw + pad_x * 2, y + 48)
    rounded(draw, box, radius=18, fill=fill, outline=outline, width=2)
    center_text(draw, box, label, F["small"], color)
    return box[2] + 12


def mini_reader(draw, x, y, w, h, ai=True):
    rounded(draw, (x, y, x + w, y + h), radius=30, fill=PAPER, outline=LINE)
    draw.text((x + 34, y + 30), "Chapter 2", font=F["h3"], fill=INK)
    draw.text((x + 34, y + 72), "Page 48 of 312", font=F["small"], fill=MUTED)
    yy = y + 130
    sample = [
        "The fixed PDF page becomes",
        "comfortable flowing text.",
        "You can read, listen, and ask",
        "AI without leaving the book.",
    ]
    for i, line in enumerate(sample):
        if i == 2:
            rounded(draw, (x + 24, yy - 6, x + w - 24, yy + 40), radius=12, fill="#fde8df")
        draw.text((x + 34, yy), line, font=F["body"], fill=INK)
        yy += 48
    if ai:
        rounded(draw, (x + w - 136, y + h - 112, x + w - 34, y + h - 34), radius=22, fill=ACCENT)
        center_text(draw, (x + w - 136, y + h - 112, x + w - 34, y + h - 34), "AI", F["h3"], "white")


def feature_graphic():
    im = Image.new("RGB", (1024, 500), CREAM)
    draw = ImageDraw.Draw(im)
    lifestyle = lifestyle_real_reader() or replace_lifestyle_phone_screen()
    if lifestyle:
        w, h = lifestyle.size
        # Portrait lifestyle image: keep the person and real phone visible.
        crop = lifestyle.crop((int(w * 0.31), int(h * 0.18), w, int(h * 0.90)))
        crop = crop.resize((442, 500), Image.Resampling.LANCZOS)
        crop = ImageEnhance.Contrast(crop).enhance(1.04)
        im.paste(crop, (582, 0))
        overlay = Image.new("RGBA", (442, 500), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        od.rectangle((0, 0, 64, 500), fill=(251, 247, 233, 200))
        im.paste(Image.alpha_composite(crop.convert("RGBA"), overlay), (582, 0))
        draw.rectangle((564, 0, 582, 500), fill="#eee6d4")
    else:
        mini_reader(draw, 700, 54, 270, 390, ai=True)
    draw.rectangle((0, 0, 118, 500), fill=ACCENT)
    draw.rectangle((118, 0, 134, 500), fill="#eee6d4")
    im.paste(icon(92), (52, 40), icon(92))
    draw.text((170, 50), "readFlow", font=F["logo"], fill=INK)
    text(draw, (170, 126), "PDF reader with AI", F["hero"], INK, max_width=380)
    text(draw, (174, 286), "Reflow PDFs and Word docs. Listen aloud. Ask AI as you read.", F["body"], MUTED, max_width=360)
    x = 174
    for label, fill, color in [
        ("AI help", "#eaf4f1", GREEN_DARK),
        ("Voice", "#fff2e4", ACCENT),
        ("OCR", "#eef3fa", BLUE),
    ]:
        x = chip(draw, x, 374, label, fill=fill, color=color)
    im.save(OUT / "feature-graphic-1024x500.png")
    mockup = lifestyle_with_mockup(caption=False, save=False)
    if mockup:
        alt = Image.new("RGB", (1024, 500), CREAM)
        ad = ImageDraw.Draw(alt)
        crop = mockup.crop((120, 220, 848, 1080)).resize((442, 500), Image.Resampling.LANCZOS)
        alt.paste(crop, (582, 0))
        ad.rectangle((0, 0, 118, 500), fill=ACCENT)
        ad.rectangle((118, 0, 134, 500), fill="#eee6d4")
        alt.paste(icon(92), (52, 40), icon(92))
        ad.text((170, 50), "readFlow", font=F["logo"], fill=INK)
        text(ad, (170, 126), "PDF reader with AI", F["hero"], INK, max_width=380)
        text(ad, (174, 286), "Reflow PDFs and Word docs. Listen aloud. Ask AI as you read.", F["body"], MUTED, max_width=360)
        x = 174
        for label, fill, color in [
            ("AI help", "#eaf4f1", GREEN_DARK),
            ("Voice", "#fff2e4", ACCENT),
            ("OCR", "#eef3fa", BLUE),
        ]:
            x = chip(ad, x, 374, label, fill=fill, color=color)
        alt.save(OUT / "feature-graphic-mockup-1024x500.png")


def phone_canvas(title: str, subtitle: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    im = Image.new("RGB", (1080, 1920), CREAM)
    draw = ImageDraw.Draw(im)
    draw_status(draw, 1080)
    draw_brand(draw, im)
    text(draw, (52, 205), title, F["h1"], INK, max_width=880)
    text(draw, (54, 335), subtitle, F["body"], MUTED, max_width=900)
    return im, draw


def phone_library():
    im, draw = phone_canvas("PDF ebook reading, now with AI", "Turn supported PDFs and Word docs into clean phone reading with voice and AI help.")
    y = 468
    for i, (name, meta, color) in enumerate([
        ("Extreme Ownership.pdf", "Clean text PDF - ready to read", GREEN),
        ("Philosophy notes.docx", "Word document - ebook-style view", BLUE),
        ("Scanned book.pdf", "OCR available on AI plans", ACCENT),
    ]):
        rounded(draw, (54, y, 1026, y + 210), radius=24, fill=PAPER, outline=LINE)
        draw.rectangle((86, y + 40, 166, y + 170), fill=color)
        draw.text((198, y + 44), name, font=F["h3"], fill=INK)
        draw.text((198, y + 90), meta, font=F["body"], fill=MUTED)
        bx = 198
        if i == 0:
            bx = chip(draw, bx, y + 136, "Read", fill="#f4efe3")
            bx = chip(draw, bx, y + 136, "Voice", fill="#fff2e4", color=ACCENT)
            chip(draw, bx, y + 136, "AI", fill="#eaf4f1", color=GREEN_DARK)
        elif i == 1:
            bx = chip(draw, bx, y + 136, "Bookmarks", fill="#f4efe3")
            chip(draw, bx, y + 136, "Progress", fill="#f4efe3")
        else:
            bx = chip(draw, bx, y + 136, "OCR", fill="#eef3fa", color=BLUE)
            chip(draw, bx, y + 136, "AI Pro", fill="#eaf4f1", color=GREEN_DARK)
        y += 248
    rounded(draw, (54, 1320, 1026, 1665), radius=28, fill="#1f1a14")
    draw.text((104, 1372), "Ask AI while you read", font=F["h2"], fill="white")
    text(draw, (106, 1442), "Summaries, explanations, key points, and Q&A are available on eligible AI plans.", F["body"], "#efe9dc", max_width=780)
    chip(draw, 106, 1570, "AI reading help", fill="#eaf4f1", color=GREEN_DARK)
    im.save(OUT / "phone-01-library-ai.png")


def phone_reader():
    im, draw = phone_canvas("Replace pinch-and-zoom PDF reading", "A fixed page becomes a comfortable ebook-style text view.")
    rounded(draw, (54, 470, 1026, 1732), radius=28, fill=PAPER, outline=LINE)
    draw.text((100, 516), "Chapter One", font=F["h2"], fill=INK)
    draw.text((100, 570), "Page 6 of 288", font=F["small"], fill=MUTED)
    y = 650
    paras = [
        "Dawn breaks over South-Central Ramadi.",
        "Task Unit Bruiser watches from deep inside enemy territory.",
        "Enemy fighters shot thousands of rounds at the helicopter as they overflew the city.",
        "readFlow keeps the text large, clean, and easy to continue.",
    ]
    for i, p in enumerate(paras):
        if i == 2:
            rounded(draw, (84, y - 12, 996, y + 110), radius=16, fill="#fde8df")
        y = text(draw, (100, y), p, F["body"], INK, max_width=850, line_gap=10) + 28
    rounded(draw, (84, 1530, 996, 1682), radius=26, fill="#f4efe3", outline=LINE)
    draw.text((124, 1567), "Listen", font=F["h3"], fill=ACCENT)
    draw.text((304, 1567), "AI", font=F["h3"], fill=GREEN_DARK)
    draw.text((428, 1567), "Bookmark", font=F["h3"], fill=INK)
    im.save(OUT / "phone-02-reader.png")


def phone_voice():
    im, draw = phone_canvas("Turn documents into listenable books", "Choose Phone voice, rF AI, or capped Cloud AI on eligible plans.")
    rounded(draw, (54, 470, 1026, 1668), radius=32, fill=PAPER, outline=LINE)
    draw.text((104, 530), "Voice", font=F["h1"], fill=INK)
    y = 640
    for title, sub, badge, color in [
        ("Phone voice", "Uses installed device voices", "Reader Plus", GREEN),
        ("rF AI", "On-device AI voice after download", "AI Pro", BLUE),
        ("Cloud AI", "Premium cloud voice with allowance", "Power", ACCENT),
    ]:
        rounded(draw, (100, y, 980, y + 190), radius=22, fill="#fbfaf3", outline=LINE)
        draw.text((140, y + 38), title, font=F["h3"], fill=INK)
        draw.text((140, y + 84), sub, font=F["body"], fill=MUTED)
        chip(draw, 730, y + 60, badge, fill="#eaf4f1" if color != ACCENT else "#fff2e4", color=color)
        y += 225
    rounded(draw, (100, 1390, 980, 1548), radius=30, fill=ACCENT)
    center_text(draw, (100, 1390, 980, 1548), "Play", F["h2"], "white")
    im.save(OUT / "phone-03-voice-ai.png")


def phone_ai():
    im, draw = phone_canvas("AI reading help stays in view", "Summarize, simplify, explain, and ask questions about the current section.")
    rounded(draw, (54, 470, 1026, 1700), radius=32, fill=PAPER, outline=LINE)
    draw.text((104, 530), "AI", font=F["h1"], fill=ACCENT)
    draw.text((196, 548), "Reading help", font=F["h2"], fill=INK)
    rounded(draw, (100, 650, 980, 850), radius=22, fill="#f4efe3", outline=LINE)
    text(draw, (132, 690), "What happened in this section?", F["body_bold"], INK, max_width=760)
    text(draw, (132, 750), "The passage introduces the setting, main tension, and key action.", F["body"], MUTED, max_width=760)
    y = 910
    for label, desc in [
        ("Summarize", "Get a short version before continuing."),
        ("Explain", "Clarify difficult paragraphs."),
        ("Key points", "Pull out the ideas worth remembering."),
        ("Ask", "Question the current book section."),
    ]:
        rounded(draw, (100, y, 980, y + 132), radius=20, fill="#fbfaf3", outline=LINE)
        draw.text((138, y + 28), label, font=F["h3"], fill=INK)
        draw.text((138, y + 76), desc, font=F["small"], fill=MUTED)
        y += 158
    chip(draw, 100, 1550, "Eligible AI plans", fill="#eaf4f1", color=GREEN_DARK)
    chip(draw, 344, 1550, "Monthly allowance", fill="#fff2e4", color=ACCENT)
    im.save(OUT / "phone-04-ai.png")


def tablet(name: str, size: tuple[int, int], ai_focus: bool):
    w, h = size
    im = Image.new("RGB", size, CREAM)
    draw = ImageDraw.Draw(im)
    mark = icon(78)
    im.paste(mark, (70, 58), mark)
    draw.text((166, 76), "readFlow", font=F["body_bold"], fill=INK)
    if ai_focus:
        text(draw, (80, 180), "Read, listen, and ask AI", F["hero"], INK, max_width=760)
        text(draw, (84, 310), "A document reader for PDFs and Word docs with AI help on eligible plans.", F["body"], MUTED, max_width=700)
        mini_reader(draw, w - 690, 130, 560, 760, ai=True)
        y = 500
        for label, desc in [
            ("AI summaries", "Quickly understand long sections."),
            ("Voice reading", "Listen with Phone, rF AI, or Cloud AI."),
            ("OCR on AI plans", "Convert scanned PDFs when allowed."),
        ]:
            rounded(draw, (84, y, 680, y + 120), radius=22, fill=PAPER, outline=LINE)
            draw.text((122, y + 24), label, font=F["h3"], fill=INK)
            draw.text((122, y + 72), desc, font=F["small"], fill=MUTED)
            y += 150
    else:
        text(draw, (80, 180), "Your PDF ebook reader", F["hero"], INK, max_width=720)
        text(draw, (84, 310), "Replace fixed-page reading with clean mobile text, progress, bookmarks, voice, and AI.", F["body"], MUTED, max_width=760)
        rounded(draw, (80, 470, w - 80, h - 110), radius=30, fill=PAPER, outline=LINE)
        draw.text((132, 530), "Chapter 4", font=F["h2"], fill=INK)
        y = 620
        for line in textwrap.wrap("readFlow turns supported PDFs and text-based Word documents into an ebook-style reading experience that is easier to follow on phones and tablets.", width=54):
            draw.text((132, y), line, font=F["body"], fill=INK)
            y += 48
        rounded(draw, (132, y + 20, w - 132, y + 78), radius=16, fill="#fde8df")
        draw.text((152, y + 30), "Highlighted line while listening", font=F["body"], fill=INK)
    im.save(OUT / name)


def write_readme():
    (OUT / "README.md").write_text(
        """# Play Store Assets

Generated for the Android Play Store listing.

- `app-icon-512.png`: Play app icon.
- `feature-graphic-1024x500.png`: Feature graphic with PDF ebook, voice, and AI positioning.
- `feature-graphic-mockup-1024x500.png`: Alternate feature graphic with a cleaner app mockup.
- `lifestyle-readflow-screen.jpg`: Real person reading a book-like readFlow screen on the phone.
- `phone-00-real-reading.png`: Phone screenshot slot showing the real reading lifestyle image.
- `source-real-reading-nano.png`: Source image used to regenerate the real-reading assets.
- `phone-01-library-ai.png`: Phone screenshot showing library, voice, OCR, and AI.
- `phone-02-reader.png`: Phone screenshot showing ebook-style PDF reading.
- `phone-03-voice-ai.png`: Phone screenshot showing Phone voice, rF AI, and Cloud AI.
- `phone-04-ai.png`: Phone screenshot showing AI reading help.
- `tablet7-01-ai-reader.png`, `tablet7-02-ebook-reader.png`: 7-inch tablet screenshots.
- `tablet10-01-ai-reader.png`, `tablet10-02-ebook-reader.png`: 10-inch tablet screenshots.

Positioning: readFlow is a PDF and text-based Word document reader that creates an ebook-style phone view, with voice and AI features on eligible plans.
""",
        encoding="utf-8",
    )


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    icon(512).save(OUT / "app-icon-512.png")
    feature_graphic()
    phone_library()
    phone_reader()
    phone_voice()
    phone_ai()
    tablet("tablet7-01-ai-reader.png", (1200, 1920), True)
    tablet("tablet7-02-ebook-reader.png", (1200, 1920), False)
    tablet("tablet10-01-ai-reader.png", (1920, 1200), True)
    tablet("tablet10-02-ebook-reader.png", (1920, 1200), False)
    write_readme()
    print(f"Wrote Play Store assets to {OUT}")


if __name__ == "__main__":
    main()
