// app/api/campaigns/[id]/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStorage } from '@/lib/storage';
import { DEFAULT_PROMPTS } from '@/lib/prompts';
import { extractCssVariables, extractPlaceholders } from '@/lib/template-utils';
import { FORMAT_DIMENSIONS } from '@/lib/formats';
import { v4 as uuidv4 } from 'uuid';
import type { Campaign, CampaignVariant, CreativeFormat } from '@/lib/types';

const anthropic = new Anthropic();

async function generateDesignHtml(
  systemPrompt: string,
  description: string,
  format: CreativeFormat,
  studioContext: string,
  variantIndex: number,
): Promise<string> {
  const dimensions = FORMAT_DIMENSIONS[format];
  const userMessage = [
    `Zielformat: ${dimensions.width}x${dimensions.height}px`,
    `Beschreibung: ${description}`,
    studioContext,
    variantIndex > 0
      ? `Dies ist Design-Variante ${variantIndex + 1}. Erstelle ein DEUTLICH ANDERES Layout als die vorherigen Varianten — andere Anordnung, andere Akzente, anderer Stil. Aber halte dich an den Referenz-Stil.`
      : '',
  ].filter(Boolean).join('\n');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  let html = message.content[0].type === 'text' ? message.content[0].text : '';
  // Strip markdown code fences if Claude wrapped the HTML
  html = html.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  return html;
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
  // Strip markdown code fences if present
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.slice(0, count) : [];
  } catch {
    // Fallback: try to extract JSON array from the response
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

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storage = getStorage();
  await storage.init();

  const campaign = await storage.getCampaign(id);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const studio = await storage.getStudio(campaign.studioId);
  const studioContext = studio
    ? `Studio: ${studio.name}, Standort: ${studio.location}, Farben: Primär=${studio.primaryColor}, Akzent=${studio.accentColor}, Font: ${studio.defaultFont}`
    : '';

  // Get system prompts
  let templatePrompt = await storage.getSystemPrompt(campaign.studioId, 'template-generation');
  if (!templatePrompt) templatePrompt = DEFAULT_PROMPTS['template-generation'];

  let copyPrompt = await storage.getSystemPrompt(campaign.studioId, 'copy-generation');
  if (!copyPrompt) copyPrompt = DEFAULT_PROMPTS['copy-generation'];

  try {
    // 1. Generate design variants
    const designHtmls: string[] = [];
    const primaryFormat = campaign.formats[0] || 'instagram-post';

    if (campaign.baseTemplateId) {
      // Use existing template
      const baseTemplate = await storage.getTemplate(campaign.baseTemplateId);
      if (baseTemplate) {
        designHtmls.push(baseTemplate.htmlContent);
      }
    } else {
      // AI generates N design variants sequentially
      for (let i = 0; i < campaign.designVariantCount; i++) {
        const html = await generateDesignHtml(
          templatePrompt,
          `Fitness-Werbeanzeige mit Preis ${campaign.defaultValues.price || '39,90€'}`,
          primaryFormat,
          studioContext,
          i,
        );
        if (html) designHtmls.push(html);
      }
    }

    if (designHtmls.length === 0) {
      return NextResponse.json({ error: 'Keine Design-Varianten generiert' }, { status: 500 });
    }

    // 2. Generate headlines for each design (can run in parallel)
    const headlineResults = await Promise.all(
      designHtmls.map(() =>
        generateHeadlines(
          copyPrompt,
          studioContext,
          campaign.headlineVariantCount,
          campaign.defaultValues.price,
          campaign.defaultValues.originalPrice,
        )
      )
    );

    // 3. Combine: designs × headlines = variants
    const variants: CampaignVariant[] = [];
    for (let d = 0; d < designHtmls.length; d++) {
      const headlines = headlineResults[d] || [];
      for (let h = 0; h < headlines.length; h++) {
        variants.push({
          id: uuidv4(),
          templateHtml: designHtmls[d],
          fieldValues: {
            ...campaign.defaultValues,
            headline: headlines[h].headline,
          },
          approved: true,
          outputs: [],
        });
      }
    }

    // 4. Inject studio context into defaultValues
    if (studio) {
      campaign.defaultValues.location = campaign.defaultValues.location || studio.location;
      campaign.defaultValues.primaryColor = campaign.defaultValues.primaryColor || studio.primaryColor;
      campaign.defaultValues.accentColor = campaign.defaultValues.accentColor || studio.accentColor;
    }

    // 5. Update campaign
    campaign.variants = variants;
    campaign.status = 'reviewing';
    campaign.updatedAt = new Date().toISOString();
    await storage.saveCampaign(campaign);

    return NextResponse.json(campaign);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
