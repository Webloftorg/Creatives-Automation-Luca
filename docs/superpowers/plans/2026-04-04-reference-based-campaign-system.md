# Reference-Based Campaign System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AI-generated HTML templates with 5 hand-crafted master templates + parametric CSS variation, achieving professional quality creatives in under 10 minutes.

**Architecture:** 5 master HTML templates (Dark Center, Split Bold, Minimal Light, Full Impact, Editorial) share the same CSS variable system and placeholder structure. The AI generates ONLY JSON objects with CSS variable overrides — never HTML. Campaign setup uses a visual template picker with manual headline entry. Background removal is fixed by resolving the sharp DLL issue.

**Tech Stack:** Next.js 15, TypeScript, Anthropic Claude API (Sonnet 4), Google Imagen 4, @imgly/background-removal-node, sharp, Puppeteer (render server)

---

## File Structure

### New Files
- `public/templates/split-bold.html` — Split Bold master template (wellfit style)
- `public/templates/minimal-light.html` — Minimal Light master template (JONNY M. style)
- `public/templates/full-impact.html` — Full Impact master template (Vorverkauf style)
- `public/templates/editorial.html` — Editorial master template (Magazine style)
- `components/template-picker.tsx` — Visual template selection grid component

### Modified Files
- `public/templates/price-offer-reference.html` — Rename conceptually to "Dark Center" (keep file, update seed)
- `scripts/seed-reference-template.ts` — Seed all 5 templates
- `components/campaign-setup.tsx` — New 3-step flow: Style → Content → Generate
- `app/api/campaigns/[id]/generate/route.ts` — Remove `generateLayoutHtml`, add CSS param generation
- `lib/prompts.ts` — Replace `template-generation` with `parameter-variation` prompt
- `app/api/campaigns/[id]/regenerate/route.ts` — Generate CSS param variations instead of HTML
- `lib/types.ts` — Add `headlines: string[]` to Campaign type

### Files to Fix
- `node_modules/@img/sharp-win32-x64` — Reinstall native module

---

## Task 1: Fix sharp Native Module

**Files:**
- Fix: `node_modules/@img/sharp-win32-x64/lib/sharp-win32-x64.node`

- [ ] **Step 1: Remove broken sharp binaries and reinstall**

```bash
rm -rf node_modules/sharp node_modules/@img/sharp-win32-x64
npm install sharp@0.33.2 --platform=win32 --arch=x64
```

- [ ] **Step 2: Verify sharp loads**

```bash
node -e "const sharp = require('sharp'); sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toBuffer().then(b => console.log('sharp OK, buffer:', b.length, 'bytes')).catch(e => console.error('FAIL:', e.message))"
```

Expected: `sharp OK, buffer: <number> bytes`

- [ ] **Step 3: Verify @imgly bg removal loads**

```bash
npx tsx -e "import { removeBackground } from '@imgly/background-removal-node'; console.log('imgly OK');"
```

Expected: `imgly OK` (may take a moment to download ONNX models on first run)

- [ ] **Step 4: Commit**

```bash
git add package-lock.json
git commit -m "fix: reinstall sharp native module for Windows x64"
```

---

## Task 2: Create 4 New Master Templates

All templates share the same CSS variable names and placeholder system as the existing `price-offer-reference.html` (which becomes "Dark Center"). Each template MUST have all `data-draggable` attributes, `creative-container` class, and Montserrat font.

**Files:**
- Create: `public/templates/split-bold.html`
- Create: `public/templates/minimal-light.html`
- Create: `public/templates/full-impact.html`
- Create: `public/templates/editorial.html`

- [ ] **Step 1: Create Split Bold template (wellfit style)**

Write `public/templates/split-bold.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-color: {{primaryColor}};
      --accent-color: {{accentColor}};
      --bg-blur: 4px;
      --bg-brightness: 0.3;
      --headline-size: 88px;
      --price-size: 130px;
      --person-scale: 0.9;
      --person-position-y: 0%;
      --person-position-x: -25%;
      --location-size: 32px;
      --strikethrough-size: 32px;
      --headline-rotation: 0deg;
      --price-rotation: 0deg;
      --content-padding: 40px;
      --location-x: 75%;
      --location-y: 6%;
      --headline-x: 72%;
      --headline-y: 30%;
      --price-block-x: 72%;
      --price-block-y: 55%;
      --watermark-size: 160px;
      --watermark-opacity: 0.05;
      --watermark-rotation: -12deg;
      --price-unit-size: 30px;
      --footer-height: 56px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    .creative-container {
      width: {{width}}px; height: {{height}}px;
      position: relative; overflow: hidden;
      font-family: 'Montserrat', sans-serif; background: #0a0a0a;
    }
    .background {
      position: absolute; inset: 0;
      background-image: url('{{backgroundImage}}');
      background-size: cover; background-position: center;
      filter: blur(var(--bg-blur)) brightness(var(--bg-brightness));
      transform: scale(1.15);
    }
    .overlay {
      position: absolute; inset: 0;
      background: linear-gradient(
        to right,
        rgba(0,0,0,0.1) 0%,
        rgba(0,0,0,0.3) 40%,
        rgba(0,0,0,0.8) 65%,
        rgba(0,0,0,0.9) 100%
      );
      z-index: 1;
    }
    .watermark {
      position: absolute; inset: -20%; z-index: 1;
      display: flex; flex-wrap: wrap; align-content: center; justify-content: center; gap: 20px;
      transform: rotate(var(--watermark-rotation)); pointer-events: none;
    }
    .watermark span {
      font-size: var(--watermark-size); font-weight: 900; color: white;
      opacity: var(--watermark-opacity); text-transform: uppercase;
      white-space: nowrap; letter-spacing: 8px; line-height: 1.2;
    }
    .person {
      position: absolute; z-index: 2;
      bottom: var(--person-position-y);
      left: calc(50% + var(--person-position-x));
      transform: translateX(-50%) scale(var(--person-scale));
      height: 90%; width: auto; object-fit: contain;
      filter: drop-shadow(0 8px 30px rgba(0,0,0,0.6));
    }
    .location {
      position: absolute; z-index: 3;
      left: var(--location-x); top: var(--location-y);
      transform: translateX(-50%);
      font-size: var(--location-size); font-weight: 700; color: white;
      text-align: center; text-shadow: 2px 2px 8px rgba(0,0,0,0.8);
      text-transform: uppercase; letter-spacing: 3px; white-space: nowrap;
    }
    .headline {
      position: absolute; z-index: 3;
      left: var(--headline-x); top: var(--headline-y);
      transform: translateX(-50%) rotate(var(--headline-rotation));
      font-size: var(--headline-size); font-weight: 900; color: white;
      text-transform: uppercase; text-shadow: 3px 3px 12px rgba(0,0,0,0.9);
      line-height: 1.0; text-align: center; white-space: nowrap;
    }
    .price-block {
      position: absolute; z-index: 3;
      left: var(--price-block-x); top: var(--price-block-y);
      transform: translateX(-50%) rotate(var(--price-rotation));
      text-align: center;
    }
    .price-row { display: flex; align-items: baseline; justify-content: center; gap: 6px; }
    .price {
      font-size: var(--price-size); font-weight: 900; color: var(--accent-color);
      text-shadow: 0 0 10px var(--accent-color), 0 0 30px var(--accent-color),
        0 0 60px var(--accent-color), 0 0 100px var(--accent-color), 0 2px 4px rgba(0,0,0,0.8);
      line-height: 1.0; letter-spacing: -2px; filter: brightness(1.3);
    }
    .price-unit {
      font-size: var(--price-unit-size); font-weight: 700; color: var(--accent-color);
      text-shadow: 0 0 10px var(--accent-color), 0 0 30px var(--accent-color), 0 2px 4px rgba(0,0,0,0.8);
      filter: brightness(1.3);
    }
    .original-price {
      display: inline-block; font-size: var(--strikethrough-size); font-weight: 700;
      color: rgba(255,255,255,0.7); text-decoration: line-through;
      text-decoration-color: var(--accent-color); text-decoration-thickness: 3px;
      margin-top: 8px; text-shadow: 0 2px 8px rgba(0,0,0,0.8);
    }
    .footer-bar {
      position: absolute; z-index: 4; bottom: 0; left: 0; right: 0;
      height: var(--footer-height); background: var(--primary-color);
      display: flex; align-items: center; justify-content: center; gap: 40px; padding: 0 30px;
    }
    .footer-bar span {
      font-size: 18px; font-weight: 700; color: white;
      text-transform: uppercase; letter-spacing: 1px; white-space: nowrap;
    }
    .footer-separator { width: 6px; height: 6px; background: white; border-radius: 50%; opacity: 0.6; }
  </style>
</head>
<body>
  <div class="creative-container">
    <div class="background"></div>
    <div class="overlay"></div>
    <div class="watermark">
      <span>{{headline}}</span><span>{{headline}}</span><span>{{headline}}</span>
      <span>{{headline}}</span><span>{{headline}}</span><span>{{headline}}</span>
    </div>
    <img class="person" src="{{personImage}}" alt="" data-draggable="person">
    <div class="location" data-draggable="location">{{location}}</div>
    <h1 class="headline" data-draggable="headline">{{headline}}</h1>
    <div class="price-block" data-draggable="price-block">
      <div class="price-row">
        <div class="price">{{price}}</div>
        <div class="price-unit">/mtl.</div>
      </div>
      <div class="original-price">Statt {{originalPrice}}</div>
    </div>
    <div class="footer-bar">
      <span>{{location}}</span>
      <div class="footer-separator"></div>
      <span>Jetzt starten</span>
    </div>
  </div>
</body>
</html>
```

Key differences from Dark Center: overlay gradient goes left→right (dark on text side), person shifted left (`--person-position-x: -25%`), text block shifted right (`--headline-x: 72%`, `--price-block-x: 72%`).

- [ ] **Step 2: Create Minimal Light template (JONNY M. style)**

Write `public/templates/minimal-light.html`:

Same CSS variable structure but with these key differences:
- `--bg-blur: 0px; --bg-brightness: 0.95` (bright, nearly no blur)
- `.overlay` gradient: mostly transparent with subtle bottom darkening
- `.headline` and `.price` color: `#111` (dark text on light bg)
- `.price` text-shadow uses `rgba(var(--accent-color-rgb), 0.3)` or simpler glow
- `.watermark` opacity: 0.03, lighter color
- Person positioned right (`--person-position-x: 20%`)
- Text left-aligned (`--headline-x: 30%`)
- No footer bar; instead a bottom-left studio name block
- Clean, minimal aesthetic with lots of whitespace

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-color: {{primaryColor}};
      --accent-color: {{accentColor}};
      --bg-blur: 0px;
      --bg-brightness: 0.92;
      --headline-size: 96px;
      --price-size: 140px;
      --person-scale: 0.85;
      --person-position-y: 0%;
      --person-position-x: 22%;
      --location-size: 24px;
      --strikethrough-size: 34px;
      --headline-rotation: 0deg;
      --price-rotation: 0deg;
      --content-padding: 50px;
      --location-x: 28%;
      --location-y: 88%;
      --headline-x: 30%;
      --headline-y: 22%;
      --price-block-x: 32%;
      --price-block-y: 48%;
      --watermark-size: 170px;
      --watermark-opacity: 0.03;
      --watermark-rotation: -10deg;
      --price-unit-size: 34px;
      --footer-height: 0px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    .creative-container {
      width: {{width}}px; height: {{height}}px;
      position: relative; overflow: hidden;
      font-family: 'Montserrat', sans-serif; background: #f5f5f5;
    }
    .background {
      position: absolute; inset: 0;
      background-image: url('{{backgroundImage}}');
      background-size: cover; background-position: center;
      filter: blur(var(--bg-blur)) brightness(var(--bg-brightness));
      transform: scale(1.05);
    }
    .overlay {
      position: absolute; inset: 0;
      background: linear-gradient(to bottom, rgba(245,245,245,0.6) 0%, rgba(245,245,245,0.3) 50%, rgba(245,245,245,0.5) 100%);
      z-index: 1;
    }
    .watermark {
      position: absolute; inset: -20%; z-index: 1;
      display: flex; flex-wrap: wrap; align-content: center; justify-content: center; gap: 20px;
      transform: rotate(var(--watermark-rotation)); pointer-events: none;
    }
    .watermark span {
      font-size: var(--watermark-size); font-weight: 900; color: #999;
      opacity: var(--watermark-opacity); text-transform: uppercase;
      white-space: nowrap; letter-spacing: 8px; line-height: 1.2;
    }
    .person {
      position: absolute; z-index: 2;
      bottom: var(--person-position-y);
      left: calc(50% + var(--person-position-x));
      transform: translateX(-50%) scale(var(--person-scale));
      height: 88%; width: auto; object-fit: contain;
      filter: drop-shadow(0 4px 20px rgba(0,0,0,0.15));
    }
    .location {
      position: absolute; z-index: 3;
      left: var(--location-x); top: var(--location-y);
      transform: translateX(-50%);
      font-size: var(--location-size); font-weight: 700; color: #333;
      text-align: center; text-transform: uppercase; letter-spacing: 2px; white-space: nowrap;
    }
    .headline {
      position: absolute; z-index: 3;
      left: var(--headline-x); top: var(--headline-y);
      transform: translateX(-50%) rotate(var(--headline-rotation));
      font-size: var(--headline-size); font-weight: 900; color: #111;
      text-transform: uppercase; line-height: 1.0; text-align: center; white-space: nowrap;
    }
    .price-block {
      position: absolute; z-index: 3;
      left: var(--price-block-x); top: var(--price-block-y);
      transform: translateX(-50%) rotate(var(--price-rotation));
      text-align: center;
    }
    .price-row { display: flex; align-items: baseline; justify-content: center; gap: 6px; }
    .price {
      font-size: var(--price-size); font-weight: 900; color: var(--accent-color);
      text-shadow: 0 0 10px var(--accent-color), 0 0 30px var(--accent-color),
        0 0 60px var(--accent-color), 0 0 100px var(--accent-color);
      line-height: 1.0; letter-spacing: -3px; filter: brightness(1.1);
    }
    .price-unit {
      font-size: var(--price-unit-size); font-weight: 700; color: var(--accent-color);
      filter: brightness(1.1);
    }
    .original-price {
      display: inline-block; font-size: var(--strikethrough-size); font-weight: 700;
      color: rgba(0,0,0,0.4); text-decoration: line-through;
      text-decoration-color: var(--accent-color); text-decoration-thickness: 3px; margin-top: 8px;
    }
    .footer-bar {
      position: absolute; z-index: 4; bottom: 0; left: 0; right: 0;
      height: var(--footer-height); background: transparent;
    }
  </style>
</head>
<body>
  <div class="creative-container">
    <div class="background"></div>
    <div class="overlay"></div>
    <div class="watermark">
      <span>{{headline}}</span><span>{{headline}}</span><span>{{headline}}</span>
      <span>{{headline}}</span><span>{{headline}}</span><span>{{headline}}</span>
    </div>
    <img class="person" src="{{personImage}}" alt="" data-draggable="person">
    <div class="location" data-draggable="location">{{location}}</div>
    <h1 class="headline" data-draggable="headline">{{headline}}</h1>
    <div class="price-block" data-draggable="price-block">
      <div class="price-row">
        <div class="price">{{price}}</div>
        <div class="price-unit">/mtl.</div>
      </div>
      <div class="original-price">Statt {{originalPrice}}</div>
    </div>
    <div class="footer-bar"></div>
  </div>
</body>
</html>
```

- [ ] **Step 3: Create Full Impact template (Vorverkauf style)**

Write `public/templates/full-impact.html`:

Key differences:
- Background is solid `var(--primary-color)` (no image blur)
- `.background` uses `background-color` as primary, image overlaid with heavy tint
- Person centered, very large (`--person-scale: 0.95`)
- Headline at top, VERY large (`--headline-size: 110px`)
- Price MASSIVE below (`--price-size: 160px`)
- No watermark (solid bg)
- Footer bar prominent

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-color: {{primaryColor}};
      --accent-color: {{accentColor}};
      --bg-blur: 0px;
      --bg-brightness: 0.25;
      --headline-size: 110px;
      --price-size: 160px;
      --person-scale: 0.95;
      --person-position-y: 0%;
      --person-position-x: 0%;
      --location-size: 28px;
      --strikethrough-size: 36px;
      --headline-rotation: 0deg;
      --price-rotation: 0deg;
      --content-padding: 40px;
      --location-x: 50%;
      --location-y: 5%;
      --headline-x: 50%;
      --headline-y: 15%;
      --price-block-x: 50%;
      --price-block-y: 42%;
      --watermark-size: 180px;
      --watermark-opacity: 0.0;
      --watermark-rotation: 0deg;
      --price-unit-size: 36px;
      --footer-height: 64px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    .creative-container {
      width: {{width}}px; height: {{height}}px;
      position: relative; overflow: hidden;
      font-family: 'Montserrat', sans-serif;
      background: var(--primary-color);
    }
    .background {
      position: absolute; inset: 0;
      background-image: url('{{backgroundImage}}');
      background-size: cover; background-position: center;
      filter: blur(var(--bg-blur)) brightness(var(--bg-brightness));
      mix-blend-mode: overlay; opacity: 0.4;
    }
    .overlay {
      position: absolute; inset: 0;
      background: linear-gradient(to bottom, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.5) 100%);
      z-index: 1;
    }
    .watermark {
      position: absolute; inset: -20%; z-index: 1;
      display: flex; flex-wrap: wrap; align-content: center; justify-content: center; gap: 20px;
      transform: rotate(var(--watermark-rotation)); pointer-events: none;
    }
    .watermark span {
      font-size: var(--watermark-size); font-weight: 900; color: white;
      opacity: var(--watermark-opacity); text-transform: uppercase;
      white-space: nowrap; letter-spacing: 8px; line-height: 1.2;
    }
    .person {
      position: absolute; z-index: 2;
      bottom: var(--person-position-y);
      left: calc(50% + var(--person-position-x));
      transform: translateX(-50%) scale(var(--person-scale));
      height: 88%; width: auto; object-fit: contain;
      filter: drop-shadow(0 12px 40px rgba(0,0,0,0.5));
    }
    .location {
      position: absolute; z-index: 3;
      left: var(--location-x); top: var(--location-y);
      transform: translateX(-50%);
      font-size: var(--location-size); font-weight: 700; color: rgba(255,255,255,0.8);
      text-align: center; text-transform: uppercase; letter-spacing: 4px; white-space: nowrap;
    }
    .headline {
      position: absolute; z-index: 3;
      left: var(--headline-x); top: var(--headline-y);
      transform: translateX(-50%) rotate(var(--headline-rotation));
      font-size: var(--headline-size); font-weight: 900; color: white;
      text-transform: uppercase; text-shadow: 4px 4px 16px rgba(0,0,0,0.6);
      line-height: 1.0; text-align: center; white-space: nowrap;
    }
    .price-block {
      position: absolute; z-index: 3;
      left: var(--price-block-x); top: var(--price-block-y);
      transform: translateX(-50%) rotate(var(--price-rotation));
      text-align: center;
    }
    .price-row { display: flex; align-items: baseline; justify-content: center; gap: 8px; }
    .price {
      font-size: var(--price-size); font-weight: 900; color: var(--accent-color);
      text-shadow: 0 0 15px var(--accent-color), 0 0 40px var(--accent-color),
        0 0 80px var(--accent-color), 0 0 120px var(--accent-color), 0 2px 4px rgba(0,0,0,0.8);
      line-height: 1.0; letter-spacing: -3px; filter: brightness(1.4);
    }
    .price-unit {
      font-size: var(--price-unit-size); font-weight: 700; color: var(--accent-color);
      text-shadow: 0 0 10px var(--accent-color), 0 0 30px var(--accent-color);
      filter: brightness(1.4);
    }
    .original-price {
      display: inline-block; font-size: var(--strikethrough-size); font-weight: 700;
      color: rgba(255,255,255,0.6); text-decoration: line-through;
      text-decoration-color: var(--accent-color); text-decoration-thickness: 3px; margin-top: 10px;
      text-shadow: 0 2px 8px rgba(0,0,0,0.6);
    }
    .footer-bar {
      position: absolute; z-index: 4; bottom: 0; left: 0; right: 0;
      height: var(--footer-height); background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center; gap: 40px; padding: 0 30px;
    }
    .footer-bar span {
      font-size: 20px; font-weight: 700; color: white;
      text-transform: uppercase; letter-spacing: 2px; white-space: nowrap;
    }
    .footer-separator { width: 6px; height: 6px; background: var(--accent-color); border-radius: 50%; }
  </style>
</head>
<body>
  <div class="creative-container">
    <div class="background"></div>
    <div class="overlay"></div>
    <div class="watermark"><span>{{headline}}</span><span>{{headline}}</span></div>
    <img class="person" src="{{personImage}}" alt="" data-draggable="person">
    <div class="location" data-draggable="location">{{location}}</div>
    <h1 class="headline" data-draggable="headline">{{headline}}</h1>
    <div class="price-block" data-draggable="price-block">
      <div class="price-row">
        <div class="price">{{price}}</div>
        <div class="price-unit">/mtl.</div>
      </div>
      <div class="original-price">Statt {{originalPrice}}</div>
    </div>
    <div class="footer-bar">
      <span>{{location}}</span>
      <div class="footer-separator"></div>
      <span>Jetzt starten</span>
      <div class="footer-separator"></div>
      <span>{{location}}</span>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 4: Create Editorial template (Magazine style)**

Write `public/templates/editorial.html`:

Key differences:
- Person image used as near-fullscreen background (high brightness, minimal blur)
- Heavy gradient overlay from bottom for text legibility
- Headline large at top
- Price as floating accent element
- Premium, editorial feel

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-color: {{primaryColor}};
      --accent-color: {{accentColor}};
      --bg-blur: 2px;
      --bg-brightness: 0.55;
      --headline-size: 94px;
      --price-size: 130px;
      --person-scale: 1.0;
      --person-position-y: -5%;
      --person-position-x: 5%;
      --location-size: 22px;
      --strikethrough-size: 30px;
      --headline-rotation: 0deg;
      --price-rotation: 0deg;
      --content-padding: 40px;
      --location-x: 50%;
      --location-y: 4%;
      --headline-x: 50%;
      --headline-y: 60%;
      --price-block-x: 50%;
      --price-block-y: 78%;
      --watermark-size: 150px;
      --watermark-opacity: 0.04;
      --watermark-rotation: -8deg;
      --price-unit-size: 30px;
      --footer-height: 0px;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    .creative-container {
      width: {{width}}px; height: {{height}}px;
      position: relative; overflow: hidden;
      font-family: 'Montserrat', sans-serif; background: #0a0a0a;
    }
    .background {
      position: absolute; inset: 0;
      background-image: url('{{backgroundImage}}');
      background-size: cover; background-position: center;
      filter: blur(var(--bg-blur)) brightness(var(--bg-brightness));
      transform: scale(1.1);
    }
    .overlay {
      position: absolute; inset: 0;
      background: linear-gradient(
        to bottom,
        rgba(0,0,0,0.1) 0%,
        rgba(0,0,0,0.0) 20%,
        rgba(0,0,0,0.15) 45%,
        rgba(0,0,0,0.7) 70%,
        rgba(0,0,0,0.92) 100%
      );
      z-index: 1;
    }
    .watermark {
      position: absolute; inset: -20%; z-index: 1;
      display: flex; flex-wrap: wrap; align-content: center; justify-content: center; gap: 20px;
      transform: rotate(var(--watermark-rotation)); pointer-events: none;
    }
    .watermark span {
      font-size: var(--watermark-size); font-weight: 900; color: white;
      opacity: var(--watermark-opacity); text-transform: uppercase;
      white-space: nowrap; letter-spacing: 8px; line-height: 1.2;
    }
    .person {
      position: absolute; z-index: 2;
      bottom: var(--person-position-y);
      left: calc(50% + var(--person-position-x));
      transform: translateX(-50%) scale(var(--person-scale));
      height: 80%; width: auto; object-fit: contain;
      filter: drop-shadow(0 8px 30px rgba(0,0,0,0.4));
    }
    .location {
      position: absolute; z-index: 3;
      left: var(--location-x); top: var(--location-y);
      transform: translateX(-50%);
      font-size: var(--location-size); font-weight: 700;
      color: rgba(255,255,255,0.7); text-align: center;
      text-transform: uppercase; letter-spacing: 4px; white-space: nowrap;
    }
    .headline {
      position: absolute; z-index: 3;
      left: var(--headline-x); top: var(--headline-y);
      transform: translateX(-50%) rotate(var(--headline-rotation));
      font-size: var(--headline-size); font-weight: 900; color: white;
      text-transform: uppercase; text-shadow: 3px 3px 12px rgba(0,0,0,0.9);
      line-height: 1.0; text-align: center; white-space: nowrap;
    }
    .price-block {
      position: absolute; z-index: 3;
      left: var(--price-block-x); top: var(--price-block-y);
      transform: translateX(-50%) rotate(var(--price-rotation));
      text-align: center;
    }
    .price-row { display: flex; align-items: baseline; justify-content: center; gap: 6px; }
    .price {
      font-size: var(--price-size); font-weight: 900; color: var(--accent-color);
      text-shadow: 0 0 10px var(--accent-color), 0 0 30px var(--accent-color),
        0 0 60px var(--accent-color), 0 0 100px var(--accent-color), 0 2px 4px rgba(0,0,0,0.8);
      line-height: 1.0; letter-spacing: -2px; filter: brightness(1.3);
    }
    .price-unit {
      font-size: var(--price-unit-size); font-weight: 700; color: var(--accent-color);
      text-shadow: 0 0 10px var(--accent-color), 0 0 30px var(--accent-color);
      filter: brightness(1.3);
    }
    .original-price {
      display: inline-block; font-size: var(--strikethrough-size); font-weight: 700;
      color: rgba(255,255,255,0.6); text-decoration: line-through;
      text-decoration-color: var(--accent-color); text-decoration-thickness: 3px; margin-top: 8px;
      text-shadow: 0 2px 8px rgba(0,0,0,0.8);
    }
    .footer-bar {
      position: absolute; z-index: 4; bottom: 0; left: 0; right: 0;
      height: var(--footer-height); background: transparent;
    }
  </style>
</head>
<body>
  <div class="creative-container">
    <div class="background"></div>
    <div class="overlay"></div>
    <div class="watermark">
      <span>{{headline}}</span><span>{{headline}}</span><span>{{headline}}</span>
      <span>{{headline}}</span><span>{{headline}}</span>
    </div>
    <img class="person" src="{{personImage}}" alt="" data-draggable="person">
    <div class="location" data-draggable="location">{{location}}</div>
    <h1 class="headline" data-draggable="headline">{{headline}}</h1>
    <div class="price-block" data-draggable="price-block">
      <div class="price-row">
        <div class="price">{{price}}</div>
        <div class="price-unit">/mtl.</div>
      </div>
      <div class="original-price">Statt {{originalPrice}}</div>
    </div>
    <div class="footer-bar"></div>
  </div>
</body>
</html>
```

- [ ] **Step 5: Commit templates**

```bash
git add public/templates/split-bold.html public/templates/minimal-light.html public/templates/full-impact.html public/templates/editorial.html
git commit -m "feat: add 4 new master templates (split-bold, minimal-light, full-impact, editorial)"
```

---

## Task 3: Update Seed Script for All 5 Templates

**Files:**
- Modify: `scripts/seed-reference-template.ts`

- [ ] **Step 1: Rewrite seed script to seed all 5 templates**

Replace the full contents of `scripts/seed-reference-template.ts` with a script that reads all 5 HTML files from `public/templates/` and writes corresponding JSON files to `data/templates/`. Each template gets a stable ID (`dark-center`, `split-bold`, `minimal-light`, `full-impact`, `editorial`), a descriptive name, and the correct `cssVariables` extracted from the HTML.

The script should:
1. Define an array of `{ id, name, description, htmlFile }` for all 5 templates
2. For each: read HTML, call `extractCssVariables()`, build `SavedTemplate` JSON, write to `data/templates/{id}.json`
3. Log success for each

Use the existing `extractCssVariables` from `lib/template-utils.ts` and the existing `dynamicFields` array structure.

- [ ] **Step 2: Run seed script**

```bash
npx tsx scripts/seed-reference-template.ts
```

Expected: 5 lines of "Template seeded: ..." output

- [ ] **Step 3: Verify templates exist**

```bash
ls data/templates/
```

Expected: `dark-center.json`, `split-bold.json`, `minimal-light.json`, `full-impact.json`, `editorial.json` (plus any existing user templates)

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-reference-template.ts data/templates/
git commit -m "feat: seed all 5 master templates"
```

---

## Task 4: Create Template Picker Component

**Files:**
- Create: `components/template-picker.tsx`

- [ ] **Step 1: Build visual template picker**

Create `components/template-picker.tsx` — a grid of template cards showing:
- Template name
- Small visual description of the style
- Color-coded accent strip
- Click to select (highlighted border)

```typescript
// components/template-picker.tsx
'use client';

import type { SavedTemplate } from '@/lib/types';

interface TemplatePickerProps {
  templates: SavedTemplate[];
  selected: string;
  onSelect: (templateId: string) => void;
}

const STYLE_HINTS: Record<string, { emoji: string; desc: string; colors: string }> = {
  'dark-center': { emoji: '🌑', desc: 'Dunkel, Person zentral, Neon-Preis', colors: 'from-gray-900 to-gray-800' },
  'split-bold': { emoji: '⚡', desc: 'Person links, Text rechts, farbiger Akzent', colors: 'from-red-900 to-gray-900' },
  'minimal-light': { emoji: '✨', desc: 'Hell, clean, minimalistisch, riesiger Preis', colors: 'from-gray-100 to-white' },
  'full-impact': { emoji: '🔥', desc: 'Farbiger BG, maximale Aufmerksamkeit', colors: 'from-orange-600 to-red-600' },
  'editorial': { emoji: '📸', desc: 'Magazin-Stil, Person als Hintergrund', colors: 'from-gray-800 to-gray-600' },
};

export function TemplatePicker({ templates, selected, onSelect }: TemplatePickerProps) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {templates.map(t => {
        const hint = STYLE_HINTS[t.id] || { emoji: '🎨', desc: t.description || '', colors: 'from-gray-800 to-gray-700' };
        const isSelected = selected === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`text-left p-3 rounded-xl border-2 transition-all ${
              isSelected
                ? 'border-[#FF4500] bg-[#FF4500]/10'
                : 'border-[#333] bg-[#111] hover:border-[#555]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{hint.emoji}</span>
              <div>
                <div className="text-white text-sm font-semibold">{t.name}</div>
                <div className="text-[#888] text-xs">{hint.desc}</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/template-picker.tsx
git commit -m "feat: add visual template picker component"
```

---

## Task 5: Rewrite Campaign Setup

**Files:**
- Modify: `components/campaign-setup.tsx`
- Modify: `lib/types.ts`

- [ ] **Step 1: Add `headlines` field to Campaign type**

In `lib/types.ts`, add `headlines?: string[]` to the Campaign interface (after `backgroundCount`):

```typescript
  backgroundCount?: number;
  headlines?: string[];
  brandStyle?: string;
```

- [ ] **Step 2: Rewrite CampaignConfig and campaign-setup.tsx**

Replace the entire `CampaignConfig` interface and rewrite the component. The new interface:

```typescript
interface CampaignConfig {
  name: string;
  baseTemplateId: string;
  headlines: string[];
  formats: CreativeFormat[];
  defaultValues: Record<string, string>;
  selectedPersons: string[];
  selectedBackgrounds: string[];
  generatePersons: boolean;
  generateBackgrounds: boolean;
  personPrompt: string;
  backgroundPrompt: string;
  personCount: number;
  backgroundCount: number;
  brandColors?: { primaryColor: string; secondaryColor: string; accentColor: string };
  brandStyle?: string;
}
```

Key changes to the component:
- Remove `headlineCount` slider state → replace with `headlines: string[]` state (array of manual headline strings)
- Remove `__ai_generate__` as default `baseTemplateId` → default to first template from loaded list
- Remove `autoGenerate()` function entirely
- Replace `autoGenerate` button with nothing (removed)

**Step 1 UI** becomes:
1. Campaign name
2. Branding section (website URL + color pickers — keep as is)
3. **Template Picker** (import and use `TemplatePicker` component instead of `<select>`)
4. **Manual Headlines** section: 1-5 text inputs with add/remove buttons. Optional "KI Vorschlaege" button.
5. Price + Original Price
6. Format selector (keep as is)
7. Single "Weiter" button to step 2

**Step 2** (Persons) and **Step 3** (Backgrounds) stay mostly the same but person selection is clearly marked as optional ("Ohne Person" option/info).

Update `handleSubmit` to pass `headlines` array instead of `headlineVariantCount`.

Update `totalVariants` calculation: `headlines.length * Math.max(totalPersons, 1) * Math.max(totalBgs, 1)`

- [ ] **Step 3: Update campaigns page to pass new config shape**

In `app/studio/[id]/campaigns/page.tsx`, update the `handleGenerate` config type to match the new `CampaignConfig` (replace `headlineVariantCount` with `headlines`). Store `headlines` on the campaign object.

- [ ] **Step 4: Commit**

```bash
git add components/campaign-setup.tsx lib/types.ts app/studio/[id]/campaigns/page.tsx
git commit -m "feat: rewrite campaign setup with template picker + manual headlines"
```

---

## Task 6: Add Parameter Variation Prompt

**Files:**
- Modify: `lib/prompts.ts`

- [ ] **Step 1: Replace `template-generation` prompt with `parameter-variation` prompt**

In `lib/prompts.ts`, replace the `'template-generation'` key/value with `'parameter-variation'`:

```typescript
'parameter-variation': `Du generierst CSS-Variable-Variationen fuer Fitness-Werbeanzeigen.

Du bekommst eine Liste von CSS-Variablen mit aktuellen Werten und sollst diverse Layout-Variationen erstellen, indem du NUR die Werte aenderst.

REGELN:
- Antworte NUR als JSON-Array von Objekten. Jedes Objekt enthaelt CSS-Variable-Overrides.
- Aendere NUR Positionswerte (--headline-x, --headline-y, --price-block-x, --price-block-y, --location-x, --location-y, --person-position-x, --person-position-y)
- Aendere optional Groessen (--headline-size, --price-size, --person-scale, --watermark-opacity)
- Aendere optional Rotation (--headline-rotation, --price-rotation)
- NIEMALS --primary-color oder --accent-color aendern
- Alle Positionswerte sind Prozent (z.B. "35%", "72%")
- Alle Groessen sind px (z.B. "100px", "140px")
- --person-scale ist eine Dezimalzahl (z.B. "0.85")
- WICHTIG: --price-size muss IMMER mindestens 30% groesser sein als --headline-size
- WICHTIG: Elemente muessen INNERHALB des Canvas bleiben (5%-95% fuer x/y)
- WICHTIG: Jede Variation muss sich DEUTLICH von den anderen unterscheiden

Antworte NUR mit dem JSON-Array. KEIN Markdown, KEINE Erklaerungen.
Beispiel: [{"--headline-y":"35%","--price-block-y":"68%","--person-position-x":"-8%"}]`,
```

Also update the `PromptType` in `lib/types.ts` to replace `'template-generation'` with `'parameter-variation'`:

```typescript
export type PromptType =
  | 'copy-generation'
  | 'parameter-variation'
  | 'template-editing';
```

- [ ] **Step 2: Commit**

```bash
git add lib/prompts.ts lib/types.ts
git commit -m "feat: add parameter-variation prompt, replace template-generation"
```

---

## Task 7: Rewrite Generate Route

**Files:**
- Modify: `app/api/campaigns/[id]/generate/route.ts`

- [ ] **Step 1: Remove `generateLayoutHtml` function, add `generateCssVariations`**

Remove the entire `generateLayoutHtml` function (lines 21-85). Replace with:

```typescript
async function generateCssVariations(
  systemPrompt: string,
  currentVars: Record<string, string>,
  count: number,
): Promise<Record<string, string>[]> {
  const varList = Object.entries(currentVars)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Aktuelle CSS-Variablen:\n${varList}\n\nGeneriere ${count} verschiedene Layout-Variationen als JSON-Array.`,
    }],
  });

  let text = message.content[0].type === 'text' ? message.content[0].text : '[]';
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.slice(0, count) : [];
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]).slice(0, count); } catch { /* fall through */ }
    }
    return [];
  }
}
```

- [ ] **Step 2: Rewrite the main POST handler**

Remove the `isAiGenerate` branch entirely. The new flow:

1. Load campaign + studio + brand colors (keep existing code)
2. Get the base template HTML from `campaign.baseTemplateId` (always a real template now)
3. Collect person images (keep existing code, person is optional — skip if no persons selected and no generation)
4. Collect background images (keep existing code)
5. Get headlines from `campaign.headlines` array (no more AI headline generation as default)
6. Build base field values with color swap logic (keep existing code)
7. Extract CSS variables from template HTML via `extractCssVariables()`
8. Call `generateCssVariations()` to get N parameter variation sets
9. Build variant matrix: for each headline × person × background × css-variation
10. Apply each CSS variation by modifying the template HTML's `:root` values via `getStyledHtml()`

Add a helper to apply CSS overrides to template HTML:

```typescript
function applyCssOverrides(html: string, overrides: Record<string, string>): string {
  let result = html;
  for (const [key, value] of Object.entries(overrides)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(
      new RegExp(`(${escaped}\\s*:\\s*)([^;]+)`),
      `$1${value}`,
    );
  }
  return result;
}
```

Update imports: add `extractCssVariables` from `@/lib/template-utils`. Replace `DEFAULT_PROMPTS['template-generation']` references with `DEFAULT_PROMPTS['parameter-variation']`.

Person images become optional: if `personPaths.length === 0`, create variants with empty `personImage` value.

- [ ] **Step 3: Commit**

```bash
git add app/api/campaigns/[id]/generate/route.ts
git commit -m "feat: rewrite generate route with CSS parameter variation (no AI HTML)"
```

---

## Task 8: Rewrite Regenerate Route

**Files:**
- Modify: `app/api/campaigns/[id]/regenerate/route.ts`

- [ ] **Step 1: Replace HTML regeneration with CSS param variation**

The new regenerate route:
1. Gets the source variant's `templateHtml` and extracts its CSS variables
2. Calls `generateCssVariations()` (same function from generate route — extract to a shared util or inline)
3. For each variation: applies CSS overrides to the source `templateHtml`, creates new variant with same `fieldValues`
4. No more `template-editing` prompt usage — uses `parameter-variation` prompt

Import `extractCssVariables` from template-utils. Remove `normalizeLayoutHtml` import (not needed for master templates). Remove the Anthropic template-editing call.

The user's text prompt (if provided) gets appended to the variation request so the AI can incorporate specific feedback (e.g., "headline groesser, person mehr links").

- [ ] **Step 2: Commit**

```bash
git add app/api/campaigns/[id]/regenerate/route.ts
git commit -m "feat: regenerate uses CSS param variations instead of AI HTML"
```

---

## Task 9: Update Settings Prompt References

**Files:**
- Modify: `app/studio/[id]/settings/page.tsx`

- [ ] **Step 1: Update prompt type references**

In the settings page, the `PROMPT_SECTIONS` array references `'template-generation'`. Update it to `'parameter-variation'` with an appropriate label and description:

```typescript
{ type: 'parameter-variation', label: 'Layout-Variationen', description: 'Steuert wie die AI diverse CSS-Parameter-Variationen fuer Kampagnen generiert' },
```

- [ ] **Step 2: Commit**

```bash
git add app/studio/[id]/settings/page.tsx
git commit -m "fix: update prompt type reference to parameter-variation"
```

---

## Task 10: TypeScript Check + Full Verification

- [ ] **Step 1: TypeScript type check**

```bash
npx tsc --noEmit 2>&1 | grep -v "storage-campaigns.test.ts" | grep -v "missing the following properties" | head -20
```

Expected: No errors (or only pre-existing test errors)

- [ ] **Step 2: Seed templates and verify**

```bash
npx tsx scripts/seed-reference-template.ts
```

Expected: All 5 templates seeded

- [ ] **Step 3: Start dev server and test**

```bash
npm run dev
```

Manual test checklist:
1. Navigate to Campaigns → New Campaign
2. Verify template picker shows all 5 templates with visual previews
3. Select "Full Impact" template
4. Enter 2 headlines manually, price, location
5. Select person images (or skip for no-person creative)
6. Select backgrounds
7. Generate → verify variants appear with professional quality
8. Open editor → drag elements → verify positions persist
9. Render → verify output quality

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve issues found during integration testing"
```

---

## Summary

| Task | What | Files | Est. Time |
|------|------|-------|-----------|
| 1 | Fix sharp DLL | node_modules | 5 min |
| 2 | Create 4 master templates | public/templates/*.html | 15 min |
| 3 | Update seed script | scripts/seed-reference-template.ts | 5 min |
| 4 | Template picker component | components/template-picker.tsx | 5 min |
| 5 | Rewrite campaign setup | campaign-setup.tsx, types.ts, campaigns/page.tsx | 20 min |
| 6 | Parameter variation prompt | prompts.ts, types.ts | 5 min |
| 7 | Rewrite generate route | generate/route.ts | 15 min |
| 8 | Rewrite regenerate route | regenerate/route.ts | 10 min |
| 9 | Update settings refs | settings/page.tsx | 2 min |
| 10 | TypeScript + integration test | — | 10 min |
