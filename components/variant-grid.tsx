// components/variant-grid.tsx
'use client';

import { VariantCard } from '@/components/variant-card';
import type { CampaignVariant, CreativeFormat } from '@/lib/types';

interface VariantGridProps {
  variants: CampaignVariant[];
  formats: CreativeFormat[];
  onToggleApproved: (variantId: string) => void;
  onEdit: (variantId: string) => void;
  onRender: () => void;
  rendering: boolean;
}

export function VariantGrid({ variants, formats, onToggleApproved, onEdit, onRender, rendering }: VariantGridProps) {
  const approvedCount = variants.filter(v => v.approved).length;
  const totalPngs = approvedCount * formats.length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {variants.map(v => (
            <VariantCard
              key={v.id}
              variant={v}
              onToggleApproved={() => onToggleApproved(v.id)}
              onEdit={() => onEdit(v.id)}
            />
          ))}
        </div>
      </div>

      {/* Footer bar */}
      <div className="bg-[#111] border-t border-[#222] px-6 py-4 flex justify-between items-center flex-shrink-0">
        <span className="text-[#888] text-sm">
          {approvedCount} von {variants.length} Varianten aktiv
        </span>
        <button onClick={onRender} disabled={rendering || approvedCount === 0}
          className="bg-[#FF4500] hover:bg-[#e63e00] disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors">
          {rendering
            ? 'Rendering...'
            : `Alle rendern (${approvedCount} × ${formats.length} = ${totalPngs} PNGs)`}
        </button>
      </div>
    </div>
  );
}
