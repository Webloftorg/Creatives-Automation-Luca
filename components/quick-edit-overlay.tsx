// components/quick-edit-overlay.tsx
'use client';

import { useState } from 'react';
import { LivePreview } from '@/components/live-preview';
import { AssetGrid } from '@/components/asset-grid';
import type { CampaignVariant } from '@/lib/types';

interface QuickEditOverlayProps {
  variant: CampaignVariant;
  personAssets: string[];
  bgAssets: string[];
  onSave: (updatedValues: Record<string, string>) => void;
  onClose: () => void;
}

export function QuickEditOverlay({ variant, personAssets, bgAssets, onSave, onClose }: QuickEditOverlayProps) {
  const [values, setValues] = useState({ ...variant.fieldValues });

  const updateField = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8" onClick={onClose}>
      <div className="bg-[#111] border border-[#333] rounded-2xl max-w-3xl w-full flex overflow-hidden max-h-[90vh]"
        onClick={e => e.stopPropagation()}>
        {/* Preview */}
        <div className="flex-1 bg-[#0a0a0a] flex items-center justify-center p-6">
          <LivePreview html={variant.templateHtml} width={1080} height={1080} fieldValues={values} />
        </div>

        {/* Edit fields */}
        <div className="w-72 p-5 overflow-y-auto space-y-4">
          <h3 className="text-white font-bold">Quick Edit</h3>

          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Headline</label>
            <input value={values.headline || ''} onChange={e => updateField('headline', e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm outline-none" />
          </div>

          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Preis</label>
            <input value={values.price || ''} onChange={e => updateField('price', e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-[#FF4500] text-sm font-bold outline-none" />
          </div>

          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Streichpreis</label>
            <input value={values.originalPrice || ''} onChange={e => updateField('originalPrice', e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-[#888] text-sm outline-none" />
          </div>

          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider mb-1.5 block">Person</label>
            <AssetGrid assets={personAssets}
              selected={values.personImage ? decodeURIComponent(values.personImage.split('path=')[1] || '') : ''}
              onSelect={p => updateField('personImage', `/api/assets/serve?path=${encodeURIComponent(p)}`)}
              size="sm" />
          </div>

          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider mb-1.5 block">Hintergrund</label>
            <AssetGrid assets={bgAssets}
              selected={values.backgroundImage ? decodeURIComponent(values.backgroundImage.split('path=')[1] || '') : ''}
              onSelect={p => updateField('backgroundImage', `/api/assets/serve?path=${encodeURIComponent(p)}`)}
              size="sm" />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={() => onSave(values)}
              className="flex-1 bg-[#FF4500] text-white font-bold py-2.5 rounded-lg text-sm">
              Übernehmen
            </button>
            <button onClick={onClose}
              className="flex-1 bg-[#222] border border-[#333] text-[#ccc] py-2.5 rounded-lg text-sm">
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
