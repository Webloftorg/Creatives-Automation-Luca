// components/variant-grid.tsx
'use client';

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
}

export function VariantGrid({ variants, formats, onToggleApproved, onEdit, onRegenerate, onRender, rendering, onFeedback, feedbackMap }: VariantGridProps) {
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
              onRegenerate={() => onRegenerate(v.id)}
              feedback={feedbackMap[v.id] || null}
              onFeedback={(rating, comment) => onFeedback(v.id, rating, comment)}
            />
          ))}
        </div>
      </div>

      {/* Footer bar */}
      <div className="glass-panel px-6 py-4 flex justify-between items-center flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
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
