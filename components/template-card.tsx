'use client';

import { LivePreview } from '@/components/live-preview';
import type { SavedTemplate } from '@/lib/types';

interface TemplateCardProps {
  template: SavedTemplate;
  onUse: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function TemplateCard({ template, onUse, onEdit, onDuplicate, onDelete }: TemplateCardProps) {
  return (
    <div className="bg-[#111] border border-[#333] rounded-xl overflow-hidden">
      <div className="h-36 bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
        {template.htmlContent ? (
          <LivePreview html={template.htmlContent} width={1080} height={1080} fieldValues={{
            headline: 'HEADLINE', price: '39,90\u20AC', originalPrice: '89,90\u20AC',
            location: 'Standort', primaryColor: '#FF4500', accentColor: '#FF6B00',
          }} />
        ) : (
          <span className="text-[#444] text-sm">Vorschau</span>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-white font-semibold text-sm">{template.name}</h3>
        <p className="text-[#666] text-xs mt-0.5">{template.type} · v{template.version}</p>
        <div className="flex gap-1.5 mt-3">
          <button onClick={onUse} className="flex-1 bg-[#FF4500] text-white text-xs py-1.5 rounded-md font-semibold">
            Verwenden
          </button>
          <button onClick={onEdit} className="flex-1 bg-[#222] border border-[#333] text-[#ccc] text-xs py-1.5 rounded-md">
            Editieren
          </button>
          <div className="relative group">
            <button className="bg-[#222] border border-[#333] text-[#666] text-xs py-1.5 px-2 rounded-md">⋯</button>
            <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg py-1 hidden group-hover:block z-10 min-w-[120px]">
              <button onClick={onDuplicate} className="w-full text-left px-3 py-1.5 text-xs text-[#ccc] hover:bg-[#222]">Duplizieren</button>
              <button onClick={onDelete} className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-[#222]">Löschen</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
