'use client';

interface CssVarSliderProps {
  variables: Record<string, string>;
  selectedSection: string | null;
  onChange: (key: string, value: string) => void;
}

const SLIDER_CONFIG: Record<string, { min: number; max: number; step: number; unit: string; label: string; group: string; section: string }> = {
  // Hintergrund
  '--bg-blur':        { min: 0, max: 20, step: 1, unit: 'px', label: 'Hintergrund Blur', group: 'Hintergrund', section: 'background' },
  '--bg-brightness':  { min: 0.1, max: 1, step: 0.05, unit: '', label: 'Hintergrund Helligkeit', group: 'Hintergrund', section: 'background' },
  // Filter
  '--overlay-opacity': { min: 0, max: 1, step: 0.01, unit: '', label: 'Filterstaerke (0 = aus)', group: 'Filter', section: 'background' },
  // Typografie
  '--headline-size':  { min: 24, max: 140, step: 2, unit: 'px', label: 'Headline Größe', group: 'Typografie', section: 'headline' },
  '--price-size':     { min: 32, max: 180, step: 2, unit: 'px', label: 'Preis Größe', group: 'Typografie', section: 'price-block' },
  '--price-glow':     { min: 0, max: 2, step: 0.05, unit: '', label: 'Preis Neon-Glow', group: 'Typografie', section: 'price-block' },
  '--location-size':  { min: 14, max: 56, step: 1, unit: 'px', label: 'Standort Größe', group: 'Typografie', section: 'location' },
  '--strikethrough-size': { min: 14, max: 56, step: 1, unit: 'px', label: 'Streichpreis Größe', group: 'Typografie', section: 'price-block' },
  // Person
  '--person-scale':      { min: 0.3, max: 1.5, step: 0.05, unit: '', label: 'Person Skalierung', group: 'Person', section: 'person' },
  // Layout
  '--headline-rotation': { min: -15, max: 15, step: 1, unit: 'deg', label: 'Headline Winkel', group: 'Layout', section: 'headline' },
  '--price-rotation':    { min: -10, max: 10, step: 1, unit: 'deg', label: 'Preis Winkel', group: 'Layout', section: 'price-block' },
  '--location-rotation': { min: -15, max: 15, step: 1, unit: 'deg', label: 'Standort Winkel', group: 'Layout', section: 'location' },
  '--content-padding':   { min: 16, max: 80, step: 4, unit: 'px', label: 'Innenabstand', group: 'Layout', section: 'background' },
};

// These sliders are always visible regardless of selected section
const GLOBAL_SLIDERS = ['--overlay-opacity', '--bg-brightness', '--bg-blur'];

function parseNumericValue(val: string): number {
  return parseFloat(val) || 0;
}

// Convert RGB triplet "r, g, b" to hex for color picker
function rgbToHex(rgb: string): string {
  const parts = rgb.split(',').map(s => parseInt(s.trim()));
  if (parts.length < 3 || parts.some(isNaN)) return '#000000';
  return '#' + parts.map(p => Math.max(0, Math.min(255, p)).toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex: string): string {
  const c = hex.replace('#', '');
  return `${parseInt(c.substring(0, 2), 16)}, ${parseInt(c.substring(2, 4), 16)}, ${parseInt(c.substring(4, 6), 16)}`;
}

export function CssVarSlider({ variables, selectedSection, onChange }: CssVarSliderProps) {
  const overlayColor = variables['--overlay-color'] || '0, 0, 0';

  // ── Always-visible: Filter controls ──
  const globalSliders = GLOBAL_SLIDERS.map(key => {
    const config = SLIDER_CONFIG[key];
    if (!config) return null;
    const value = variables[key] || `${config.min}${config.unit}`;
    return { key, value, config };
  }).filter(Boolean) as { key: string; value: string; config: typeof SLIDER_CONFIG[string] }[];

  // ── Section-specific sliders ──
  const sectionGroups: Record<string, { key: string; value: string; config: typeof SLIDER_CONFIG[string] }[]> = {};

  if (selectedSection) {
    for (const [key, value] of Object.entries(variables)) {
      const config = SLIDER_CONFIG[key];
      if (!config || config.section !== selectedSection || GLOBAL_SLIDERS.includes(key)) continue;
      if (!sectionGroups[config.group]) sectionGroups[config.group] = [];
      sectionGroups[config.group].push({ key, value, config });
    }
    for (const [key, config] of Object.entries(SLIDER_CONFIG)) {
      if (config.section === selectedSection && !(key in variables) && !GLOBAL_SLIDERS.includes(key)) {
        if (!sectionGroups[config.group]) sectionGroups[config.group] = [];
        sectionGroups[config.group].push({ key, value: `${config.min}${config.unit}`, config });
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Always visible: Filter + Background controls ── */}
      <div>
        <div className="text-[#00D4FF] text-[10px] uppercase tracking-widest mb-2 font-semibold">Filter & Hintergrund</div>
        <div className="space-y-2.5">
          {globalSliders.map(({ key, value, config }) => {
            const numValue = parseNumericValue(value);
            return (
              <div key={key}>
                <div className="flex justify-between text-xs text-[#9ca3af] mb-0.5">
                  <span>{config.label}</span>
                  <span className="text-[#6b7280]">{numValue}{config.unit}</span>
                </div>
                <input
                  type="range"
                  min={config.min}
                  max={config.max}
                  step={config.step}
                  value={numValue}
                  onChange={e => onChange(key, `${e.target.value}${config.unit}`)}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#00D4FF]"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Always visible: Filter color picker ── */}
      <div>
        <div className="text-[#6b7280] text-[10px] uppercase tracking-widest mb-2">Filterfarbe</div>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={rgbToHex(overlayColor)}
            onChange={e => onChange('--overlay-color', hexToRgb(e.target.value))}
            className="w-10 h-10 rounded cursor-pointer border border-white/10 bg-transparent"
          />
          <div className="flex gap-1.5">
            {['#000000', '#1a0000', '#00001a', '#0a000a', '#1a1a00'].map(hex => (
              <button
                key={hex}
                onClick={() => onChange('--overlay-color', hexToRgb(hex))}
                className="w-7 h-7 rounded border border-white/10 hover:border-[#00D4FF]/50 transition-colors"
                style={{ backgroundColor: hex }}
                title={hex}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-white/[0.06]" />

      {/* ── Section-specific controls ── */}
      {!selectedSection ? (
        <div className="text-[#6b7280] text-sm text-center py-4">
          Klicke auf ein Element im Vorschaubild fuer weitere Optionen.
        </div>
      ) : (
        <>
          {selectedSection === 'headline' && (
            <div>
              <div className="text-[#6b7280] text-[10px] uppercase tracking-widest mb-2">Textumbruch</div>
              <div className="flex gap-2">
                <button
                  onClick={() => onChange('--headline-wrap', 'nowrap')}
                  className={`flex-1 text-xs py-2 rounded-lg font-medium transition-all ${
                    (variables['--headline-wrap'] || 'normal') === 'nowrap'
                      ? 'bg-[#00D4FF] text-black' : 'bg-white/[0.03] border border-white/10 text-[#6b7280]'
                  }`}>
                  Einzeilig
                </button>
                <button
                  onClick={() => onChange('--headline-wrap', 'normal')}
                  className={`flex-1 text-xs py-2 rounded-lg font-medium transition-all ${
                    (variables['--headline-wrap'] || 'normal') === 'normal'
                      ? 'bg-[#00D4FF] text-black' : 'bg-white/[0.03] border border-white/10 text-[#6b7280]'
                  }`}>
                  Mehrzeilig
                </button>
              </div>
            </div>
          )}
          {Object.entries(sectionGroups).map(([group, items]) => (
            <div key={group}>
              <div className="text-[#6b7280] text-[10px] uppercase tracking-widest mb-2">{group}</div>
              <div className="space-y-2.5">
                {items.map(({ key, value, config }) => {
                  const numValue = parseNumericValue(value);
                  return (
                    <div key={key}>
                      <div className="flex justify-between text-xs text-[#9ca3af] mb-0.5">
                        <span>{config.label}</span>
                        <span className="text-[#6b7280]">{numValue}{config.unit}</span>
                      </div>
                      <input
                        type="range"
                        min={config.min}
                        max={config.max}
                        step={config.step}
                        value={numValue}
                        onChange={e => onChange(key, `${e.target.value}${config.unit}`)}
                        className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#00D4FF]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
