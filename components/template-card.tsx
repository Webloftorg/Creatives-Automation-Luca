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
    <div className="glass-card rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-0.5">
      <div className="h-36 bg-[#050507] flex items-center justify-center overflow-hidden">
        {template.htmlContent ? (
          <LivePreview html={template.htmlContent} width={1080} height={1080} fieldValues={{
            headline: template.defaultFieldValues?.headline || 'HEADLINE',
            price: template.defaultFieldValues?.price || '39,90\u20AC',
            originalPrice: template.defaultFieldValues?.originalPrice || '89,90\u20AC',
            location: 'Standort',
            primaryColor: '#00D4FF',
            accentColor: '#0090cc',
            personImage: template.defaultFieldValues?.selectedPerson ? `/api/assets/serve?path=${encodeURIComponent(template.defaultFieldValues.selectedPerson)}` : '',
            backgroundImage: template.defaultFieldValues?.selectedBg ? `/api/assets/serve?path=${encodeURIComponent(template.defaultFieldValues.selectedBg)}` : ''
          }} />
        ) : (
          <span className="text-[#4b5563] text-sm">Vorschau</span>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-white font-semibold text-sm font-[family-name:var(--font-heading)]">{template.name}</h3>
        <p className="text-[#6b7280] text-xs mt-0.5">{template.type} · v{template.version}</p>
        <div className="flex gap-1.5 mt-3">
          <button onClick={onUse} className="flex-1 bg-[#00D4FF] text-black text-xs py-1.5 rounded-full font-semibold btn-primary hover:shadow-[0_4px_20px_rgba(0,212,255,0.3)] transition-all">
            Verwenden
          </button>
          <button onClick={onEdit} className="flex-1 bg-white/[0.045] border border-white/10 text-[#e8eaed] text-xs py-1.5 rounded-full backdrop-blur-sm hover:border-[#00D4FF]/30 transition-all">
            Editieren
          </button>
          <div className="relative group/menu">
            <button className="bg-white/[0.045] border border-white/10 text-[#6b7280] text-xs py-1.5 px-2 rounded-full">⋯</button>
            <div className="absolute right-0 top-full mt-1 glass-panel rounded-lg py-1 hidden group-hover/menu:block z-10 min-w-[120px]">
              <button onClick={onDuplicate} className="w-full text-left px-3 py-1.5 text-xs text-[#e8eaed] hover:bg-white/[0.04]">Duplizieren</button>
              <button onClick={onDelete} className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-white/[0.04]">Löschen</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
