// app/api/analyze-brand/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    if (hostname.startsWith('10.') || hostname.startsWith('192.168.')) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return false;
    if (hostname === '169.254.169.254') return false;
    if (hostname.endsWith('.internal') || hostname.endsWith('.local')) return false;
    return true;
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  const { websiteUrl } = await req.json();

  if (!websiteUrl) {
    return NextResponse.json({ error: 'Website URL required' }, { status: 400 });
  }

  if (!isAllowedUrl(websiteUrl)) {
    return NextResponse.json({ error: 'Invalid or disallowed URL' }, { status: 400 });
  }

  try {
    // Fetch the website HTML
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CreativeBot/1.0)',
        'Accept': 'text/html',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Website returned ${res.status}`);

    const html = await res.text();
    // Limit to first 15000 chars to stay within reasonable context
    const truncatedHtml = html.slice(0, 15000);

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `Du bist ein Brand-Analyst und Webdesign-Experte. Analysiere die Website eines Fitnessstudios und extrahiere die Markenidentitaet.

Antworte NUR als JSON-Objekt mit dieser Struktur:
{
  "primaryColor": "#hex",
  "secondaryColor": "#hex",
  "accentColor": "#hex",
  "suggestedFont": "Fontname",
  "brandMood": "1-2 Saetze die den Markenstil beschreiben",
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "studioName": "Name falls erkennbar",
  "location": "Standort falls erkennbar"
}

Achte auf:
- Farben aus dem CSS, Meta-Tags, Logo-Farben, Buttons, Akzente
- Der primaere Farbton ist meistens der dominante Brand-Farbton
- KRITISCH: accentColor MUSS die hellste, auffaelligste Farbe sein - sie wird fuer Preise und CTAs mit Neon-Glow-Effekt auf dunklem Hintergrund verwendet. Sie darf NIEMALS dunkel, grau oder gedaempft sein! Wenn die hellste Farbe die primaere ist, tausche primary und accent.
- Falls keine klaren Farben erkennbar sind, schlage professionelle Fitness-Farben vor (accentColor immer hell: Orange, Gelb, Pink, Gruen)
- Beschreibe den Markenstil: Premium? Urban? Familiaer? Hardcore?

KEIN Markdown, KEINE Erklaerungen. NUR das JSON-Objekt.`,
      messages: [{
        role: 'user',
        content: `Analysiere diese Studio-Website und extrahiere die Markenidentitaet:\n\nURL: ${websiteUrl}\n\nHTML:\n${truncatedHtml}`,
      }],
    });

    let text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    try {
      const brandData = JSON.parse(text);
      return NextResponse.json(brandData);
    } catch {
      // Try to extract JSON from response
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        return NextResponse.json(JSON.parse(match[0]));
      }
      return NextResponse.json({ error: 'Could not parse brand analysis' }, { status: 500 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analysis failed';
    console.error('Brand analysis error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
