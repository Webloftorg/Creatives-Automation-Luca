// components/variant-card.tsx
'use client';

import { LivePreview } from '@/components/live-preview';
import type { CampaignVariant } from '@/lib/types';

interface VariantCardProps {
  variant: CampaignVariant;
  onToggleApproved: () => void;
  onEdit: () => void;
}

export function VariantCard({ variant, onToggleApproved, onEdit }: VariantCardProps) {
  return (
    <div className={`bg-[#111] border rounded-xl overflow-hidden transition-all ${
      variant.approved ? 'border-[#333]' : 'border-[#222] opacity-30 grayscale'
    }`}>
      <div className="relative h-48 bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
        <LivePreview
          html={variant.templateHtml}
          width={1080}
          height={1080}
          fieldValues={variant.fieldValues}
        />
        <div className="absolute top-2 right-2 flex gap-1">
          <button onClick={onEdit}
            className="w-7 h-7 bg-black/70 rounded-md text-white text-xs flex items-center justify-center hover:bg-[#FF4500] transition-colors"
            title="Editieren">
            ✏️
          </button>
          <button onClick={onToggleApproved}
            className={`w-7 h-7 rounded-md text-xs flex items-center justify-center transition-colors ${
              variant.approved
                ? 'bg-black/70 text-white hover:bg-red-600'
                : 'bg-[#4CAF50] text-white'
            }`}
            title={variant.approved ? 'Entfernen' : 'Wiederherstellen'}>
            {variant.approved ? '×' : '↩'}
          </button>
        </div>
      </div>
      <div className="p-3">
        <p className="text-white text-sm font-semibold truncate">{variant.fieldValues.headline || 'Kein Headline'}</p>
        <p className="text-[#666] text-xs mt-0.5">{variant.fieldValues.price || ''}</p>
      </div>
    </div>
  );
}
