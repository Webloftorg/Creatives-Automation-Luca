'use client';

import type { SavedTemplate } from '@/lib/types';

interface TemplatePickerProps {
  templates: SavedTemplate[];
  selected: string;
  onSelect: (templateId: string) => void;
}

const STYLE_HINTS: Record<string, { emoji: string; desc: string }> = {
  'dark-center': { emoji: '\u{1F311}', desc: 'Dunkel, Person zentral, Neon-Preis' },
  'split-bold': { emoji: '\u26A1', desc: 'Person links, Text rechts, farbiger Akzent' },
  'minimal-light': { emoji: '\u2728', desc: 'Hell, clean, minimalistisch, riesiger Preis' },
  'full-impact': { emoji: '\u{1F525}', desc: 'Farbiger BG, maximale Aufmerksamkeit' },
  'editorial': { emoji: '\u{1F4F8}', desc: 'Magazin-Stil, Person als Hintergrund' },
};

function getStyleHint(t: SavedTemplate): { emoji: string; desc: string } {
  if (STYLE_HINTS[t.id]) return STYLE_HINTS[t.id];
  return { emoji: '\u{1F3A8}', desc: t.description || '' };
}

export function TemplatePicker({ templates, selected, onSelect }: TemplatePickerProps) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {templates.map((t) => {
        const isSelected = t.id === selected;
        const hint = getStyleHint(t);

        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
              isSelected
                ? 'border-[#00D4FF]/50 bg-[#00D4FF]/10 shadow-[0_0_20px_rgba(0,212,255,0.1)]'
                : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
            }`}
          >
            <span className="text-2xl flex-shrink-0">{hint.emoji}</span>
            <div className="min-w-0">
              <span
                className={`block text-sm font-bold truncate ${
                  isSelected ? 'text-[#00D4FF]' : 'text-white'
                }`}
              >
                {t.name}
              </span>
              {hint.desc && (
                <span className="block text-xs text-[#9ca3af] truncate mt-0.5">
                  {hint.desc}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
