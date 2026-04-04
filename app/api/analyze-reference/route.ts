// app/api/analyze-reference/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStorage } from '@/lib/storage';
import { buildFeedbackSummary } from '@/lib/feedback-utils';
import { clampCssVariation } from '@/lib/template-utils';
import type { CampaignStrategy } from '@/lib/types';

const anthropic = new Anthropic();

const VALID_TEMPLATES = ['dark-center', 'split-bold', 'minimal-light', 'full-impact', 'editorial'];

const CAMPAIGN_DIRECTOR_PROMPT = `Du bist ein Elite-Kampagnendirektor fuer Fitness-Werbeanzeigen. Du analysierst ein Referenz-Creative und erstellst eine komplette Kampagnenstrategie.

Du bekommst ein Bild einer professionellen Fitness-Werbeanzeige. Analysiere es und gib eine Kampagnenstrategie als JSON zurueck.

VERFUEGBARE TEMPLATES (waehle das passendste):
1. "dark-center" - Dunkler Hintergrund, Person zentral, Neon-Preis, GYMPOD-Stil
2. "split-bold" - Person links, Text rechts, farbiger Akzent, wellfit-Stil
3. "minimal-light" - Heller Hintergrund, clean, minimalistisch, JONNY M.-Stil
4. "full-impact" - Farbiger Brand-Hintergrund, maximale Aufmerksamkeit, Vorverkauf-Stil
5. "editorial" - Person als Hintergrund, Magazin-Stil, Premium-Look

CSS-VARIABLEN die du setzen kannst (alle Positionen in Prozent, Groessen in px):
- --headline-x, --headline-y: Position der Headline (Standard: 50%, 52%)
- --price-block-x, --price-block-y: Position des Preises (Standard: 50%, 70%)
- --location-x, --location-y: Position des Standorts (Standard: 50%, 4%)
- --person-position-x, --person-position-y: Person-Offset (Standard: 0%, 5%)
- --headline-size: Headline-Groesse (60-140px, Standard: 90px)
- --price-size: Preis-Groesse (80-200px, Standard: 120px, IMMER groesser als Headline!)
- --person-scale: Person-Skalierung (0.5-1.1, Standard: 0.85)
- --watermark-opacity: Watermark-Transparenz (0.0-0.1)
- --bg-blur: Hintergrund-Unschaerfe (0-8px, bei Gesamtbildern mit Person: 0-3px!)
- --bg-brightness: Hintergrund-Helligkeit (0.35-1.0, WICHTIG: bei Gesamtbildern mit Person im Bild mindestens 0.55 damit die Person sichtbar bleibt!)

ANALYSE-AUFGABEN:
1. Erkenne den Layout-Stil und waehle das passendste Template
2. Extrahiere die dominanten Farben (Primary=Hauptfarbe, Accent=hellste/auffaelligste Farbe fuer Preise)
3. Schaetze die Positionen der Elemente als CSS-Variablen-Prozente
4. Beschreibe die kreative Stimmung und den Stil
5. Erkenne ob ein Farbfilter/Tint ueber dem Bild liegt (z.B. roter, blauer, violetter Filter). Wenn JA: setze --bg-brightness auf 0.7-0.9 damit das Bild KLAR bleibt. Wenn KEIN Filter: setze --bg-brightness auf 0.5-0.7.
6. Schreibe einen KOMBINIERTEN Bildgenerierungs-Prompt der Person UND Hintergrund in EINEM Bild erzeugt

WICHTIG: accentColor MUSS immer hell und auffaellig sein (fuer den Neon-Glow-Preis).

STRIKTE LAYOUT-REGELN:
- --headline-y MUSS IMMER KLEINER sein als --price-block-y (Headline ist IMMER UEBER dem Preis!)
- Die Headline darf NIEMALS Gesichter von Personen verdecken. Platziere sie oben (10-22%) oder unten (50-60%).
- Personen muessen IMMER gut erkennbar sein, Gesichter nie von Text ueberdeckt.

BILD-STIL KATEGORIEN (waehle die passendste):
A) "person-scene" - Person MIT Hintergrund in einem Bild (Standard fuer die meisten Fitness-Ads)
B) "environment-only" - NUR Hintergrund/Umgebung OHNE Person (z.B. Gym-Interior, Equipment, Atmosphaere)
C) "abstract-brand" - Abstrakte/grafische Hintergruende passend zur Marke (Farbverlaeufe, Texturen)

Erkenne am Referenz-Bild welche Kategorie passt. Wenn KEINE Person im Referenz-Bild ist, waehle B oder C!

BILD-PROMPT REGELN:
- IMMER "photorealistic" und "real photography" im Prompt verwenden
- NIEMALS Cartoon, Illustration, 3D-Render oder kuenstlerische Stile
- Fuer Kategorie A (person-scene): Person prominent im Vordergrund, gut beleuchtet, scharf
- Fuer Kategorie B (environment-only): Atmosphaerisches Gym/Studio-Foto, professionelle Beleuchtung
- Fuer Kategorie C (abstract-brand): Farbverlaeufe oder Texturen passend zur Markenfarbe

Antworte NUR als JSON-Objekt mit dieser Struktur:
{
  "templateId": "dark-center",
  "templateReason": "Warum dieses Template passt",
  "imageStyle": "person-scene" oder "environment-only" oder "abstract-brand",
  "primaryColor": "#hex",
  "accentColor": "#hex",
  "secondaryColor": "#hex",
  "cssOverrides": { "--headline-y": "35%", "--price-size": "140px", "--bg-brightness": "0.65" },
  "mood": "Stimmungsbeschreibung",
  "headlineStyle": "Headline-Stil Beschreibung",
  "personStyle": "Beschreibung der Person (oder 'keine Person' wenn Kategorie B/C)",
  "backgroundStyle": "Beschreibung des Hintergrunds/der Szene, ob Farbfilter vorhanden",
  "personPrompt": "Beschreibung der Person falls vorhanden, sonst leer",
  "backgroundPrompt": "KOMBINIERTER Prompt fuer das Gesamtbild - passend zur imageStyle Kategorie"
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
