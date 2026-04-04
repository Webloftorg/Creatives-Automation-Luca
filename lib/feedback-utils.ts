// lib/feedback-utils.ts
import type { CreativeFeedback } from './types';

export function buildFeedbackSummary(feedbacks: CreativeFeedback[]): {
  summary: string;
  goodCount: number;
  badCount: number;
} {
  if (feedbacks.length === 0) {
    return { summary: '', goodCount: 0, badCount: 0 };
  }

  const good = feedbacks.filter(f => f.rating === 'good');
  const bad = feedbacks.filter(f => f.rating === 'bad');

  const avgCssVar = (items: CreativeFeedback[], varName: string): string => {
    const values = items
      .map(f => parseFloat(f.cssVars[varName] || ''))
      .filter(v => !isNaN(v));
    if (values.length === 0) return '';
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return avg.toFixed(1);
  };

  const goodPatterns: string[] = [];
  const badPatterns: string[] = [];

  if (good.length > 0) {
    const hl = avgCssVar(good, '--headline-size');
    const pr = avgCssVar(good, '--price-size');
    const ps = avgCssVar(good, '--person-scale');
    const ov = avgCssVar(good, '--overlay-opacity');
    const br = avgCssVar(good, '--bg-brightness');
    if (hl) goodPatterns.push(`Headline avg ${hl}px`);
    if (pr) goodPatterns.push(`Preis avg ${pr}px`);
    if (ps) goodPatterns.push(`Person-Scale avg ${ps}`);
    if (ov) goodPatterns.push(`Overlay avg ${ov}`);
    if (br) goodPatterns.push(`Brightness avg ${br}`);
  }

  if (bad.length > 0) {
    const hl = avgCssVar(bad, '--headline-size');
    const pr = avgCssVar(bad, '--price-size');
    const ps = avgCssVar(bad, '--person-scale');
    const ov = avgCssVar(bad, '--overlay-opacity');
    const br = avgCssVar(bad, '--bg-brightness');
    if (hl) badPatterns.push(`Headline avg ${hl}px`);
    if (pr) badPatterns.push(`Preis avg ${pr}px`);
    if (ps) badPatterns.push(`Person-Scale avg ${ps}`);
    if (ov) badPatterns.push(`Overlay avg ${ov}`);
    if (br) badPatterns.push(`Brightness avg ${br}`);

    const comments = bad.filter(f => f.comment).map(f => `"${f.comment}"`);
    if (comments.length > 0) {
      badPatterns.push(`Kommentare: ${comments.slice(0, 5).join(', ')}`);
    }
  }

  const lines = [`KUNDENFEEDBACK (basierend auf ${feedbacks.length} bewerteten Creatives):`];
  if (good.length > 0) lines.push(`POSITIV (${good.length}x): ${goodPatterns.join(', ')}`);
  if (bad.length > 0) lines.push(`NEGATIV (${bad.length}x): ${badPatterns.join(', ')}`);
  lines.push('Passe deine Variationen entsprechend an!');

  return {
    summary: lines.join('\n'),
    goodCount: good.length,
    badCount: bad.length,
  };
}
