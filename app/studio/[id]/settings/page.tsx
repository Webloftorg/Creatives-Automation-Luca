'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ColorPicker } from '@/components/color-picker';
import { DEFAULT_PROMPTS } from '@/lib/prompts';
import type { Studio, PromptType } from '@/lib/types';

const PROMPT_SECTIONS: { type: PromptType; label: string; description: string }[] = [
  { type: 'copy-generation', label: 'Headline-Stil', description: 'Steuert wie die AI Headlines und CTAs für dein Studio generiert' },
  { type: 'parameter-variation' as PromptType, label: 'Layout-Variationen', description: 'Steuert wie die AI diverse CSS-Parameter-Variationen fuer Kampagnen generiert' },
  { type: 'template-editing', label: 'Template-Anpassung', description: 'Steuert wie die AI bestehende Templates auf Anweisung ändert' },
];

const FONTS = ['Montserrat', 'Oswald', 'Bebas Neue', 'Roboto Condensed', 'Anton', 'Teko'];

export default function SettingsPage() {
  const { id: studioId } = useParams<{ id: string }>();
  const [studio, setStudio] = useState<Studio | null>(null);
  const [prompts, setPrompts] = useState<Record<PromptType, string>>({
    'copy-generation': '',
    'parameter-variation': '',
    'template-editing': '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/studios/${studioId}`).then(r => r.json()).then(setStudio);
    fetch(`/api/prompts/${studioId}`).then(r => r.json()).then(setPrompts);
  }, [studioId]);

  const saveStudio = async () => {
    if (!studio) return;
    setSaving(true);
    await fetch(`/api/studios/${studioId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studio),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!studio) return <div className="p-6 text-[#6b7280]">Lade...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold mb-6 font-[family-name:var(--font-heading)]">Einstellungen</h1>

      {/* Studio Data */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-[#9ca3af] uppercase tracking-wider mb-4">Studio-Daten</h2>
        <div className="space-y-3">
          <div>
            <label className="text-[#9ca3af] text-xs uppercase tracking-wider">Name</label>
            <input value={studio.name} onChange={e => setStudio({ ...studio, name: e.target.value })}
              className="w-full bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm mt-1 outline-none focus:border-[#00D4FF]/50" />
          </div>
          <div>
            <label className="text-[#9ca3af] text-xs uppercase tracking-wider">Standort</label>
            <input value={studio.location} onChange={e => setStudio({ ...studio, location: e.target.value })}
              className="w-full bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm mt-1 outline-none focus:border-[#00D4FF]/50" />
          </div>
          <div>
            <label className="text-[#9ca3af] text-xs uppercase tracking-wider">Website URL (optional)</label>
            <input value={studio.websiteUrl || ''} onChange={e => setStudio({ ...studio, websiteUrl: e.target.value })}
              className="w-full bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm mt-1 outline-none focus:border-[#00D4FF]/50"
              placeholder="https://dein-studio.de" />
            <p className="text-[#6b7280] text-xs mt-1">Wird fuer automatische Stil- und Farbanalyse verwendet</p>
          </div>
          <div>
            <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-2 block">Farben</label>
            <div className="flex gap-3">
              <ColorPicker label="Primär" value={studio.primaryColor} onChange={v => setStudio({ ...studio, primaryColor: v })} />
              <ColorPicker label="Sekundär" value={studio.secondaryColor} onChange={v => setStudio({ ...studio, secondaryColor: v })} />
              <ColorPicker label="Akzent" value={studio.accentColor} onChange={v => setStudio({ ...studio, accentColor: v })} />
            </div>
          </div>
          <div>
            <label className="text-[#9ca3af] text-xs uppercase tracking-wider">Font</label>
            <select value={studio.defaultFont} onChange={e => setStudio({ ...studio, defaultFont: e.target.value })}
              className="w-full bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm mt-1 outline-none">
              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <button onClick={saveStudio} disabled={saving}
            className="bg-[#00D4FF] hover:bg-[#00b4d8] disabled:opacity-50 text-black font-bold py-2.5 px-6 rounded-full text-sm transition-all btn-primary">
            {saving ? 'Speichert...' : saved ? 'Gespeichert ✓' : 'Speichern'}
          </button>
        </div>
      </section>

      {/* System Prompts */}
      <section>
        <h2 className="text-sm font-semibold text-[#9ca3af] uppercase tracking-wider mb-4">AI-Prompts</h2>
        <div className="space-y-6">
          {PROMPT_SECTIONS.map(section => (
            <div key={section.type}>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[#9ca3af] text-xs uppercase tracking-wider">{section.label}</label>
                <button onClick={() => setPrompts(p => ({ ...p, [section.type]: DEFAULT_PROMPTS[section.type] }))}
                  className="text-[#6b7280] text-xs border border-white/10 rounded px-2 py-0.5 hover:text-white">
                  Standard
                </button>
              </div>
              <p className="text-[#6b7280] text-xs mb-2">{section.description}</p>
              <textarea
                value={prompts[section.type]}
                onChange={e => setPrompts(p => ({ ...p, [section.type]: e.target.value }))}
                className="w-full bg-[#0e0e15] border border-white/10 rounded-lg p-3 text-[#9ca3af] text-xs h-32 resize-none outline-none focus:border-[#00D4FF]/50"
              />
            </div>
          ))}
          <button
            onClick={async () => {
              setSaving(true);
              await fetch(`/api/prompts/${studioId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(prompts),
              });
              setSaving(false);
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
            className="bg-[#00D4FF] hover:bg-[#00b4d8] disabled:opacity-50 text-black font-bold py-2.5 px-6 rounded-full text-sm transition-all btn-primary"
          >
            Prompts speichern
          </button>
        </div>
      </section>
    </div>
  );
}
