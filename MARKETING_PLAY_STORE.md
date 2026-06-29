# readFlow Marketing and Store Copy

Updated: 2026-06-29

This file is for the marketing/web/Play Store team. It describes what readFlow
does, how to present each tier, and how to word claims carefully while the app,
OCR, AI voice, and multilingual reading are still improving.

For Play submission operations, use `PLAY_RELEASE_PACKET.md`. For subscriptions
and product ids, use `PAYMENT_SETUP.md`. For legal pages and Data Safety, start
from `PRIVACY_POLICY_DRAFT.md`, `TERMS_OF_USE_DRAFT.md`, and
`PLAY_DATA_SAFETY_DRAFT.md`.

## Brand

- Product name: `readFlow`
- Icon mark: `rF`
- Use `readFlow` in user-facing copy.
- Use lowercase technical ids only where required: package names, URLs,
  product ids, file names, and backend service names.
- Do not use `Readflow`, `Read Flow`, or all-caps `READFLOW` in public copy.

## Core Positioning

readFlow turns supported PDFs and text-based Word `.docx` documents into a
phone-first reading experience.
Instead of forcing users to pinch and zoom a fixed page, it extracts the text,
reflows it into readable mobile typography, highlights the current line or
paragraph, and can read aloud with phone voice, rF AI voice, or capped Cloud AI
voice depending on the plan and language.

Recommended one-line positioning:

> readFlow makes long PDFs and text-based Word `.docx` documents easier to read and listen to on a phone.

Shorter store positioning:

> Reflow PDFs into clean mobile reading, listen aloud, and ask AI when you need help.

## Important Claim Rules

Use careful wording. Do not promise that every document, scan, language, OCR
result, or AI voice will be perfect.

Use:

- "designed to"
- "helps"
- "supports"
- "available for eligible plans"
- "quality may vary by document, language, phone, and source file"
- "features are actively improving"
- "some AI, OCR, and voice features use monthly allowances"
- "scanned or damaged PDFs may require OCR and may not always convert cleanly"
- "OCR works best on crisp scans and may struggle with blurred, skewed, noisy,
  or phone-photo pages"

Avoid:

- "perfectly reads every PDF"
- "unlimited AI"
- "works with all languages"
- "guaranteed OCR"
- "recovers damaged scans"
- "reads any scan"
- "human-quality voice for every language"
- "no errors"
- "legal/medical/financial advice"

Suggested legal-safe product note:

> Document extraction, OCR, AI answers, and voice quality depend on the source
> file, language, device, and plan. readFlow is designed to improve reading and
> listening, but some documents may require OCR, manual checking, or a different
> source file. AI features are assistive and may be incomplete or inaccurate.

## Feature List For Web Page

### Phone-first PDF and Word reading

- Converts text-based PDFs and modern Word `.docx` documents into a clean mobile
  reading view.
- Avoids constant pinch-zooming on small screens.
- Keeps reading position, bookmarks, and navigation.
- Filters common page numbers, repeated headers/footers, URLs, and watermark
  lines from the reading flow when possible.
- Word support means real selectable text in `.docx` files. Picture-based Word
  pages, embedded scans/images, legacy `.doc`, complex tables, columns,
  footnotes, and advanced formatting should not be promised as fully preserved.

Careful claim:

> Works best with text-based PDFs and modern Word `.docx` files that contain real
> text. Scanned, image-heavy, legacy, or heavily formatted documents may require
> OCR or may not convert perfectly.

### Voice options

- Phone voice: uses the device's installed voices. No per-hour vendor cost.
- rF AI voice: downloaded on-device voice for eligible phones. Uses local CPU,
  storage, and battery after model download.
- Cloud AI voice: higher quality cloud voice for approved languages and paid
  plans, with monthly allowance.

Careful claim:

> Voice availability and quality vary by language, plan, phone, and installed
> voice packages. Cloud AI voice is capped and quality-approved language by
> language.

### AI reading help

- Summaries
- Explanations
- Simplified explanations
- Key points
- Ask questions about the current section

Cost/business note:

- These features use backend AI calls and can cost us OpenAI tokens unless a
  cached result is returned.
- They are included in AI Pro and Power as monthly AI action allowances.
- They should not be available in Free or Reader Plus.

Careful claim:

> AI answers are for reading assistance. They may be incomplete or inaccurate,
> and users should verify important information from the original document.

### OCR for scanned PDFs

- OCR is for AI Pro and Power.
- Reader Plus is for full native-text reading, not scanned-book OCR.
- OCR is strongest on clean scans: flat, sharp, evenly lit pages with normal
  printed text.
- Recent QA passed clean native PDFs and good scans across all 21 exposed OCR
  languages.
- Medium copier-style scans are supported, but quality and processing time vary
  by language and page condition.
- Poor scans and phone-photo pages may route to OCR but should not be promised
  as reliably readable.
- OCR progress is saved so a large scanned book can continue later.
- If OCR allowance runs out, users can continue after reset or upgrade/top up.

Careful claim:

> OCR works best on crisp printed scans. Blurred, skewed, noisy,
> low-resolution, image-heavy, or phone-photo pages may take longer and may not
> convert cleanly.

### Multilingual reading

- Text-based PDFs can work across many languages when the PDF text layer is
  clean.
- OCR language choices include English, several European languages, Arabic,
  Persian, Russian, Hindi, Chinese, Japanese, Korean, Thai, and others.
- Internal QA passed clean text PDFs and good-scan OCR across the 21 exposed OCR
  language choices. Harder degraded scans remain quality-variable.
- Some non-Latin PDFs can contain a broken text layer even when the page looks
  correct visually. readFlow detects many of these cases and routes them to OCR
  when the user's plan allows it.

Careful claim:

> Multilingual support is improving. Language quality varies by document type,
> source file, OCR availability, and voice support.

## Current Tier Messaging

### Free

Purpose:

- Let users test the product safely with no OpenAI cost to us.

Message:

> Try the clean phone reading view with a limited preview.

Current limits:

- 1 imported PDF or Word `.docx` document/month.
- First 100 pages of native-text documents.
- Manual reading only; no read-aloud/listen mode.
- No AI answers.
- No OCR.
- No rF AI voice.
- No Cloud AI voice.

### Reader Plus

Purpose:

- Paid reading tier with no marginal AI/OpenAI cost.

Message:

> Full native-text reading, ad-free, with Phone voice and no cloud voice cost.

Includes:

- Larger native-text PDF and Word `.docx` imports.
- Full text-based books.
- Device voice.
- Bookmarks and reading progress.

Does not include:

- OCR for scanned/image PDFs.
- AI summaries/Q&A.
- Cloud AI voice.

### AI Pro

Purpose:

- Main AI tier.

Message:

> Add AI reading help, OCR allowance, and capped Cloud AI voice.

Includes:

- 150 AI actions/month.
- 750 OCR pages/month.
- 45,000 Cloud AI voice characters/month for approved languages.
- rF AI voice option where supported.

### Power

Purpose:

- Heavy-user tier.

Message:

> Higher limits for large libraries, scanned books, and frequent AI help.

Includes:

- 400 AI actions/month.
- 2,500 OCR pages/month.
- 100,000 Cloud AI voice characters/month for approved languages.
- Higher file/page limits.

## Play Store Draft

### App Title

readFlow: PDF Reader & Voice

### Short Description

Read PDFs and text-based Word docs in a clean phone view, listen aloud, and ask AI.

### Full Description

readFlow helps make long PDFs and text-based Word `.docx` documents easier to
read on your phone.
It turns supported documents into a clean mobile reading view, keeps your place,
and can read aloud with device voice, rF AI voice, or capped Cloud AI voice
depending on your plan, device, and language.

Features:

- Reflow supported PDFs and text-based Word `.docx` documents into phone-friendly text
- Listen with device voice at no cloud voice cost
- Use rF AI voice on eligible phones after downloading the voice model
- Use capped Cloud AI voice on supported paid plans and approved languages
- Highlight text while listening
- Bookmark pages and continue where you left off
- Ask AI for summaries, explanations, simplified text, key points, and answers
- Use OCR allowances on paid AI plans for scanned/image PDFs
- Choose document language for OCR, voices, and AI answers

Important notes:

- Works best with clean text-based PDFs and modern Word `.docx` documents.
- Word files that are mostly pictures/scans, legacy `.doc`, or heavily formatted
  layouts may not convert cleanly.
- Good-quality printed scans can be converted with OCR on eligible AI plans.
- Medium, damaged, blurred, skewed, noisy, or phone-photo scans may take longer
  and may not convert cleanly.
- OCR, AI answers, and AI voices are assistive features and may be incomplete or
  inaccurate.
- Voice quality and availability vary by language, device, installed voices, and
  plan.
- Some features use monthly allowances or paid plans.

### Keywords And Phrases

- PDF reader
- Word `.docx` document reader
- PDF voice reader
- text to speech PDF
- AI PDF reader
- OCR PDF reader
- study PDF
- read aloud
- mobile reading
- document reflow
- accessible reading

## Web Page Sections

1. Hero:
   - Headline: `readFlow makes long documents easier on your phone.`
   - Subcopy: `Reflow PDFs and text-based Word .docx documents into clean mobile reading, listen
     aloud, and ask AI when you need help.`
   - CTA: `Try readFlow`

2. Problem:
   - PDFs are built for pages, not phones.
   - Users pinch, zoom, lose their place, and stop reading.

3. Solution:
   - Clean reading view.
   - Voice options.
   - AI help.
   - OCR for scanned documents on AI plans.

4. Plans:
   - Free, Reader Plus, AI Pro, Power.
   - Be explicit about OCR and AI allowances.

5. Voice:
   - Phone voice for long listening.
   - rF AI voice for local AI narration on supported devices.
   - Cloud AI voice for capped premium narration.

6. Trust and limitations:
   - Explain that document quality matters.
   - Explain that AI is assistive.
   - Explain that features are actively improving.

7. Contact:
   - support@urmiaworks.com

## Professional Limitation Copy

Use this near pricing, OCR, AI, or voice sections:

> readFlow is actively improving. Document conversion, OCR, AI responses, and
> voice quality can vary by source file, language, plan, and device. AI features
> are assistive and should not be used as a substitute for checking the original
> document or professional advice.

Use this for OCR:

> OCR is available on eligible AI plans and is limited by monthly allowance.
> OCR is best for crisp printed scans. Medium-quality copier scans can work but
> vary by language and page condition. Blurry, skewed, noisy, low-resolution,
> phone-photo, handwritten, or heavily compressed scans may need manual checking
> or a better source file.

Use this for AI voice:

> Cloud AI voice is capped by monthly allowance and enabled only for languages
> that pass quality testing. rF AI voice runs on supported phones after model
> download and may use battery, CPU, and storage.

Use this for AI answers:

> AI answers are generated from the selected document text and may miss context
> or make mistakes. Verify important information in the original document.

## Marketing Feature Checklist

Make sure the website and store assets mention:

- Phone-first PDF/Word reading
- Reflowed text instead of pinch-zoom
- Device voice with no cloud voice cost
- rF AI voice as an on-device option
- Capped Cloud AI voice for paid plans
- AI summaries, explanations, key points, and Q&A
- OCR for scanned PDFs on AI plans
- Saved OCR progress for large books
- Multilingual reading support with careful limitations
- Page-number/header/watermark cleanup where possible
- Bookmarks and reading progress
