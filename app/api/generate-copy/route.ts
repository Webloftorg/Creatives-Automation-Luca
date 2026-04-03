import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStorage } from '@/lib/storage';
import { DEFAULT_PROMPTS } from '@/lib/prompts';

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const { studioId, offerType, price, originalPrice, customContext } = await req.json();

  const storage = getStorage();
  await storage.init();

  let systemPrompt = await storage.getSystemPrompt(studioId, 'copy-generation');
  if (!systemPrompt) systemPrompt = DEFAULT_PROMPTS['copy-generation'];

  const studio = studioId ? await storage.getStudio(studioId) : null;

  const userMessage = [
    studio ? `Studio: ${studio.name}, Standort: ${studio.location}` : '',
    offerType ? `Angebotstyp: ${offerType}` : '',
    price ? `Preis: ${price}` : '',
    originalPrice ? `Streichpreis: ${originalPrice}` : '',
    customContext ? `Kontext: ${customContext}` : '',
  ].filter(Boolean).join('\n');

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    let text = message.content[0].type === 'text' ? message.content[0].text : '';
    // Strip markdown code fences if Claude wrapped the JSON
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
    // Try to extract JSON array if there's surrounding text
    const match = text.match(/\[[\s\S]*\]/);
    const variants = JSON.parse(match ? match[0] : text);
    return NextResponse.json({ variants });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Copy generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
