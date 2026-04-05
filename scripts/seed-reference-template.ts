import fs from 'fs/promises';
import path from 'path';
import { extractCssVariables } from '../lib/template-utils';
import { getStorage } from '../lib/storage';

// ─── Master template definitions ─────��──────────────────────────────────────

const TEMPLATES = [
  {
    id: 'dark-center',
    name: 'Dark Center (GYMPOD-Stil)',
    description:
      'Dunkler geblurter Gym-Hintergrund, zentriertes Layout mit Neon-Preis und Montserrat Black.',
    htmlFile: 'price-offer-reference.html',
  },
  {
    id: 'split-bold',
    name: 'Split Bold (wellfit-Stil)',
    description:
      'Fetter Split-Screen-Look mit kräftigen Farben und starkem Kontrast.',
    htmlFile: 'split-bold.html',
  },
  {
    id: 'minimal-light',
    name: 'Minimal Light (JONNY M.-Stil)',
    description:
      'Helles, minimalistisches Layout mit viel Weißraum und cleaner Typografie.',
    htmlFile: 'minimal-light.html',
  },
  {
    id: 'full-impact',
    name: 'Full Impact (Vorverkauf-Stil)',
    description:
      'Volle Fläche, maximale Wirkung – großer Preis, kr��ftige Farben, Urgency-Stil.',
    htmlFile: 'full-impact.html',
  },
  {
    id: 'editorial',
    name: 'Editorial (Magazin-Stil)',
    description:
      'Magazin-artiges Layout mit edlem Look und redaktionellem Stil.',
    htmlFile: 'editorial.html',
  },
];

const DYNAMIC_FIELDS = [
  { key: 'headline', label: 'Headline', type: 'text' as const, required: true },
  { key: 'price', label: 'Preis', type: 'text' as const, required: true },
  { key: 'originalPrice', label: 'Streichpreis', type: 'text' as const, required: true },
  { key: 'location', label: 'Standort', type: 'text' as const, required: true },
  { key: 'backgroundImage', label: 'Hintergrundbild', type: 'image' as const, required: true },
  { key: 'personImage', label: 'Person', type: 'image' as const, required: true },
];

// ─── Seed logic ──────────────────────────────────────────���──────────────────

async function seed() {
  const storage = getStorage();
  await storage.init();

  const now = new Date().toISOString();

  for (const tpl of TEMPLATES) {
    const htmlPath = path.join(process.cwd(), 'public/templates', tpl.htmlFile);
    const htmlContent = await fs.readFile(htmlPath, 'utf-8');
    const cssVariables = extractCssVariables(htmlContent);

    await storage.saveTemplate({
      id: tpl.id,
      name: tpl.name,
      description: tpl.description,
      type: 'price-offer',
      htmlContent,
      cssVariables,
      dynamicFields: DYNAMIC_FIELDS,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`Seeded: ${tpl.id}  (${tpl.name})`);
  }

  console.log(`\nDone – ${TEMPLATES.length} templates seeded`);
}

seed();
