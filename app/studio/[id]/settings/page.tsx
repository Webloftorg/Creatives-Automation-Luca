'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ColorPicker } from '@/components/color-picker';
import { DEFAULT_PROMPTS } from '@/lib/prompts';
import type { Studio, PromptType } from '@/lib/types';

const PROMPT_SECTIONS: { type: PromptType; label: string; description: string }[] = [
  { type: 'copy-generation', label: 'Headline-Stil', description: 'Steuert wie die AI Headlines und CTAs für dein Studio generiert' },
  { type: 'template-generation', label: 'Template-Erstellung', description: 'Steuert wie die AI neue Templates für dein Studio designt' },
  { type: 'template-editing', label: 'Template-Anpassung', description: 'Steuert wie die AI bestehende Templates auf Anweisung ändert' },
];

const FONTS = ['Montserrat', 'Oswald', 'Bebas Neue', 'Roboto Condensed', 'Anton', 'Teko'];

export default function SettingsPage() {
  const { id: studioId } = useParams<{ id: string }>();
  const [studio, setStudio] = useState<Studio | null>(null);
  const [prompts, setPrompts] = useState<Record<PromptType, string>>({
    'copy-generation': '',
    'template-generation': '',
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

  if (!studio) return <div className="p-6 text-[#666]">Lade...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold mb-6">Einstellungen</h1>

      {/* Studio Data */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-[#aaa] uppercase tracking-wider mb-4">Studio-Daten</h2>
        <div className="space-y-3">
          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider">Name</label>
            <input value={studio.name} onChange={e => setStudio({ ...studio, name: e.target.value })}
              className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm mt-1 outline-none" />
          </div>
          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider">Standort</label>
            <input value={studio.location} onChange={e => setStudio({ ...studio, location: e.target.value })}
              className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm mt-1 outline-none" />
          </div>
          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider mb-2 block">Farben</label>
            <div className="flex gap-3">
              <ColorPicker label="Primär" value={studio.primaryColor} onChange={v => setStudio({ ...studio, primaryColor: v })} />
              <ColorPicker label="Sekundär" value={studio.secondaryColor} onChange={v => setStudio({ ...studio, secondaryColor: v })} />
              <ColorPicker label="Akzent" value={studio.accentColor} onChange={v => setStudio({ ...studio, accentColor: v })} />
            </div>
          </div>
          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider">Font</label>
            <select value={studio.defaultFont} onChange={e => setStudio({ ...studio, defaultFont: e.target.value })}
              className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm mt-1 outline-none">
              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <button onClick={saveStudio} disabled={saving}
            className="bg-[#FF4500] hover:bg-[#e63e00] disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors">
            {saving ? 'Speichert...' : saved ? 'Gespeichert ✓' : 'Speichern'}
          </button>
        </div>
      </section>

      {/* System Prompts */}
      <section>
        <h2 className="text-sm font-semibold text-[#aaa] uppercase tracking-wider mb-4">AI-Prompts</h2>
        <div className="space-y-6">
          {PROMPT_SECTIONS.map(section => (
            <div key={section.type}>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[#aaa] text-xs uppercase tracking-wider">{section.label}</label>
                <button onClick={() => setPrompts(p => ({ ...p, [section.type]: DEFAULT_PROMPTS[section.type] }))}
                  className="text-[#666] text-xs border border-[#333] rounded px-2 py-0.5 hover:text-white">
                  Standard
                </button>
              </div>
              <p className="text-[#555] text-xs mb-2">{section.description}</p>
              <textarea
                value={prompts[section.type]}
                onChange={e => setPrompts(p => ({ ...p, [section.type]: e.target.value }))}
                className="w-full bg-[#111] border border-[#333] rounded-lg p-3 text-[#aaa] text-xs h-32 resize-none outline-none focus:border-[#FF4500]"
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
            className="bg-[#FF4500] hover:bg-[#e63e00] disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors"
          >
            Prompts speichern
          </button>
        </div>
      </section>
    </div>
  );
}
