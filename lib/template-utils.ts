import type { DynamicField } from './types';

export function replacePlaceholders(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '');
}

export function extractPlaceholders(html: string): string[] {
  const matches = html.matchAll(/\{\{(\w+)\}\}/g);
  const keys = new Set<string>();
  for (const match of matches) {
    keys.add(match[1]);
  }
  return Array.from(keys);
}

export function extractCssVariables(html: string): Record<string, string> {
  const rootMatch = html.match(/:root\s*\{([^}]+)\}/);
  if (!rootMatch) return {};
  const vars: Record<string, string> = {};
  const lines = rootMatch[1].split(';');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('--')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();
    const commentIdx = value.indexOf('/*');
    if (commentIdx !== -1) value = value.slice(0, commentIdx).trim();
    if (!value.startsWith('{{')) {
      vars[key] = value;
    }
  }
  return vars;
}

const IMAGE_KEYS = new Set(['backgroundImage', 'personImage', 'logo']);
const COLOR_KEYS = new Set(['primaryColor', 'secondaryColor', 'accentColor']);
const SYSTEM_KEYS = new Set(['width', 'height']);

export function placeholdersToDynamicFields(keys: string[]): DynamicField[] {
  return keys
    .filter(key => !SYSTEM_KEYS.has(key))
    .map(key => ({
      key,
      label: camelToTitle(key),
      type: IMAGE_KEYS.has(key) ? 'image' as const : COLOR_KEYS.has(key) ? 'color' as const : 'text' as const,
      required: true,
    }));
}

function camelToTitle(str: string): string {
  return str.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
}
