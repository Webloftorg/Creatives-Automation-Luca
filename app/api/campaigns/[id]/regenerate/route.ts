// app/api/campaigns/[id]/regenerate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStorage } from '@/lib/storage';
import { DEFAULT_PROMPTS } from '@/lib/prompts';
import { extractCssVariables, clampCssVariation } from '@/lib/template-utils';
import { v4 as uuidv4 } from 'uuid';
import type { CampaignVariant } from '@/lib/types';

const anthropic = new Anthropic();

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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { variantId, prompt, count } = await req.json();

  const storage = getStorage();
  await storage.init();

  const campaign = await storage.getCampaign(id);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const sourceVariant = campaign.variants.find(v => v.id === variantId);
  if (!sourceVariant) return NextResponse.json({ error: 'Variant not found' }, { status: 404 });

  // 1. Extract CSS variables from source variant's template
  const currentVars = extractCssVariables(sourceVariant.templateHtml);

  // 2. Load the parameter-variation prompt
  let paramPrompt = await storage.getSystemPrompt(campaign.studioId, 'parameter-variation');
  if (!paramPrompt) paramPrompt = DEFAULT_PROMPTS['parameter-variation'];

  const numVariations = Math.min(count || 3, 5);

  // 3. Build user message: current CSS vars + count + optional user feedback
  const varList = Object.entries(currentVars)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  let userMessage = `Aktuelle CSS-Variablen:\n${varList}\n\nGeneriere ${numVariations} verschiedene Layout-Variationen als JSON-Array.`;
  if (prompt) {
    userMessage += `\n\nNutzerfeedback: "${prompt}"`;
  }

  // 4. Call Claude to generate CSS variable overrides
  let cssVariations: Record<string, string>[] = [];
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: paramPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    let text = message.content[0].type === 'text' ? message.content[0].text : '[]';
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    try {
      const parsed = JSON.parse(text);
      cssVariations = Array.isArray(parsed) ? parsed.slice(0, numVariations) : [];
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        try { cssVariations = JSON.parse(match[0]).slice(0, numVariations); } catch { /* fall through */ }
      }
    }
  } catch (err) {
    console.error('CSS variation generation failed:', err);
  }

  // 5. For each variation: clamp values to safe ranges, then apply CSS overrides
  const newVariants: CampaignVariant[] = [];
  for (const rawOverrides of cssVariations) {
    const overrides = clampCssVariation(rawOverrides);
    const variantHtml = applyCssOverrides(sourceVariant.templateHtml, overrides);
    newVariants.push({
      id: uuidv4(),
      templateHtml: variantHtml,
      fieldValues: { ...sourceVariant.fieldValues },
      approved: true,
      outputs: [],
    });
  }

  // Add new variants to campaign
  campaign.variants.push(...newVariants);
  campaign.updatedAt = new Date().toISOString();
  await storage.saveCampaign(campaign);

  return NextResponse.json({ newVariants, campaign });
}
