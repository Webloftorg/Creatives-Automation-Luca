// components/campaign-setup.tsx
'use client';

import { useState, useEffect } from 'react';
import { AssetGrid } from '@/components/asset-grid';
import { FORMAT_DIMENSIONS } from '@/lib/formats';
import type { SavedTemplate, CreativeFormat } from '@/lib/types';

interface CampaignSetupProps {
  studioId: string;
  onGenerate: (config: {
    name: string;
    baseTemplateId?: string;
    designVariantCount: number;
    headlineVariantCount: number;
    formats: CreativeFormat[];
    defaultValues: Record<string, string>;
  }) => void;
  loading: boolean;
}

export function CampaignSetup({ studioId, onGenerate, loading }: CampaignSetupProps) {
  const [name, setName] = useState('');
  const [baseTemplateId, setBaseTemplateId] = useState<string>('');
  const [designCount, setDesignCount] = useState(2);
  const [headlineCount, setHeadlineCount] = useState(3);
  const [formats, setFormats] = useState<CreativeFormat[]>(
    Object.keys(FORMAT_DIMENSIONS) as CreativeFormat[]
  );
  const [price, setPrice] = useState('39,90€');
  const [originalPrice, setOriginalPrice] = useState('89,90€');
  const [selectedPerson, setSelectedPerson] = useState('');
  const [selectedBg, setSelectedBg] = useState('');

  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [personAssets, setPersonAssets] = useState<string[]>([]);
  const [bgAssets, setBgAssets] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/templates?studioId=${studioId}`).then(r => r.json()),
      fetch('/api/templates').then(r => r.json()),
      fetch(`/api/assets/${studioId}?type=person`).then(r => r.json()),
      fetch(`/api/assets/${studioId}?type=background`).then(r => r.json()),
    ]).then(([studioTemplates, allTemplates, persons, bgs]) => {
      const ids = new Set(studioTemplates.map((t: SavedTemplate) => t.id));
      const globals = allTemplates.filter((t: SavedTemplate) => !t.studioId && !ids.has(t.id));
      setTemplates([...studioTemplates, ...globals]);
      setPersonAssets(persons);
      setBgAssets(bgs);
    });
  }, [studioId]);

  const toggleFormat = (f: CreativeFormat) => {
    setFormats(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
    );
  };

  const handleSubmit = () => {
    onGenerate({
      name: name || `Kampagne ${new Date().toLocaleDateString('de')}`,
      baseTemplateId: baseTemplateId || undefined,
      designVariantCount: baseTemplateId ? 1 : designCount,
      headlineVariantCount: headlineCount,
      formats,
      defaultValues: {
        price,
        originalPrice,
        location: '',
        backgroundImage: selectedBg ? `/api/assets/serve?path=${encodeURIComponent(selectedBg)}` : '',
        personImage: selectedPerson ? `/api/assets/serve?path=${encodeURIComponent(selectedPerson)}` : '',
      },
    });
  };

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Kampagnen-Name</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm outline-none"
          placeholder="z.B. Sommerspezial Juli" />
      </div>

      <div>
        <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Template-Basis</label>
        <select value={baseTemplateId} onChange={e => setBaseTemplateId(e.target.value)}
          className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm outline-none">
          <option value="">AI generiert neue Designs</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {!baseTemplateId && (
        <div>
          <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">
            Design-Varianten: {designCount}
          </label>
          <input type="range" min={1} max={4} value={designCount}
            onChange={e => setDesignCount(Number(e.target.value))}
            className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#FF4500]" />
        </div>
      )}

      <div>
        <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">
          Headline-Varianten: {headlineCount}
        </label>
        <input type="range" min={2} max={5} value={headlineCount}
          onChange={e => setHeadlineCount(Number(e.target.value))}
          className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#FF4500]" />
      </div>

      <div>
        <label className="text-[#888] text-xs uppercase tracking-wider mb-1.5 block">Formate</label>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(FORMAT_DIMENSIONS).map(([key, val]) => (
            <button key={key} onClick={() => toggleFormat(key as CreativeFormat)}
              className={`text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${
                formats.includes(key as CreativeFormat)
                  ? 'bg-[#FF4500] text-white'
                  : 'bg-[#1a1a1a] border border-[#333] text-[#666]'
              }`}>
              {val.label.split(' (')[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Preis</label>
          <input value={price} onChange={e => setPrice(e.target.value)}
            className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2.5 text-[#FF4500] text-sm font-bold outline-none" />
        </div>
        <div className="flex-1">
          <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Streichpreis</label>
          <input value={originalPrice} onChange={e => setOriginalPrice(e.target.value)}
            className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2.5 text-[#888] text-sm outline-none" />
        </div>
      </div>

      <div>
        <label className="text-[#888] text-xs uppercase tracking-wider mb-1.5 block">Person</label>
        <AssetGrid assets={personAssets} selected={selectedPerson} onSelect={setSelectedPerson} size="sm" />
      </div>

      <div>
        <label className="text-[#888] text-xs uppercase tracking-wider mb-1.5 block">Hintergrund</label>
        <AssetGrid assets={bgAssets} selected={selectedBg} onSelect={setSelectedBg} size="sm" />
      </div>

      <button onClick={handleSubmit} disabled={loading || formats.length === 0}
        className="w-full bg-[#FF4500] hover:bg-[#e63e00] disabled:opacity-50 text-white font-bold py-3 rounded-lg text-sm transition-colors">
        {loading ? 'Generiere Varianten...' : `Varianten generieren ✨ (${baseTemplateId ? 1 : designCount} × ${headlineCount} = ${(baseTemplateId ? 1 : designCount) * headlineCount})`}
      </button>
    </div>
  );
}
