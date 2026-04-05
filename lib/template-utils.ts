import type { DynamicField } from './types';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const RAW_KEYS = new Set(['backgroundImage', 'personImage', 'logo', 'primaryColor', 'accentColor', 'secondaryColor', 'width', 'height']);

// Keys where newlines should become <br> for manual line breaks
const MULTILINE_KEYS = new Set(['headline']);

export function replacePlaceholders(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = values[key] ?? '';
    if (RAW_KEYS.has(key)) return val;
    let escaped = escapeHtml(val);
    if (MULTILINE_KEYS.has(key)) {
      // Each line break gets a hyphen at the end of the previous line
      escaped = escaped.replace(/\n/g, '-<br>');
    }
    return escaped;
  });
}

export function extractPlaceholders(html: string): string[] {
  const matches = html.matchAll(/\{\{(\w+)\}\}/g);
  const keys = new Set<string>();
  for (const match of matches) {
    keys.add(match[1]);
  }
  return Array.from(keys);
}

export function extractCssVariables(html: string): Record<string, string> {
  const rootMatch = html.match(/:root\s*\{([^}]+)\}/);
  if (!rootMatch) return {};
  const vars: Record<string, string> = {};
  const lines = rootMatch[1].split(';');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('--')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();
    const commentIdx = value.indexOf('/*');
    if (commentIdx !== -1) value = value.slice(0, commentIdx).trim();
    if (!value.startsWith('{{')) {
      vars[key] = value;
    }
  }
  return vars;
}

const IMAGE_KEYS = new Set(['backgroundImage', 'personImage', 'logo']);
const COLOR_KEYS = new Set(['primaryColor', 'secondaryColor', 'accentColor']);
const SYSTEM_KEYS = new Set(['width', 'height']);

export function placeholdersToDynamicFields(keys: string[]): DynamicField[] {
  return keys
    .filter(key => !SYSTEM_KEYS.has(key))
    .map(key => ({
      key,
      label: camelToTitle(key),
      type: IMAGE_KEYS.has(key) ? 'image' as const : COLOR_KEYS.has(key) ? 'color' as const : 'text' as const,
      required: true,
    }));
}

function camelToTitle(str: string): string {
  return str.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}

// ─── AI Template Normalization ───────────────────────────────────────────────

const REQUIRED_CSS_VARS: Record<string, string> = {
  '--bg-blur': '6px',
  '--bg-brightness': '0.75',
  '--headline-size': '90px',
  '--price-size': '120px',
  '--person-scale': '0.85',
  '--person-position-y': '5%',
  '--person-position-x': '0%',
  '--location-size': '35px',
  '--strikethrough-size': '35px',
  '--headline-rotation': '0deg',
  '--price-rotation': '0deg',
  '--content-padding': '40px',
  '--location-x': '50%',
  '--location-y': '4%',
  '--headline-x': '50%',
  '--headline-y': '12%',
  '--price-block-x': '50%',
  '--price-block-y': '72%',
  '--watermark-size': '180px',
  '--watermark-opacity': '0.06',
  '--watermark-rotation': '-15deg',
  '--price-unit-size': '32px',
  '--footer-height': '60px',
  '--overlay-opacity': '0.3',
  '--overlay-color': '0, 0, 0',
  '--headline-wrap': 'normal',
  '--price-glow': '0.5',
};

const MIN_PX_SIZES: Record<string, number> = {
  '--headline-size': 60,
  '--price-size': 100,
  '--location-size': 24,
  '--strikethrough-size': 20,
  '--watermark-size': 100,
  '--footer-height': 45,
  '--price-unit-size': 20,
};

const MIN_SCALES: Record<string, number> = {
  '--person-scale': 0.5,
};

function ensureRootCssVariables(html: string): string {
  const rootMatch = html.match(/:root\s*\{([^}]+)\}/);

  if (!rootMatch) {
    // No :root block - inject one into <style> or create <style>
    const varsBlock = Object.entries(REQUIRED_CSS_VARS)
      .map(([k, v]) => `      ${k}: ${v};`)
      .join('\n');
    const rootBlock = `\n    :root {\n${varsBlock}\n    }\n`;

    if (html.includes('<style>')) {
      return html.replace('<style>', `<style>${rootBlock}`);
    } else if (html.includes('</head>')) {
      return html.replace('</head>', `<style>${rootBlock}</style>\n</head>`);
    }
    return `<style>${rootBlock}</style>\n${html}`;
  }

  // Parse existing vars
  const existingVars: Record<string, string> = {};
  const lines = rootMatch[1].split(';');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('--')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    existingVars[trimmed.slice(0, colonIdx).trim()] = trimmed.slice(colonIdx + 1).trim();
  }

  // Add missing vars
  const missing: string[] = [];
  for (const [key, defaultVal] of Object.entries(REQUIRED_CSS_VARS)) {
    if (!(key in existingVars)) {
      missing.push(`      ${key}: ${defaultVal};`);
    }
  }

  if (missing.length === 0) return html;

  // Inject missing vars at the end of :root
  const insertPoint = rootMatch.index! + rootMatch[0].lastIndexOf('}');
  return html.slice(0, insertPoint) + '\n' + missing.join('\n') + '\n    ' + html.slice(insertPoint);
}

function enforceMinimumSizes(html: string): string {
  let result = html;

  for (const [varName, minPx] of Object.entries(MIN_PX_SIZES)) {
    const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(${escaped}\\s*:\\s*)(\\d+(?:\\.\\d+)?)(px)`, 'g');
    result = result.replace(pattern, (match, prefix, numStr, unit) => {
      const num = parseFloat(numStr);
      return num < minPx ? `${prefix}${minPx}${unit}` : match;
    });
  }

  for (const [varName, minScale] of Object.entries(MIN_SCALES)) {
    const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(${escaped}\\s*:\\s*)(\\d+(?:\\.\\d+)?)([;\\s])`, 'g');
    result = result.replace(pattern, (match, prefix, numStr, suffix) => {
      const num = parseFloat(numStr);
      return num < minScale ? `${prefix}${minScale}${suffix}` : match;
    });
  }

  return result;
}

function enforceHierarchy(html: string): string {
  let result = html;

  // Rule 1: Price size must be at least 30% larger than headline
  const headlineSizeMatch = result.match(/--headline-size\s*:\s*(\d+)px/);
  const priceSizeMatch = result.match(/--price-size\s*:\s*(\d+)px/);
  if (headlineSizeMatch && priceSizeMatch) {
    const headlinePx = parseInt(headlineSizeMatch[1]);
    const pricePx = parseInt(priceSizeMatch[1]);
    const minPrice = Math.round(headlinePx * 1.3);
    if (pricePx < minPrice) {
      result = result.replace(/--price-size\s*:\s*\d+px/, `--price-size: ${minPrice}px`);
    }
  }

  // Rule 2: Headline must ALWAYS be ABOVE price (lower y% = higher on screen)
  const headlineYMatch = result.match(/--headline-y\s*:\s*(\d+(?:\.\d+)?)%/);
  const priceYMatch = result.match(/--price-block-y\s*:\s*(\d+(?:\.\d+)?)%/);
  if (headlineYMatch && priceYMatch) {
    const headlineY = parseFloat(headlineYMatch[1]);
    const priceY = parseFloat(priceYMatch[1]);
    if (headlineY >= priceY) {
      // Headline is below or at same level as price - move headline above
      const newHeadlineY = Math.max(10, priceY - 20);
      result = result.replace(/--headline-y\s*:\s*\d+(?:\.\d+)?%/, `--headline-y: ${newHeadlineY}%`);
    }
  }

  return result;
}

function ensureDraggableAttr(html: string, classPattern: RegExp, id: string): string {
  if (html.includes(`data-draggable="${id}"`)) return html;
  // Match opening tag with the class, inject data-draggable before the closing >
  return html.replace(classPattern, (match) => {
    if (match.includes('data-draggable')) return match;
    return match + ` data-draggable="${id}"`;
  });
}

function ensureDraggableAttributes(html: string): string {
  let result = html;

  // By class name patterns
  result = ensureDraggableAttr(result, /(<(?:h[1-6]|div|span)[^>]*\bclass="[^"]*\bheadline\b[^"]*")(?=[^>]*>)/gi, 'headline');
  result = ensureDraggableAttr(result, /(<div[^>]*\bclass="[^"]*\bprice-block\b[^"]*")(?=[^>]*>)/gi, 'price-block');
  result = ensureDraggableAttr(result, /(<(?:div|span)[^>]*\bclass="[^"]*\blocation\b[^"]*")(?=[^>]*>)/gi, 'location');
  result = ensureDraggableAttr(result, /(<img[^>]*\bclass="[^"]*\bperson\b[^"]*")(?=[^>]*>)/gi, 'person');

  // Fallback: by placeholder content if class-based didn't match
  if (!result.includes('data-draggable="headline"')) {
    // Find element wrapping {{headline}} - look for the nearest opening tag
    result = result.replace(/(<(?:h[1-6]|div|span)\b[^>]*)>([\s]*\{\{headline\}\})/i, '$1 data-draggable="headline">$2');
  }
  if (!result.includes('data-draggable="location"')) {
    result = result.replace(/(<(?:div|span)\b[^>]*)>([\s]*\{\{location\}\})/i, '$1 data-draggable="location">$2');
  }
  if (!result.includes('data-draggable="person"')) {
    result = result.replace(/(<img\b[^>]*\{\{personImage\}\}[^>]*)(?=>)/i, '$1 data-draggable="person"');
  }

  return result;
}

function ensureCreativeContainer(html: string): string {
  if (html.includes('creative-container')) return html;
  // Add to the first div inside <body>
  const bodyMatch = html.match(/(<body[^>]*>\s*<div\b)([^>]*)(>)/i);
  if (bodyMatch) {
    const attrs = bodyMatch[2];
    if (attrs.includes('class="')) {
      return html.replace(bodyMatch[0], bodyMatch[1] + attrs.replace('class="', 'class="creative-container ') + bodyMatch[3]);
    }
    return html.replace(bodyMatch[0], bodyMatch[1] + ' class="creative-container"' + attrs + bodyMatch[3]);
  }
  return html;
}

function ensureNeonGlow(html: string): string {
  // Controllable glow via --price-glow (0 = clean text, 1 = extreme neon)
  // Multipliers are large so the slider has real visible impact
  const neonStyle = `
<style>
  .price {
    color: var(--accent-color) !important;
    text-shadow:
      0 0 calc(20px * var(--price-glow, 0.5)) var(--accent-color),
      0 0 calc(60px * var(--price-glow, 0.5)) var(--accent-color),
      0 0 calc(120px * var(--price-glow, 0.5)) var(--accent-color),
      0 0 calc(200px * var(--price-glow, 0.5)) var(--accent-color),
      0 2px 4px rgba(0,0,0,0.8) !important;
    filter: brightness(calc(1 + 0.6 * var(--price-glow, 0.5))) !important;
  }
</style>`;

  // Remove old hardcoded neon style if present
  let result = html.replace(/<style>\s*\.price\s*\{[^}]*0 0 60px var\(--accent-color\)[^}]*\}\s*<\/style>/g, '');

  if (result.includes('</head>')) {
    return result.replace('</head>', `${neonStyle}\n</head>`);
  }
  return neonStyle + result;
}

// ─── CSS Variation Clamping ──────────────────────────────────────────────────

const POSITION_BOUNDS: Record<string, [number, number]> = {
  '--headline-x': [40, 60],
  '--headline-y': [5, 18],       // TOP ZONE ONLY - never over faces (faces are 25-55%)
  '--price-block-x': [35, 65],
  '--price-block-y': [65, 82],   // BOTTOM ZONE ONLY - below person
  '--location-x': [45, 55],     // Always centered
  '--location-y': [2, 6],       // Always top, just below edge
  '--person-position-x': [-25, 25],
  '--person-position-y': [-5, 15],
};

const SIZE_BOUNDS: Record<string, [number, number]> = {
  '--headline-size': [60, 140],
  '--price-size': [80, 200],
  '--person-scale': [0.5, 1.1],
  '--location-size': [18, 50],
  '--watermark-opacity': [0.0, 0.1],
  '--bg-brightness': [0.5, 1.0],
  '--bg-blur': [0, 8],
  '--overlay-opacity': [0, 1],
  '--price-glow': [0, 2],
};

/**
 * Clamps AI-generated CSS variation values to safe ranges.
 * Prevents elements from going off-canvas or becoming too small/large.
 * Enforces minimum spacing between headline, price-block, and location.
 */
export function clampCssVariation(overrides: Record<string, string>): Record<string, string> {
  const clamped: Record<string, string> = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (key.includes('color')) continue;
    const numMatch = value.match(/^(-?\d+(?:\.\d+)?)/);
    if (!numMatch) { clamped[key] = value; continue; }
    const num = parseFloat(numMatch[1]);
    const bounds = POSITION_BOUNDS[key] || SIZE_BOUNDS[key];
    if (bounds) {
      const clampedNum = Math.max(bounds[0], Math.min(bounds[1], num));
      clamped[key] = value.replace(numMatch[1], String(Math.round(clampedNum * 100) / 100));
    } else {
      clamped[key] = value;
    }
  }

  // Enforce minimum vertical spacing between elements (at least 15% apart)
  const MIN_GAP = 15;
  const locationY = parseFloat(clamped['--location-y'] || '') || -1;
  let headlineY = parseFloat(clamped['--headline-y'] || '') || -1;
  let priceY = parseFloat(clamped['--price-block-y'] || '') || -1;

  if (headlineY >= 0 && priceY >= 0) {
    // Headline must be above price with enough gap
    if (priceY - headlineY < MIN_GAP) {
      priceY = headlineY + MIN_GAP;
      if (priceY > 85) { priceY = 85; headlineY = priceY - MIN_GAP; }
      clamped['--headline-y'] = `${Math.round(headlineY)}%`;
      clamped['--price-block-y'] = `${Math.round(priceY)}%`;
    }
  }

  if (locationY >= 0 && headlineY >= 0 && headlineY - locationY < 8 && headlineY - locationY >= 0) {
    clamped['--location-y'] = `${Math.max(3, Math.round(headlineY - 10))}%`;
  }

  return clamped;
}

/**
 * Post-processes AI-generated HTML templates to ensure:
 * 1. All required CSS variables exist in :root
 * 2. Minimum sizes are enforced (headline >= 60px, price >= 80px, etc.)
 * 3. data-draggable attributes on key elements (for drag & select)
 * 4. creative-container class on root element
 * 5. Neon glow CSS on price element
 */
export function normalizeLayoutHtml(html: string): string {
  let result = html;
  result = ensureRootCssVariables(result);
  result = enforceMinimumSizes(result);
  result = enforceHierarchy(result);
  result = ensureCreativeContainer(result);
  result = ensureDraggableAttributes(result);
  result = ensureNeonGlow(result);
  return result;
}
