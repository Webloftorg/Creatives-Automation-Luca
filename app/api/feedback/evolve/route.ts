// app/api/feedback/evolve/route.ts
// Self-improving prompt evolution: analyzes ALL feedback across studios
// and rewrites system prompts to get better over time.

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';
import { DEFAULT_PROMPTS } from '@/lib/prompts';
import type { PromptType } from '@/lib/types';

const anthropic = new Anthropic();

const EVOLUTION_META_PROMPT = `Du bist ein Prompt-Engineering-Experte fuer KI-gesteuerte Werbeanzeigen-Generierung.

Du bekommst:
1. Den AKTUELLEN System-Prompt (der an die KI gesendet wird)
2. Eine Zusammenfassung von echtem Kundenfeedback (gut/schlecht bewertete Creatives mit ihren CSS-Parametern und Kommentaren)

Deine Aufgabe: Den System-Prompt VERBESSERN basierend auf dem Feedback-Muster.

REGELN:
- Behalte die grundlegende Struktur und Format-Anforderungen (JSON output etc.) bei
- Fuege KONKRETE Erkenntnisse aus dem Feedback als neue Regeln hinzu
- Wenn Kunden bestimmte Wertebereiche bevorzugen, mach das zu einer Regel
- Wenn bestimmte Stile negativ bewertet werden, fuege Warnungen hinzu
- Der Prompt muss BESSER werden, nicht nur laenger - entferne Regeln die dem Feedback widersprechen
- Schreibe den kompletten verbesserten Prompt zurueck, nicht nur Aenderungen
- BEHALTE die Sprache (Deutsch) und den technischen Kontext bei
- BEHALTE die Output-Format-Anforderungen (JSON etc.) exakt bei

Antworte NUR mit dem verbesserten Prompt-Text. KEIN Markdown, KEINE Erklaerungen, KEINE Code-Fences.`;

interface FeedbackRow {
  rating: string;
  comment: string | null;
  css_vars: Record<string, string>;
  field_values: Record<string, string>;
  template_id: string;
  studio_id: string;
}

function buildEvolutionContext(feedbacks: FeedbackRow[]): string {
  const good = feedbacks.filter(f => f.rating === 'good');
  const bad = feedbacks.filter(f => f.rating === 'bad');

  const avgVar = (items: FeedbackRow[], varName: string): string => {
    const vals = items.map(f => parseFloat(f.css_vars?.[varName] || '')).filter(v => !isNaN(v));
    if (vals.length === 0) return 'n/a';
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  };

  const cssVarNames = ['--headline-size', '--price-size', '--person-scale', '--overlay-opacity',
    '--bg-brightness', '--bg-blur', '--headline-y', '--price-block-y', '--headline-rotation'];

  const lines: string[] = [];
  lines.push(`=== FEEDBACK ANALYSE (${feedbacks.length} Bewertungen, ${good.length} positiv, ${bad.length} negativ) ===`);

  if (good.length > 0) {
    lines.push('\nPOSITIV BEWERTETE CREATIVES:');
    for (const v of cssVarNames) {
      const avg = avgVar(good, v);
      if (avg !== 'n/a') lines.push(`  ${v}: Durchschnitt ${avg}`);
    }
    const goodTemplates = [...new Set(good.map(f => f.template_id))];
    lines.push(`  Bevorzugte Templates: ${goodTemplates.join(', ')}`);
  }

  if (bad.length > 0) {
    lines.push('\nNEGATIV BEWERTETE CREATIVES:');
    for (const v of cssVarNames) {
      const avg = avgVar(bad, v);
      if (avg !== 'n/a') lines.push(`  ${v}: Durchschnitt ${avg}`);
    }
    const comments = bad.filter(f => f.comment).map(f => `"${f.comment}"`);
    if (comments.length > 0) {
      lines.push(`  Kundenkommentare: ${comments.slice(0, 15).join(', ')}`);
    }
  }

  // Compute delta patterns
  if (good.length > 0 && bad.length > 0) {
    lines.push('\nERKENNBAR MUSTER (Differenz gut vs. schlecht):');
    for (const v of cssVarNames) {
      const goodAvg = parseFloat(avgVar(good, v));
      const badAvg = parseFloat(avgVar(bad, v));
      if (!isNaN(goodAvg) && !isNaN(badAvg) && Math.abs(goodAvg - badAvg) > 1) {
        const direction = goodAvg > badAvg ? 'hoeher' : 'niedriger';
        lines.push(`  ${v}: Gute Creatives haben ${direction}en Wert (${goodAvg.toFixed(1)} vs ${badAvg.toFixed(1)})`);
      }
    }
  }

  return lines.join('\n');
}

async function evolvePrompt(
  promptType: PromptType,
  currentPrompt: string,
  feedbackContext: string,
): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: EVOLUTION_META_PROMPT,
    messages: [{
      role: 'user',
      content: `PROMPT-TYP: ${promptType}\n\nAKTUELLER PROMPT:\n${currentPrompt}\n\n${feedbackContext}\n\nVerbessere den Prompt basierend auf diesen Erkenntnissen.`,
    }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return text.replace(/^```(?:\w*)\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}

export async function POST() {
  try {
    // 1. Load ALL feedback across all studios
    const { data: allFeedback } = await supabaseAdmin
      .from('feedback')
      .select('rating, comment, css_vars, field_values, template_id, studio_id')
      .order('timestamp', { ascending: false })
      .limit(500);

    if (!allFeedback || allFeedback.length < 5) {
      return NextResponse.json({
        evolved: false,
        reason: `Nicht genug Feedback (${allFeedback?.length || 0}/5 minimum)`,
      });
    }

    const feedbackContext = buildEvolutionContext(allFeedback as FeedbackRow[]);

    // 2. Evolve each prompt type that makes sense
    const typesToEvolve: PromptType[] = ['copy-generation', 'parameter-variation'];
    const results: Record<string, { version: number; changed: boolean }> = {};

    for (const promptType of typesToEvolve) {
      // Get current evolved prompt or fall back to default
      const { data: existing } = await supabaseAdmin
        .from('global_prompts')
        .select('*')
        .eq('prompt_type', promptType)
        .single();

      const currentPrompt = existing?.prompt || DEFAULT_PROMPTS[promptType];
      const currentVersion = existing?.version || 0;

      // Evolve
      const improved = await evolvePrompt(promptType, currentPrompt, feedbackContext);

      // Only save if meaningfully different (not just whitespace)
      if (improved && improved.length > 100 && improved !== currentPrompt) {
        const newVersion = currentVersion + 1;
        const logEntry = {
          version: newVersion,
          timestamp: new Date().toISOString(),
          feedback_count: allFeedback.length,
          good_count: allFeedback.filter(f => f.rating === 'good').length,
          bad_count: allFeedback.filter(f => f.rating === 'bad').length,
        };

        await supabaseAdmin.from('global_prompts').upsert({
          prompt_type: promptType,
          prompt: improved,
          version: newVersion,
          feedback_count: allFeedback.length,
          last_evolved_at: new Date().toISOString(),
          evolution_log: existing?.evolution_log
            ? [...(existing.evolution_log as unknown[]), logEntry]
            : [logEntry],
        });

        results[promptType] = { version: newVersion, changed: true };
        console.log(`Evolved ${promptType} to v${newVersion} based on ${allFeedback.length} feedbacks`);
      } else {
        results[promptType] = { version: currentVersion, changed: false };
      }
    }

    return NextResponse.json({ evolved: true, results, feedbackCount: allFeedback.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Evolution failed';
    console.error('Prompt evolution error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
