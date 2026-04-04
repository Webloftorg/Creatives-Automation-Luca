import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStorage } from '@/lib/storage';
import { DEFAULT_PROMPTS } from '@/lib/prompts';
import { extractPlaceholders, extractCssVariables, placeholdersToDynamicFields, normalizeLayoutHtml } from '@/lib/template-utils';
import { FORMAT_DIMENSIONS } from '@/lib/formats';
import type { CreativeFormat } from '@/lib/types';

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const { prompt, format, studioId, baseTemplate, referenceTemplateIds } = await req.json();

  const storage = getStorage();
  await storage.init();

  const isEditing = Boolean(baseTemplate);
  const promptType = isEditing ? 'template-editing' : 'parameter-variation';

  let systemPrompt = studioId ? await storage.getSystemPrompt(studioId, promptType) : '';
  if (!systemPrompt) systemPrompt = DEFAULT_PROMPTS[promptType];

  const dimensions = FORMAT_DIMENSIONS[format as CreativeFormat] || FORMAT_DIMENSIONS['instagram-post'];
  const parts: string[] = [];

  parts.push(`Zielformat: ${dimensions.width}x${dimensions.height}px`);

  if (isEditing) {
    parts.push(`\nBestehendes Template:\n${baseTemplate}`);
    parts.push(`\nÄnderung: ${prompt}`);
  } else {
    parts.push(`\nBeschreibung: ${prompt}`);
  }

  if (referenceTemplateIds && referenceTemplateIds.length > 0) {
    for (const refId of referenceTemplateIds) {
      const refTemplate = await storage.getTemplate(refId);
      if (refTemplate) {
        parts.push(`\nReferenz-Template "${refTemplate.name}":\n${refTemplate.htmlContent}`);
      }
    }
  }

  if (studioId) {
    const studio = await storage.getStudio(studioId);
    if (studio) {
      parts.push(`\nStudio-Farben: Primär=${studio.primaryColor}, Akzent=${studio.accentColor}`);
      parts.push(`Font: ${studio.defaultFont}`);
    }
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: parts.join('\n') }],
    });

    let html = message.content[0].type === 'text' ? message.content[0].text : '';
    // Strip markdown code fences if Claude wrapped the HTML
    html = html.replace(/^```(?:html)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    // Normalize: inject missing CSS vars, data-draggable attrs, min sizes, neon glow
    html = normalizeLayoutHtml(html);
    const placeholders = extractPlaceholders(html);
    const cssVariables = extractCssVariables(html);
    const dynamicFields = placeholdersToDynamicFields(placeholders);

    return NextResponse.json({ html, dynamicFields, cssVariables });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Template generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
