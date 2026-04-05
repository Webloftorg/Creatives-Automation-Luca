// app/api/campaigns/[id]/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStorage } from '@/lib/storage';
import { buildFeedbackSummary } from '@/lib/feedback-utils';
import { DEFAULT_PROMPTS } from '@/lib/prompts';
import { normalizeLayoutHtml, extractCssVariables, clampCssVariation } from '@/lib/template-utils';
import { v4 as uuidv4 } from 'uuid';
import type { Campaign, CampaignVariant } from '@/lib/types';

export const maxDuration = 60;

const anthropic = new Anthropic();

function hexToLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  if (clean.length < 6) return 128;
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

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

async function generateHeadlines(
  systemPrompt: string,
  studioContext: string,
  count: number,
  price?: string,
  originalPrice?: string,
): Promise<{ headline: string; subline?: string }[]> {
  const userMessage = [
    studioContext,
    price ? `Preis: ${price}` : '',
    originalPrice ? `Streichpreis: ${originalPrice}` : '',
    `Generiere genau ${count} Varianten.`,
  ].filter(Boolean).join('\n');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  let text = message.content[0].type === 'text' ? message.content[0].text : '[]';
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.slice(0, count) : [];
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        return Array.isArray(parsed) ? parsed.slice(0, count) : [];
      } catch { /* fall through */ }
    }
    return [];
  }
}

async function detectFacePosition(imagePath: string, studioId: string, req?: NextRequest): Promise<{ x: number; y: number; height: number } | null> {
  try {
    // Fetch image via serve API (works for both filesystem and Supabase)
    const origin = req?.nextUrl.origin || 'http://localhost:3000';
    const imageUrl = `${origin}/api/assets/serve?path=${encodeURIComponent(imagePath)}`;
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return null;
    const imageBuffer = Buffer.from(await imgRes.arrayBuffer());
    const base64 = imageBuffer.toString('base64');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } },
          { type: 'text', text: 'Where is the face/head of the main person in this image? Answer ONLY as JSON: {"x": percent_from_left, "y": percent_from_top, "height": face_height_as_percent_of_image}. If no face visible, answer: {"x":50,"y":50,"height":0}' },
        ],
      }],
    });

    let text = message.content[0].type === 'text' ? message.content[0].text : '';
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    const match = text.match(/\{[^}]+\}/);
    if (match) {
      const pos = JSON.parse(match[0]);
      if (pos.height > 0) {
        console.log(`Face detected at x=${pos.x}%, y=${pos.y}%, height=${pos.height}%`);
        return pos;
      }
    }
  } catch (err) {
    console.warn('Face detection failed:', err instanceof Error ? err.message : err);
  }
  return null;
}

async function generateImage(
  prompt: string,
  studioId: string,
  assetType: 'person' | 'background',
): Promise<string | null> {
  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return null;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1, aspectRatio: assetType === 'background' ? '1:1' : '1:1' },
        }),
      },
    );

    if (!response.ok) return null;
    const data = await response.json();
    const base64Image = data.predictions?.[0]?.bytesBase64Encoded;
    if (!base64Image) return null;

    let buffer = Buffer.from(base64Image, 'base64');

    // Freistellung fuer Personen (pure JS via pngjs - no native dependencies)
    if (assetType === 'person') {
      try {
        const { PNG } = await import('pngjs');
        const png = PNG.sync.read(buffer);
        const { width, height, data: pixels } = png;
        let removedCount = 0;
        const threshold = 220;
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
          if (r > threshold && g > threshold && b > threshold) {
            pixels[i + 3] = 0; // Make transparent
            removedCount++;
          }
        }
        // Edge softening: make near-threshold pixels semi-transparent
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
          if (a > 0) {
            const brightness = (r + g + b) / 3;
            if (brightness > 200 && brightness <= threshold) {
              const fade = Math.round(255 * (1 - (brightness - 200) / (threshold - 200)));
              pixels[i + 3] = Math.min(a, fade);
            }
          }
        }
        buffer = Buffer.from(PNG.sync.write(png));
        console.log(`BG removal: ${removedCount} of ${width * height} pixels made transparent`);
      } catch (err) {
        console.error('BG removal failed:', err instanceof Error ? err.message : err);
      }
    }

    const storage = getStorage();
    await storage.init();
    const assetPath = await storage.uploadAsset(buffer, 'generated.png', studioId, assetType);
    return assetPath;
  } catch (err) {
    console.error('Image generation failed:', err);
    return null;
  }
}

function getAssetUrl(req: NextRequest, assetPath: string): string {
  if (!assetPath) return '';
  const origin = req.nextUrl.origin;
  return `${origin}/api/assets/serve?path=${encodeURIComponent(assetPath)}`;
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storage = getStorage();
  await storage.init();

  const campaign = await storage.getCampaign(id);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const studio = await storage.getStudio(campaign.studioId);
  const brandStyle = campaign.brandStyle || studio?.brandStyle || '';
  const brandColors = campaign.brandColors || {
    primaryColor: studio?.primaryColor || '#FF4500',
    secondaryColor: studio?.secondaryColor || '#1a1a1a',
    accentColor: studio?.accentColor || '#FF6B00',
  };
  const studioContext = [
    studio ? `Studio: ${studio.name}, Standort: ${studio.location}` : '',
    `Farben: Primaer=${brandColors.primaryColor}, Akzent=${brandColors.accentColor}`,
    studio?.defaultFont ? `Font: ${studio.defaultFont}` : '',
    brandStyle ? `Markenstil: ${brandStyle}` : '',
  ].filter(Boolean).join(', ');

  // Load studio feedback for prompt improvement
  const studioFeedback = await storage.listFeedback(campaign.studioId);
  const { summary: feedbackContext } = buildFeedbackSummary(studioFeedback);
  if (feedbackContext) {
    console.log(`Injecting feedback from ${studioFeedback.length} ratings into prompts`);
  }

  const { getEvolvedPrompt } = await import('@/lib/evolved-prompts');
  const copyPrompt = await getEvolvedPrompt(campaign.studioId, 'copy-generation');

  try {
    // 1. Get the base template HTML
    let templateHtml = '';
    if (campaign.baseTemplateId) {
      const baseTemplate = await storage.getTemplate(campaign.baseTemplateId);
      if (baseTemplate) {
        templateHtml = baseTemplate.htmlContent;
      }
    }
    if (!templateHtml) {
      return NextResponse.json({ error: 'Kein Template gefunden' }, { status: 400 });
    }

    // 2. Collect images
    // Strategy: generate combined scene images (person+background together) for best quality
    // Manual: keep person and background separate for flexibility
    const personPaths: string[] = [...(campaign.selectedPersons || [])];
    const bgPaths: string[] = [...(campaign.selectedBackgrounds || [])];
    const brandPromptSuffix = brandStyle
      ? `. Brand style: ${brandStyle}. Colors: primary ${brandColors.primaryColor}, accent ${brandColors.accentColor}.`
      : '';

    const hasStrategyOverrides = campaign.cssStrategyOverrides && Object.keys(campaign.cssStrategyOverrides).length > 0;

    if (hasStrategyOverrides && campaign.generateBackgrounds) {
      // Strategy mode: generate scene images based on strategy
      const count = campaign.backgroundCount || 2;
      const personCtx = campaign.personPrompt?.trim() || '';
      const bgCtx = campaign.backgroundPrompt || 'Modern gym interior with warm lighting';
      const hasPerson = personCtx.length > 0;

      console.log(`Generating ${count} scene images (${hasPerson ? 'with person' : 'no person'})...`);

      for (let i = 0; i < count; i++) {
        let combinedPrompt: string;
        if (hasPerson) {
          combinedPrompt = `Photorealistic real photography: ${personCtx}, prominent in foreground, well-lit and clearly visible. Background: ${bgCtx}${brandPromptSuffix}. Professional advertising campaign photo, studio quality lighting, sharp focus on person. Variation ${i + 1}. NOT illustration, NOT cartoon, NOT 3D render. ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO LOGOS, NO WATERMARKS in the image.`;
        } else {
          combinedPrompt = `Photorealistic real photography: ${bgCtx}${brandPromptSuffix}. Professional advertising photography, atmospheric lighting, high quality. NO people in the image. Variation ${i + 1}. NOT illustration, NOT cartoon, NOT 3D render. ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO LOGOS, NO WATERMARKS in the image.`;
        }
        const path = await generateImage(combinedPrompt, campaign.studioId, 'background');
        if (path) bgPaths.push(path);
      }
    } else {
      // Manual mode: generate person and background separately
      if (campaign.generatePersons && (campaign.personCount || 2) > 0) {
        const count = campaign.personCount || 2;
        console.log(`Generating ${count} person images...`);
        for (let i = 0; i < count; i++) {
          const basePrompt = campaign.personPrompt || 'Fitness trainer, athletic build, smiling, wearing gym clothes, professional studio lighting, solid pure white background, clean sharp edges, full body studio portrait photo';
          const path = await generateImage(
            `${basePrompt}${brandPromptSuffix} Variation ${i + 1}, different person, different look. ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO LOGOS, NO WATERMARKS in the image.`,
            campaign.studioId,
            'person',
          );
          if (path) personPaths.push(path);
        }
      }

      if (campaign.generateBackgrounds && (campaign.backgroundCount || 1) > 0) {
        const count = campaign.backgroundCount || 1;
        console.log(`Generating ${count} background images...`);
        for (let i = 0; i < count; i++) {
          const basePrompt = campaign.backgroundPrompt || 'Modern gym interior, fitness equipment, warm lighting, professional photography';
          const path = await generateImage(
            `${basePrompt}${brandPromptSuffix} Variation ${i + 1}, different angle and lighting. ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO LOGOS, NO WATERMARKS in the image.`,
            campaign.studioId,
            'background',
          );
          if (path) bgPaths.push(path);
        }
      }
    }

    // Fallback
    if (bgPaths.length === 0) bgPaths.push('');

    // 5. Build base field values from studio data + brand colors
    const baseValues: Record<string, string> = {
      ...campaign.defaultValues,
    };
    baseValues.primaryColor = brandColors.primaryColor;
    baseValues.accentColor = brandColors.accentColor;

    // Ensure accent color (used for price neon glow) is bright enough to be visible
    const accentLum = hexToLuminance(brandColors.accentColor);
    const primaryLum = hexToLuminance(brandColors.primaryColor);
    if (accentLum < 100 && primaryLum > accentLum) {
      baseValues.accentColor = brandColors.primaryColor;
      baseValues.primaryColor = brandColors.accentColor;
      console.log(`Color swap: accent ${brandColors.accentColor} (lum=${accentLum.toFixed(0)}) too dark, using primary ${brandColors.primaryColor} (lum=${primaryLum.toFixed(0)})`);
    } else if (accentLum < 100 && primaryLum < 100) {
      baseValues.accentColor = '#FF6B00';
      console.log('Both colors dark, falling back to #FF6B00 for accent');
    }

    if (studio) {
      baseValues.location = baseValues.location || studio.location;
    }

    const variants: CampaignVariant[] = [];

    // 4. Get headlines (manual or AI-generated)
    let headlines: { headline: string }[];
    if (campaign.headlines && campaign.headlines.length > 0) {
      console.log(`Using ${campaign.headlines.length} provided headlines...`);
      headlines = campaign.headlines.map(h => ({ headline: h }));
    } else {
      console.log(`Generating ${campaign.headlineVariantCount} headlines...`);
      const generated = await generateHeadlines(
        copyPrompt, studioContext, campaign.headlineVariantCount,
        campaign.defaultValues.price, campaign.defaultValues.originalPrice,
      );
      headlines = generated.length > 0 ? generated : [
        { headline: 'MONATLICH KUENDBAR' },
        { headline: 'JETZT STARTEN' },
        { headline: 'NUR DIESE WOCHE' },
      ];
    }

    // 5. Apply strategy CSS overrides from reference analysis (if any)
    if (campaign.cssStrategyOverrides && Object.keys(campaign.cssStrategyOverrides).length > 0) {
      // Force scene-friendly values: no blur, high brightness, reduced overlay
      const strategyOverrides: Record<string, string> = {
        ...campaign.cssStrategyOverrides,
        '--bg-blur': '0px',
        '--overlay-opacity': '0.5',
      };
      // Ensure brightness is high enough for scene images (person must be visible)
      const brightnessVal = parseFloat(strategyOverrides['--bg-brightness'] || '0.7');
      if (brightnessVal < 0.6) {
        strategyOverrides['--bg-brightness'] = '0.7';
      }
      templateHtml = applyCssOverrides(templateHtml, strategyOverrides);
      console.log(`Applied ${Object.keys(strategyOverrides).length} strategy CSS overrides (blur=0, brightness>0.5)`);
    }

    // 6. Generate CSS parameter variations for layout diversity
    const templateCssVars = extractCssVariables(templateHtml);
    let paramPrompt = await getEvolvedPrompt(campaign.studioId, 'parameter-variation');
    if (feedbackContext) {
      paramPrompt += '\n\n' + feedbackContext;
    }

    // Keep variation count low for consistency - 2 subtle layout tweaks max
    const variationCount = 2;
    let cssVariations: Record<string, string>[] = [];
    try {
      cssVariations = await generateCssVariations(paramPrompt, templateCssVars, variationCount);
      console.log(`Generated ${cssVariations.length} CSS parameter variations`);
    } catch (err) {
      console.warn('CSS variation generation failed, using defaults:', err);
    }

    // Always include the original (no overrides) as first variation
    // In strategy mode: strip blur from variations to keep person sharp
    const cleanedVariations = hasStrategyOverrides
      ? cssVariations.map(v => { const c = { ...v }; delete c['--bg-blur']; return c; })
      : cssVariations;
    const allVariations = [{}, ...cleanedVariations];

    // 7. Detect face positions in scene images (once per image, for headline avoidance)
    const facePositions: Map<string, { x: number; y: number; height: number }> = new Map();
    if (hasStrategyOverrides) {
      for (const bgPath of bgPaths) {
        if (bgPath) {
          const face = await detectFacePosition(bgPath, campaign.studioId, _req);
          if (face) facePositions.set(bgPath, face);
        }
      }
    }

    // 8. Build variants matrix
    const scenePaths = personPaths.length > 0 ? personPaths : [''];

    for (const headlineObj of headlines) {
      for (const bgPath of bgPaths) {
        const bgUrl = getAssetUrl(_req, bgPath);

        // Adjust headline position to avoid face
        const face = facePositions.get(bgPath);
        let faceAvoidOverride: Record<string, string> = {};
        if (face) {
          const faceTop = face.y - face.height / 2;
          const faceBottom = face.y + face.height / 2;
          const currentHeadlineY = parseFloat(
            extractCssVariables(templateHtml)['--headline-y'] || '52'
          );
          // Check if headline overlaps face zone (with margin)
          const margin = 8;
          if (currentHeadlineY > faceTop - margin && currentHeadlineY < faceBottom + margin) {
            // Move headline above or below face
            if (faceTop > 40) {
              // Face is lower - put headline above
              faceAvoidOverride['--headline-y'] = `${Math.max(10, faceTop - 25)}%`;
            } else {
              // Face is upper - put headline below
              faceAvoidOverride['--headline-y'] = `${Math.min(65, faceBottom + 10)}%`;
            }
            console.log(`Adjusted headline from ${currentHeadlineY}% to ${faceAvoidOverride['--headline-y']} to avoid face at ${face.y}%`);
          }
        }

        for (const personPath of scenePaths) {
          const personUrl = getAssetUrl(_req, personPath);

          for (const rawOverride of allVariations) {
            const mergedOverride = { ...rawOverride, ...faceAvoidOverride };
            const cssOverride = clampCssVariation(mergedOverride);
            const variantHtml = Object.keys(cssOverride).length > 0
              ? applyCssOverrides(templateHtml, cssOverride)
              : templateHtml;

            variants.push({
              id: uuidv4(),
              templateHtml: variantHtml,
              fieldValues: {
                ...baseValues,
                headline: headlineObj.headline,
                personImage: personUrl,
                backgroundImage: bgUrl,
              },
              approved: true,
              outputs: [],
            });
          }
        }
      }
    }

    // 7. Update campaign
    campaign.variants = variants;
    campaign.status = 'reviewing';
    campaign.updatedAt = new Date().toISOString();
    await storage.saveCampaign(campaign);

    return NextResponse.json(campaign);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Generation failed';
    console.error('Campaign generation error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
