// components/strategy-review.tsx
'use client';

import type { CampaignStrategy } from '@/lib/types';

const TEMPLATE_NAMES: Record<string, string> = {
  'dark-center': 'Dark Center (GYMPOD)',
  'split-bold': 'Split Bold (wellfit)',
  'minimal-light': 'Minimal Light (JONNY M.)',
  'full-impact': 'Full Impact (Vorverkauf)',
  'editorial': 'Editorial (Magazin)',
};

interface StrategyReviewProps {
  strategy: CampaignStrategy;
  onChange: (updated: CampaignStrategy) => void;
  onApply: () => void;
  onReanalyze: () => void;
  onSkip: () => void;
  analyzing: boolean;
  generating?: boolean;
}

export function StrategyReview({ strategy, onChange, onApply, onReanalyze, onSkip, analyzing, generating }: StrategyReviewProps) {
  const update = (partial: Partial<CampaignStrategy>) => {
    onChange({ ...strategy, ...partial });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white font-bold text-lg mb-1 font-[family-name:var(--font-heading)]">Kampagnenstrategie</h2>
        <p className="text-[#9ca3af] text-sm">Die KI hat dein Referenz-Creative analysiert. Passe die Strategie an und uebernimm sie.</p>
      </div>

      {/* Template Selection */}
      <div className="glass-card rounded-xl p-4 space-y-3">
        <div>
          <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-1 block">Template</label>
          <select
            value={strategy.templateId}
            onChange={e => update({ templateId: e.target.value })}
            className="w-full bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#00D4FF]/50"
          >
            {Object.entries(TEMPLATE_NAMES).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <p className="text-[#6b7280] text-xs mt-1 italic">{strategy.templateReason}</p>
        </div>

        {/* Colors */}
        <div>
          <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-2 block">Farben</label>
          <div className="flex gap-3">
            {([
              ['primaryColor', 'Primaer'] as const,
              ['secondaryColor', 'Sekundaer'] as const,
              ['accentColor', 'Akzent'] as const,
            ]).map(([key, label]) => (
              <div key={key} className="flex-1">
                <label className="text-[#6b7280] text-[10px] uppercase">{label}</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={strategy[key]}
                    onChange={e => update({ [key]: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border border-white/10 bg-transparent" />
                  <input value={strategy[key]}
                    onChange={e => update({ [key]: e.target.value })}
                    className="flex-1 bg-[#0e0e15] border border-white/10 rounded px-2 py-1.5 text-white text-xs outline-none font-mono focus:border-[#00D4FF]/50" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex mt-2 rounded-lg overflow-hidden h-3">
            <div className="flex-1" style={{ backgroundColor: strategy.primaryColor }} />
            <div className="flex-1" style={{ backgroundColor: strategy.secondaryColor }} />
            <div className="flex-1" style={{ backgroundColor: strategy.accentColor }} />
          </div>
        </div>
      </div>

      {/* Creative Direction */}
      <div className="glass-card rounded-xl p-4 space-y-3">
        <label className="text-[#9ca3af] text-xs uppercase tracking-wider block">Kreative Richtung</label>
        {([
          ['mood', 'Stimmung'] as const,
          ['headlineStyle', 'Headline-Stil'] as const,
          ['personStyle', 'Personen-Stil'] as const,
          ['backgroundStyle', 'Hintergrund-Stil'] as const,
        ]).map(([key, label]) => (
          <div key={key}>
            <label className="text-[#6b7280] text-xs mb-1 block">{label}</label>
            <input
              value={strategy[key]}
              onChange={e => update({ [key]: e.target.value })}
              className="w-full bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-[#00D4FF]/50"
            />
          </div>
        ))}
      </div>

      {/* Image Prompts */}
      <div className="glass-card rounded-xl p-4 space-y-3">
        <label className="text-[#9ca3af] text-xs uppercase tracking-wider block">Bild-Prompts</label>
        <div>
          <label className="text-[#6b7280] text-xs mb-1 block">Personen-Prompt</label>
          <textarea
            value={strategy.personPrompt}
            onChange={e => update({ personPrompt: e.target.value })}
            className="w-full bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none resize-none h-16 focus:border-[#00D4FF]/50"
          />
        </div>
        <div>
          <label className="text-[#6b7280] text-xs mb-1 block">Hintergrund-Prompt</label>
          <textarea
            value={strategy.backgroundPrompt}
            onChange={e => update({ backgroundPrompt: e.target.value })}
            className="w-full bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none resize-none h-16 focus:border-[#00D4FF]/50"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        {generating && (
          <div className="glass-card rounded-lg p-3">
            <p className="text-[#00D4FF] text-xs font-semibold mb-2">Kampagne wird generiert...</p>
            <div className="w-full h-1.5 bg-white/[0.045] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#00D4FF] to-[#0090cc] rounded-full animate-pulse shadow-[0_0_10px_rgba(0,212,255,0.3)]" style={{ width: '60%' }} />
            </div>
            <p className="text-[#6b7280] text-[10px] mt-1.5">Bilder werden generiert, Layouts berechnet...</p>
          </div>
        )}
        <button onClick={onApply} disabled={generating}
          className="w-full bg-gradient-to-r from-[#00D4FF] to-[#0090cc] hover:from-[#00b4d8] hover:to-[#0080b5] disabled:opacity-50 text-black font-bold py-3.5 rounded-full text-sm transition-all shadow-[0_8px_32px_rgba(0,212,255,0.25)] btn-primary">
          {generating ? 'Generiere Kampagne...' : 'Kampagne direkt generieren'}
        </button>
        <div className="flex gap-2">
          <button onClick={onSkip}
            className="flex-1 bg-white/[0.045] border border-white/10 hover:bg-white/[0.08] text-[#e8eaed] font-semibold py-2.5 rounded-full text-xs transition-all backdrop-blur-sm">
            Manuell anpassen
          </button>
          <button onClick={onReanalyze} disabled={analyzing}
            className="flex-1 bg-white/[0.045] border border-white/10 hover:bg-white/[0.08] disabled:opacity-50 text-[#e8eaed] font-semibold py-2.5 rounded-full text-xs transition-all backdrop-blur-sm">
            {analyzing ? 'Analysiere...' : 'Nochmal analysieren'}
          </button>
        </div>
      </div>
    </div>
  );
}
