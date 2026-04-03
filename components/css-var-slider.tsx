'use client';

interface CssVarSliderProps {
  variables: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

const SLIDER_CONFIG: Record<string, { min: number; max: number; step: number; unit: string }> = {
  '--bg-blur': { min: 0, max: 20, step: 1, unit: 'px' },
  '--bg-brightness': { min: 0, max: 1, step: 0.05, unit: '' },
  '--headline-size': { min: 24, max: 120, step: 2, unit: 'px' },
  '--price-size': { min: 32, max: 160, step: 2, unit: 'px' },
  '--person-scale': { min: 0.3, max: 1.5, step: 0.05, unit: '' },
  '--person-position-y': { min: -20, max: 30, step: 1, unit: '%' },
  '--location-size': { min: 14, max: 48, step: 1, unit: 'px' },
  '--strikethrough-size': { min: 14, max: 48, step: 1, unit: 'px' },
};

function parseNumericValue(val: string): number {
  return parseFloat(val) || 0;
}

function varLabel(key: string): string {
  return key.replace(/^--/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function CssVarSlider({ variables, onChange }: CssVarSliderProps) {
  return (
    <div className="space-y-3">
      {Object.entries(variables).map(([key, value]) => {
        const config = SLIDER_CONFIG[key];
        if (!config) return null;

        const numValue = parseNumericValue(value);

        return (
          <div key={key}>
            <div className="flex justify-between text-xs text-[#aaa] mb-1">
              <span>{varLabel(key)}</span>
              <span>{numValue}{config.unit}</span>
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
  );
}
