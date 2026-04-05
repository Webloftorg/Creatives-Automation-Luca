// app/api/campaigns/[id]/regenerate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { extractCssVariables, clampCssVariation } from '@/lib/template-utils';
import { v4 as uuidv4 } from 'uuid';
import type { CampaignVariant } from '@/lib/types';

export const maxDuration = 60;

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

async function generateSimilarImage(
  originalBgUrl: string,
  studioId: string,
  req: NextRequest,
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey || !originalBgUrl) return null;

  try {
    // Describe the original image style via Claude, then generate similar
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic();

    // Fetch the original image to analyze its style
    const origin = req.nextUrl.origin;
    const imgUrl = originalBgUrl.startsWith('http') ? originalBgUrl : `${origin}${originalBgUrl}`;
    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) return null;
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const base64 = imgBuffer.toString('base64');

    // Ask Claude to describe the style for re-generation
    const analysis = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: 'Describe this fitness ad background photo in 1-2 sentences for regenerating a SIMILAR but not identical image. Focus on: lighting, setting, colors, mood, person pose/type if visible. Be specific about the style. Answer in English only. NO text descriptions, just visual style.' },
        ],
      }],
    });

    const styleDesc = analysis.content[0].type === 'text' ? analysis.content[0].text : '';
    if (!styleDesc) return null;

    // Generate similar image
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: `Photorealistic real photography, similar style: ${styleDesc}. Professional fitness advertising photo, high quality. Slight variation in angle/pose/lighting. ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO LOGOS in the image.` }],
          parameters: { sampleCount: 1, aspectRatio: '1:1' },
        }),
      },
    );

    if (!response.ok) return null;
    const data = await response.json();
    const base64Image = data.predictions?.[0]?.bytesBase64Encoded;
    if (!base64Image) return null;

    const buffer = Buffer.from(base64Image, 'base64');
    const storage = getStorage();
    await storage.init();
    return await storage.uploadAsset(buffer, 'regenerated.png', studioId, 'background');
  } catch (err) {
    console.error('Similar image generation failed:', err);
    return null;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { variantId, count, mode } = body as {
    variantId: string;
    count?: number;
    mode?: 'vary-style' | 'duplicate-vary';
  };

  const storage = getStorage();
  await storage.init();

  const campaign = await storage.getCampaign(id);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const sourceVariant = campaign.variants.find(v => v.id === variantId);
  if (!sourceVariant) return NextResponse.json({ error: 'Variant not found' }, { status: 404 });

  const numVariants = Math.min(count || 2, 4);
  const currentVars = extractCssVariables(sourceVariant.templateHtml);
  const origin = req.nextUrl.origin;

  const newVariants: CampaignVariant[] = [];

  if (mode === 'duplicate-vary') {
    // ── Duplicate & Vary: Keep everything, only subtle CSS tweaks ──
    // Small random adjustments to a few variables
    const tweakableVars = ['--headline-size', '--price-size', '--price-glow', '--bg-brightness', '--overlay-opacity'];

    for (let i = 0; i < numVariants; i++) {
      const tweaks: Record<string, string> = {};
      // Pick 2-3 random vars to tweak slightly
      const shuffled = tweakableVars.sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 2));
      for (const varName of shuffled) {
        const current = parseFloat(currentVars[varName] || '0');
        const jitter = current * (0.85 + Math.random() * 0.3); // ±15%
        if (varName.includes('size')) {
          tweaks[varName] = `${Math.round(jitter)}px`;
        } else {
          tweaks[varName] = String(Math.round(jitter * 100) / 100);
        }
      }

      const clamped = clampCssVariation(tweaks);
      const variantHtml = applyCssOverrides(sourceVariant.templateHtml, clamped);
      newVariants.push({
        id: uuidv4(),
        templateHtml: variantHtml,
        fieldValues: { ...sourceVariant.fieldValues },
        approved: true,
        outputs: [],
      });
    }
  } else {
    // ── More in this Style: Generate new similar background + subtle CSS tweaks ──
    for (let i = 0; i < numVariants; i++) {
      // Generate a similar background image
      const bgUrl = sourceVariant.fieldValues.backgroundImage || '';
      const newBgPath = await generateSimilarImage(bgUrl, campaign.studioId, req);

      const newFieldValues = { ...sourceVariant.fieldValues };
      if (newBgPath) {
        newFieldValues.backgroundImage = `${origin}/api/assets/serve?path=${encodeURIComponent(newBgPath)}`;
      }

      // Subtle CSS tweaks (keep very close to source)
      const subtleTweaks: Record<string, string> = {};
      const brightness = parseFloat(currentVars['--bg-brightness'] || '0.75');
      subtleTweaks['--bg-brightness'] = String(Math.round((brightness + (Math.random() * 0.1 - 0.05)) * 100) / 100);
      const glow = parseFloat(currentVars['--price-glow'] || '0.5');
      subtleTweaks['--price-glow'] = String(Math.round((glow + (Math.random() * 0.1 - 0.05)) * 100) / 100);

      const clamped = clampCssVariation(subtleTweaks);
      const variantHtml = applyCssOverrides(sourceVariant.templateHtml, clamped);

      newVariants.push({
        id: uuidv4(),
        templateHtml: variantHtml,
        fieldValues: newFieldValues,
        approved: true,
        outputs: [],
      });
    }
  }

  campaign.variants.push(...newVariants);
  campaign.updatedAt = new Date().toISOString();
  await storage.saveCampaign(campaign);

  return NextResponse.json({ newVariants, campaign });
}
