import fs from 'fs/promises';
import path from 'path';

const template = {
  id: 'reference-price-offer',
  name: 'Preis-Angebot (Referenz-Stil)',
  description: 'Der bewährte Stil aus den Referenz-Creatives. Orange Preis auf dunklem Balken, Montserrat Black, geblurter Gym-Hintergrund.',
  studioId: undefined,
  type: 'price-offer',
  htmlContent: '',
  cssVariables: {
    '--bg-blur': '6px',
    '--bg-brightness': '0.35',
    '--headline-size': '72px',
    '--price-size': '96px',
    '--person-scale': '0.85',
    '--person-position-y': '5%',
    '--person-position-x': '0%',
    '--location-size': '28px',
    '--strikethrough-size': '28px',
    '--headline-rotation': '0deg',
    '--price-rotation': '0deg',
    '--content-padding': '40px',
    '--location-x': '50%',
    '--location-y': '4%',
    '--headline-x': '50%',
    '--headline-y': '62%',
    '--price-block-x': '50%',
    '--price-block-y': '78%',
  },
  dynamicFields: [
    { key: 'headline', label: 'Headline', type: 'text', required: true },
    { key: 'price', label: 'Preis', type: 'text', required: true },
    { key: 'originalPrice', label: 'Streichpreis', type: 'text', required: true },
    { key: 'location', label: 'Standort', type: 'text', required: true },
    { key: 'backgroundImage', label: 'Hintergrundbild', type: 'image', required: true },
    { key: 'personImage', label: 'Person', type: 'image', required: true },
  ],
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

async function seed() {
  const htmlPath = path.join(process.cwd(), 'public/templates/price-offer-reference.html');
  template.htmlContent = await fs.readFile(htmlPath, 'utf-8');

  const outDir = path.join(process.cwd(), 'data/templates');
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    path.join(outDir, `${template.id}.json`),
    JSON.stringify(template, null, 2),
  );
  console.log('Reference template seeded.');
}

seed();
