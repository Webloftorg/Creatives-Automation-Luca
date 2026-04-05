// app/api/analyze-reference/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStorage } from '@/lib/storage';
import { buildFeedbackSummary } from '@/lib/feedback-utils';
import { clampCssVariation } from '@/lib/template-utils';
import type { CampaignStrategy } from '@/lib/types';

const anthropic = new Anthropic();

const VALID_TEMPLATES = ['dark-center', 'minimal-light', 'full-impact', 'editorial'];

const CAMPAIGN_DIRECTOR_PROMPT = `Du bist ein Elite-Kampagnendirektor und Verkaufspsychologe fuer Fitness-Werbeanzeigen. Du planst die KOMPLETTE visuelle Nutzerfuehrung eines Werbecreatives.

Du bekommst ein Referenz-Bild. Deine Aufgabe: Analysiere es und plane eine Kampagne die den Betrachter in unter 2 Sekunden zum Handeln bringt.

VERKAUFSPSYCHOLOGISCHE NUTZERFUEHRUNG (STRIKT):
Der Blick des Betrachters wird von oben nach unten gefuehrt:
1. LOCATION (oben, 3-6%) → "Ah, das ist fuer MICH" (lokaler Bezug, Vertrauen)
2. HEADLINE (darunter, 12-50%) → "Das klingt gut!" (emotionaler Hook, Scroll-Stopper)
3. PREIS-BLOCK (unten, 60-80%) → "Das muss ich haben!" (Angebot, Call-to-Action)
4. PERSON (emotional) → Spiegelneuronen, Identifikation, Aspiration

Diese Hierarchie ist NICHT verhandelbar. Location IMMER oben-mitte, Headline IMMER ueber dem Preis.

VERFUEGBARE TEMPLATES:
1. "dark-center" - Dunkler Hintergrund, Person zentral, Neon-Preis, GYMPOD-Stil
2. "minimal-light" - Heller Hintergrund, clean, minimalistisch, JONNY M.-Stil
3. "full-impact" - Farbiger Brand-Hintergrund, maximale Aufmerksamkeit, Vorverkauf-Stil
4. "editorial" - Person als Hintergrund, Magazin-Stil, Premium-Look

CSS-VARIABLEN (Positionen in %, Groessen in px):
- --location-x: IMMER "50%" (zentriert), --location-y: "3%" bis "6%" (oben)
- --headline-x: "50%" (zentriert), --headline-y: "12%" bis "50%"
- --price-block-x: "50%", --price-block-y: "60%" bis "80%"
- --headline-size: 60-140px, --price-size: 80-200px (IMMER > headline!)
- --price-glow: 0.3-0.6 (Neon-Intensitaet, NICHT ueber 0.6 - sonst unleserlich!)
- --person-scale: 0.5-1.1, --person-position-x/y
- --bg-blur: 0-8px, --bg-brightness: 0.35-1.0
- --overlay-opacity: Filterstaerke (0.2-0.8)

LAYOUT-REGELN:
- --headline-y MUSS KLEINER sein als --price-block-y (mindestens 15% Abstand!)
- --location-y IMMER 3-6%, --location-x IMMER 50%
- Headline darf NIEMALS Gesichter verdecken
- --price-glow maximal 0.6 fuer gute Lesbarkeit

BILD-KATEGORIEN:
A) "person-scene" - Person MIT Hintergrund zusammen (Standard)
B) "environment-only" - NUR Hintergrund, KEINE Person
C) "abstract-brand" - Abstrakte Marken-Hintergruende

BILD-PROMPT REGELN:
- IMMER "photorealistic real photography"
- NIEMALS Cartoon/Illustration/3D-Render
- ABSOLUT KEIN TEXT, KEINE BUCHSTABEN, KEINE WOERTER, KEINE LOGOS im generierten Bild!
  Nur unser HTML-Template fuegt Text hinzu.

Antworte NUR als JSON-Objekt:
{
  "templateId": "dark-center",
  "templateReason": "Warum + wie es den Betrachter fuehrt",
  "imageStyle": "person-scene",
  "primaryColor": "#hex",
  "accentColor": "#hex (MUSS hell/auffaellig sein fuer Preis-Glow)",
  "secondaryColor": "#hex",
  "cssOverrides": { "--headline-y": "18%", "--price-block-y": "68%", "--price-glow": "0.4", "--location-y": "4%" },
  "mood": "Stimmung",
  "headlineStyle": "Stil + verkaufspsychologische Wirkung",
  "personStyle": "Person-Beschreibung oder 'keine Person'",
  "backgroundStyle": "Hintergrund + Atmosphaere",
  "personPrompt": "Prompt fuer Person (oder leer)",
  "backgroundPrompt": "Prompt fuer Gesamtbild"
}

KEIN Markdown, KEINE Erklaerungen. NUR das JSON-Objekt.`;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const imageFile = formData.get('image') as File | null;
  const studioId = formData.get('studioId') as string | null;

  if (!imageFile) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }

  try {
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mediaType = imageFile.type === 'image/png' ? 'image/png' : 'image/jpeg';

    let studioContext = '';
    if (studioId) {
      const storage = getStorage();
      await storage.init();
      const studio = await storage.getStudio(studioId);
      if (studio) {
        studioContext = `\nStudio: ${studio.name}, Standort: ${studio.location}`;
      }
      const feedback = await storage.listFeedback(studioId);
      const { summary: feedbackCtx } = buildFeedbackSummary(feedback);
      if (feedbackCtx) {
        studioContext += '\n\n' + feedbackCtx;
      }
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: CAMPAIGN_DIRECTOR_PROMPT,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Analysiere dieses Referenz-Creative und erstelle eine Kampagnenstrategie.${studioContext}`,
          },
        ],
      }],
    });

    let text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    let strategy: CampaignStrategy;
    try {
      strategy = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        strategy = JSON.parse(match[0]);
      } else {
        return NextResponse.json({ error: 'Failed to parse strategy' }, { status: 500 });
      }
    }

    if (!VALID_TEMPLATES.includes(strategy.templateId)) {
      strategy.templateId = 'dark-center';
    }

    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    if (!hexPattern.test(strategy.primaryColor)) strategy.primaryColor = '#FF4500';
    if (!hexPattern.test(strategy.accentColor)) strategy.accentColor = '#FF6B00';
    if (!hexPattern.test(strategy.secondaryColor)) strategy.secondaryColor = '#1a1a1a';

    if (strategy.cssOverrides) {
      strategy.cssOverrides = clampCssVariation(strategy.cssOverrides);
    } else {
      strategy.cssOverrides = {};
    }

    return NextResponse.json(strategy);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analysis failed';
    console.error('Reference analysis error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
