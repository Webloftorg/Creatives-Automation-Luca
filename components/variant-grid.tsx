// components/variant-grid.tsx
'use client';

import { useState } from 'react';
import { VariantCard } from '@/components/variant-card';
import type { CampaignVariant, CreativeFormat } from '@/lib/types';

interface VariantGridProps {
  variants: CampaignVariant[];
  formats: CreativeFormat[];
  onToggleApproved: (variantId: string) => void;
  onEdit: (variantId: string) => void;
  onRegenerate: (variantId: string) => void;
  onRender: () => void;
  rendering: boolean;
  onFeedback: (variantId: string, rating: 'good' | 'bad', comment?: string) => void;
  feedbackMap: Record<string, 'good' | 'bad'>;
  onUpdateAllVariants?: (updater: (v: CampaignVariant) => CampaignVariant) => void;
}

function parseNumeric(val: string): number {
  return parseFloat(val) || 0;
}

// RGB string "r, g, b" <-> hex
function rgbToHex(rgb: string): string {
  const parts = rgb.split(',').map(s => parseInt(s.trim()));
  if (parts.length < 3 || parts.some(isNaN)) return '#000000';
  return '#' + parts.map(p => Math.max(0, Math.min(255, p)).toString(16).padStart(2, '0')).join('');
}
function hexToRgb(hex: string): string {
  const c = hex.replace('#', '');
  return `${parseInt(c.substring(0, 2), 16)}, ${parseInt(c.substring(2, 4), 16)}, ${parseInt(c.substring(4, 6), 16)}`;
}

// Apply a CSS var override to template HTML
function applyCssVarToHtml(html: string, key: string, value: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(${escaped}\\s*:\\s*)([^;]+)`);
  if (pattern.test(html)) {
    return html.replace(pattern, `$1${value}`);
  }
  // If var not found, inject into :root
  const rootEnd = html.indexOf('}');
  if (rootEnd > 0 && html.substring(0, rootEnd).includes(':root')) {
    return html.substring(0, rootEnd) + `\n      ${key}: ${value};\n    ` + html.substring(rootEnd);
  }
  return html;
}

export function VariantGrid({ variants, formats, onToggleApproved, onEdit, onRegenerate, onRender, rendering, onFeedback, feedbackMap, onUpdateAllVariants }: VariantGridProps) {
  const approvedCount = variants.filter(v => v.approved).length;
  const totalPngs = approvedCount * formats.length;
  const [showControls, setShowControls] = useState(false);

  // Read current values from first variant's HTML
  const firstHtml = variants[0]?.templateHtml || '';
  const getVar = (key: string, fallback: string): string => {
    const match = firstHtml.match(new RegExp(`${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*([^;]+)`));
    return match ? match[1].trim() : fallback;
  };

  const overlayOpacity = parseNumeric(getVar('--overlay-opacity', '0.3'));
  const bgBrightness = parseNumeric(getVar('--bg-brightness', '0.7'));
  const priceGlow = parseNumeric(getVar('--price-glow', '0.5'));
  const overlayColor = getVar('--overlay-color', '0, 0, 0');

  const updateAll = (key: string, value: string) => {
    if (!onUpdateAllVariants) return;
    onUpdateAllVariants(v => ({
      ...v,
      templateHtml: applyCssVarToHtml(v.templateHtml, key, value),
    }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Global style controls bar */}
      <div className="flex-shrink-0 px-6 pt-4 pb-2">
        <button
          onClick={() => setShowControls(!showControls)}
          className="text-[#00D4FF] text-xs font-semibold hover:text-[#00b4d8] transition-colors">
          {showControls ? '▼ Globale Stilanpassungen ausblenden' : '▶ Globale Stilanpassungen fuer alle Varianten'}
        </button>

        {showControls && (
          <div className="mt-3 glass-card rounded-xl p-4 space-y-3">
            {/* Overlay */}
            <div>
              <div className="flex justify-between text-xs text-[#9ca3af] mb-0.5">
                <span>Filterstaerke</span>
                <span className="text-[#6b7280]">{overlayOpacity.toFixed(2)}</span>
              </div>
              <input type="range" min={0} max={1} step={0.01} value={overlayOpacity}
                onChange={e => updateAll('--overlay-opacity', e.target.value)}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#00D4FF]" />
            </div>

            {/* Filter Color */}
            <div className="flex items-center gap-3">
              <span className="text-[#9ca3af] text-xs">Filterfarbe</span>
              <input type="color" value={rgbToHex(overlayColor)}
                onChange={e => updateAll('--overlay-color', hexToRgb(e.target.value))}
                className="w-8 h-8 rounded cursor-pointer border border-white/10 bg-transparent" />
              <div className="flex gap-1">
                {['#000000', '#1a0000', '#00001a', '#0a000a'].map(hex => (
                  <button key={hex} onClick={() => updateAll('--overlay-color', hexToRgb(hex))}
                    className="w-6 h-6 rounded border border-white/10 hover:border-[#00D4FF]/50 transition-colors"
                    style={{ backgroundColor: hex }} />
                ))}
              </div>
            </div>

            {/* Brightness */}
            <div>
              <div className="flex justify-between text-xs text-[#9ca3af] mb-0.5">
                <span>Helligkeit</span>
                <span className="text-[#6b7280]">{bgBrightness.toFixed(2)}</span>
              </div>
              <input type="range" min={0.1} max={1} step={0.05} value={bgBrightness}
                onChange={e => updateAll('--bg-brightness', e.target.value)}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#00D4FF]" />
            </div>

            {/* Glow */}
            <div>
              <div className="flex justify-between text-xs text-[#9ca3af] mb-0.5">
                <span>Preis Neon-Glow</span>
                <span className="text-[#6b7280]">{priceGlow.toFixed(2)}</span>
              </div>
              <input type="range" min={0} max={2} step={0.05} value={priceGlow}
                onChange={e => updateAll('--price-glow', e.target.value)}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#00D4FF]" />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 pt-2">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {variants.map(v => (
            <VariantCard
              key={v.id}
              variant={v}
              onToggleApproved={() => onToggleApproved(v.id)}
              onEdit={() => onEdit(v.id)}
              onRegenerate={() => onRegenerate(v.id)}
              feedback={feedbackMap[v.id] || null}
              onFeedback={(rating, comment) => onFeedback(v.id, rating, comment)}
            />
          ))}
        </div>
      </div>

      {/* Footer bar */}
      <div className="flex-shrink-0 px-6 py-4 flex justify-between items-center" style={{ background: 'rgba(14,14,21,0.85)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-[#9ca3af] text-sm">
          {approvedCount} von {variants.length} Varianten aktiv
        </span>
        <button onClick={onRender} disabled={rendering || approvedCount === 0}
          className="bg-[#00D4FF] hover:bg-[#00b4d8] disabled:opacity-50 text-black font-bold py-2.5 px-6 rounded-full text-sm transition-all btn-primary shadow-[0_4px_20px_rgba(0,212,255,0.3)]">
          {rendering
            ? 'Rendering...'
            : `Alle rendern (${approvedCount} × ${formats.length} = ${totalPngs} PNGs)`}
        </button>
      </div>
    </div>
  );
}
