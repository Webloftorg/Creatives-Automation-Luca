'use client';

interface CssVarSliderProps {
  variables: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

const SLIDER_CONFIG: Record<string, { min: number; max: number; step: number; unit: string; label: string; group: string }> = {
  // Hintergrund
  '--bg-blur':        { min: 0, max: 20, step: 1, unit: 'px', label: 'Hintergrund Blur', group: 'Hintergrund' },
  '--bg-brightness':  { min: 0, max: 1, step: 0.05, unit: '', label: 'Hintergrund Helligkeit', group: 'Hintergrund' },
  // Typografie
  '--headline-size':  { min: 24, max: 140, step: 2, unit: 'px', label: 'Headline Gr\u00f6\u00dfe', group: 'Typografie' },
  '--price-size':     { min: 32, max: 180, step: 2, unit: 'px', label: 'Preis Gr\u00f6\u00dfe', group: 'Typografie' },
  '--location-size':  { min: 14, max: 56, step: 1, unit: 'px', label: 'Standort Gr\u00f6\u00dfe', group: 'Typografie' },
  '--strikethrough-size': { min: 14, max: 56, step: 1, unit: 'px', label: 'Streichpreis Gr\u00f6\u00dfe', group: 'Typografie' },
  // Person
  '--person-scale':      { min: 0.3, max: 1.5, step: 0.05, unit: '', label: 'Person Gr\u00f6\u00dfe', group: 'Person' },
  '--person-position-y': { min: -20, max: 30, step: 1, unit: '%', label: 'Person Position Y', group: 'Person' },
  '--person-position-x': { min: -30, max: 30, step: 1, unit: '%', label: 'Person Position X', group: 'Person' },
  // Layout
  '--headline-rotation': { min: -15, max: 15, step: 1, unit: 'deg', label: 'Headline Winkel', group: 'Layout' },
  '--price-rotation':    { min: -10, max: 10, step: 1, unit: 'deg', label: 'Preis Winkel', group: 'Layout' },
  '--content-padding':   { min: 16, max: 80, step: 4, unit: 'px', label: 'Innenabstand', group: 'Layout' },
};

function parseNumericValue(val: string): number {
  return parseFloat(val) || 0;
}

function varLabel(key: string): string {
  return key.replace(/^--/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function CssVarSlider({ variables, onChange }: CssVarSliderProps) {
  // Group sliders
  const groups: Record<string, { key: string; value: string; config: typeof SLIDER_CONFIG[string] }[]> = {};

  for (const [key, value] of Object.entries(variables)) {
    const config = SLIDER_CONFIG[key];
    if (!config) continue;
    if (!groups[config.group]) groups[config.group] = [];
    groups[config.group].push({ key, value, config });
  }

  // Also show sliders for config entries not in template (user can add them)
  for (const [key, config] of Object.entries(SLIDER_CONFIG)) {
    if (!(key in variables)) {
      if (!groups[config.group]) groups[config.group] = [];
      // Only add if group already has entries (don't show empty groups for unrelated vars)
      const hasRelated = groups[config.group].length > 0;
      if (!hasRelated && !['Layout'].includes(config.group)) continue;
      groups[config.group].push({ key, value: `${config.min}${config.unit}`, config });
    }
  }

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([group, items]) => (
        <div key={group}>
          <div className="text-[#666] text-[10px] uppercase tracking-widest mb-2">{group}</div>
          <div className="space-y-2.5">
            {items.map(({ key, value, config }) => {
              const numValue = parseNumericValue(value);
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs text-[#aaa] mb-0.5">
                    <span>{config.label}</span>
                    <span className="text-[#666]">{numValue}{config.unit}</span>
                  </div>
                  <input
                    type="range"
                    min={config.min}
                    max={config.max}
                    step={config.step}
                    value={numValue}
                    onChange={e => onChange(key, `${e.target.value}${config.unit}`)}
                    className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#FF4500]"
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
