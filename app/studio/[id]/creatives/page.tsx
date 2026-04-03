'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { FormatSelector } from '@/components/format-selector';
import { HeadlineSuggestions } from '@/components/headline-suggestions';
import { AssetGrid } from '@/components/asset-grid';
import { LivePreview } from '@/components/live-preview';
import { BatchPanel } from '@/components/batch-panel';
import { CssVarSlider } from '@/components/css-var-slider';
import { ImageGenerator } from '@/components/image-generator';
import { replacePlaceholders, extractCssVariables } from '@/lib/template-utils';
import { FORMAT_DIMENSIONS, ALL_FORMATS } from '@/lib/formats';
import type { Studio, SavedTemplate, CreativeFormat, CreativeOutput } from '@/lib/types';

export default function CreativesPage() {
  const { id: studioId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const preselectedTemplateId = searchParams.get('templateId');

  const [studio, setStudio] = useState<Studio | null>(null);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SavedTemplate | null>(null);
  const [format, setFormat] = useState<CreativeFormat>('instagram-post');

  // Field values
  const [headline, setHeadline] = useState('MONATLICH KÜNDBAR');
  const [price, setPrice] = useState('39,90€');
  const [originalPrice, setOriginalPrice] = useState('89,90€');
  const [selectedPerson, setSelectedPerson] = useState('');
  const [selectedBg, setSelectedBg] = useState('');

  // Style overrides
  const [cssVars, setCssVars] = useState<Record<string, string>>({});

  // Render state
  const [outputs, setOutputs] = useState<CreativeOutput[]>([]);
  const [rendering, setRendering] = useState(false);

  // Asset lists
  const [personAssets, setPersonAssets] = useState<string[]>([]);
  const [bgAssets, setBgAssets] = useState<string[]>([]);

  // Image generation
  const [showBgGen, setShowBgGen] = useState(false);
  const [showPersonGen, setShowPersonGen] = useState(false);

  // Left panel tab
  const [activeTab, setActiveTab] = useState<'inhalt' | 'stil'>('inhalt');

  const loadAssets = async () => {
    const [persons, bgs] = await Promise.all([
      fetch(`/api/assets/${studioId}?type=person`).then(r => r.json()),
      fetch(`/api/assets/${studioId}?type=background`).then(r => r.json()),
    ]);
    setPersonAssets(persons);
    setBgAssets(bgs);
  };

  useEffect(() => {
    Promise.all([
      fetch(`/api/studios/${studioId}`).then(r => r.json()),
      fetch(`/api/templates?studioId=${studioId}`).then(r => r.json()),
      fetch(`/api/templates`).then(r => r.json()),
    ]).then(([studioData, studioTemplates, allTemplates]) => {
      setStudio(studioData);
      const ids = new Set(studioTemplates.map((t: SavedTemplate) => t.id));
      const globals = allTemplates.filter((t: SavedTemplate) => !t.studioId && !ids.has(t.id));
      const merged = [...studioTemplates, ...globals];
      setTemplates(merged);

      let initial: SavedTemplate | null = null;
      if (preselectedTemplateId) {
        initial = merged.find((t: SavedTemplate) => t.id === preselectedTemplateId) || null;
      } else if (merged.length > 0) {
        initial = merged[0];
      }
      if (initial) {
        setSelectedTemplate(initial);
        setCssVars(extractCssVariables(initial.htmlContent));
      }
    });
    loadAssets();
  }, [studioId, preselectedTemplateId]);

  // Apply CSS var overrides to template HTML
  const getStyledHtml = (html: string): string => {
    let styled = html;
    for (const [key, value] of Object.entries(cssVars)) {
      styled = styled.replace(
        new RegExp(`(${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*)([^;]+)`),
        `$1${value}`,
      );
    }
    return styled;
  };

  const handleCssVarChange = (key: string, value: string) => {
    setCssVars(prev => ({ ...prev, [key]: value }));
  };

  const buildFieldValues = (): Record<string, string> => ({
    headline,
    price,
    originalPrice,
    location: studio?.location || '',
    primaryColor: studio?.primaryColor || '#FF4500',
    accentColor: studio?.accentColor || '#FF6B00',
    backgroundImage: selectedBg ? `/api/assets/serve?path=${encodeURIComponent(selectedBg)}` : '',
    personImage: selectedPerson ? `/api/assets/serve?path=${encodeURIComponent(selectedPerson)}` : '',
    logo: studio?.logo || '',
  });

  const dims = FORMAT_DIMENSIONS[format];

  const renderSingle = async () => {
    if (!selectedTemplate) return;
    setRendering(true);

    const values = { ...buildFieldValues(), width: String(dims.width), height: String(dims.height) };
    const html = replacePlaceholders(getStyledHtml(selectedTemplate.htmlContent), values);

    const newOutput: CreativeOutput = { format, status: 'rendering' };
    setOutputs(prev => [...prev, newOutput]);

    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, width: dims.width, height: dims.height }),
      });

      if (!res.ok) throw new Error('Render failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      setOutputs(prev => prev.map(o =>
        o === newOutput ? { ...o, status: 'done', outputPath: url } : o
      ));
    } catch {
      setOutputs(prev => prev.map(o =>
        o === newOutput ? { ...o, status: 'error', error: 'Render fehlgeschlagen' } : o
      ));
    } finally {
      setRendering(false);
    }
  };

  const renderAllFormats = async () => {
    if (!selectedTemplate) return;
    setRendering(true);

    const newOutputs: CreativeOutput[] = ALL_FORMATS.map(f => ({ format: f, status: 'rendering' as const }));
    setOutputs(prev => [...prev, ...newOutputs]);

    await Promise.all(ALL_FORMATS.map(async (fmt, idx) => {
      const d = FORMAT_DIMENSIONS[fmt];
      const values = { ...buildFieldValues(), width: String(d.width), height: String(d.height) };
      const html = replacePlaceholders(getStyledHtml(selectedTemplate.htmlContent), values);

      try {
        const res = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html, width: d.width, height: d.height }),
        });
        if (!res.ok) throw new Error('Render failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        setOutputs(prev => prev.map((o, i) =>
          i === prev.length - ALL_FORMATS.length + idx ? { ...o, status: 'done', outputPath: url } : o
        ));
      } catch {
        setOutputs(prev => prev.map((o, i) =>
          i === prev.length - ALL_FORMATS.length + idx ? { ...o, status: 'error', error: 'Render failed' } : o
        ));
      }
    }));

    setRendering(false);
  };

  const downloadFile = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `creative-${Date.now()}.png`;
    a.click();
  };

  const downloadAllAsZip = async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const output of outputs.filter(o => o.status === 'done' && o.outputPath)) {
      const blob = await fetch(output.outputPath!).then(r => r.blob());
      zip.file(`creative-${output.format}-${Date.now()}.png`, blob);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `creatives-${studioId}-${Date.now()}.zip`;
    a.click();
  };

  return (
    <div className="flex h-full">
      {/* Left: Editor Panel */}
      <div className="w-[320px] bg-[#111] border-r border-[#222] flex flex-col flex-shrink-0">
        {/* Tab switcher */}
        <div className="flex border-b border-[#222] flex-shrink-0">
          <button onClick={() => setActiveTab('inhalt')}
            className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === 'inhalt' ? 'text-[#FF4500] border-b-2 border-[#FF4500]' : 'text-[#666] hover:text-white'
            }`}>
            Inhalt
          </button>
          <button onClick={() => setActiveTab('stil')}
            className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === 'stil' ? 'text-[#FF4500] border-b-2 border-[#FF4500]' : 'text-[#666] hover:text-white'
            }`}>
            Stil
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'inhalt' ? (
            <>
              {/* Template */}
              <div>
                <label className="text-[#888] text-xs uppercase tracking-wider">Template</label>
                <select
                  value={selectedTemplate?.id || ''}
                  onChange={e => {
                    const t = templates.find(t => t.id === e.target.value) || null;
                    setSelectedTemplate(t);
                    if (t) setCssVars(extractCssVariables(t.htmlContent));
                  }}
                  className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm mt-1 outline-none"
                >
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {/* Format */}
              <div>
                <label className="text-[#888] text-xs uppercase tracking-wider mb-1.5 block">Format</label>
                <FormatSelector selected={format} onChange={setFormat} />
              </div>

              {/* Headline */}
              <div>
                <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Headline</label>
                <div className="flex gap-1.5">
                  <input value={headline} onChange={e => setHeadline(e.target.value)}
                    className="flex-1 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm outline-none" />
                  <HeadlineSuggestions studioId={studioId} price={price} originalPrice={originalPrice}
                    onSelect={setHeadline} />
                </div>
              </div>

              {/* Prices */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Preis</label>
                  <input value={price} onChange={e => setPrice(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-[#FF4500] text-sm font-bold outline-none" />
                </div>
                <div className="flex-1">
                  <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Streichpreis</label>
                  <input value={originalPrice} onChange={e => setOriginalPrice(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-[#888] text-sm outline-none" />
                </div>
              </div>

              {/* Person */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[#888] text-xs uppercase tracking-wider">Person</label>
                  <button onClick={() => setShowPersonGen(!showPersonGen)}
                    className="text-[#FF4500] text-xs hover:text-[#e63e00]">
                    {showPersonGen ? 'Schliessen' : 'AI generieren'}
                  </button>
                </div>
                <AssetGrid assets={personAssets} selected={selectedPerson} onSelect={setSelectedPerson} size="sm" />
                {showPersonGen && (
                  <div className="mt-2">
                    <ImageGenerator studioId={studioId} assetType="person" onGenerated={() => { loadAssets(); setShowPersonGen(false); }} />
                  </div>
                )}
              </div>

              {/* Background */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[#888] text-xs uppercase tracking-wider">Hintergrund</label>
                  <button onClick={() => setShowBgGen(!showBgGen)}
                    className="text-[#FF4500] text-xs hover:text-[#e63e00]">
                    {showBgGen ? 'Schliessen' : 'AI generieren'}
                  </button>
                </div>
                <AssetGrid assets={bgAssets} selected={selectedBg} onSelect={setSelectedBg} size="sm" />
                {showBgGen && (
                  <div className="mt-2">
                    <ImageGenerator studioId={studioId} assetType="background" onGenerated={() => { loadAssets(); setShowBgGen(false); }} />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Stil Tab */
            <CssVarSlider variables={cssVars} onChange={handleCssVarChange} />
          )}
        </div>

        {/* Render buttons - always visible at bottom */}
        <div className="p-4 border-t border-[#222] space-y-2 flex-shrink-0">
          <button onClick={renderSingle} disabled={rendering || !selectedTemplate}
            className="w-full bg-[#FF4500] hover:bg-[#e63e00] disabled:opacity-50 text-white font-bold py-3 rounded-lg text-sm transition-colors">
            {rendering ? 'Rendert...' : 'Creative rendern'}
          </button>
          <button onClick={renderAllFormats} disabled={rendering || !selectedTemplate}
            className="w-full bg-transparent border border-[#FF4500] text-[#FF4500] font-semibold py-2.5 rounded-lg text-xs hover:bg-[#FF4500]/10 transition-colors">
            Alle Formate rendern (4x)
          </button>
        </div>
      </div>

      {/* Center: Preview */}
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0a] p-6">
        {selectedTemplate ? (
          <LivePreview
            html={getStyledHtml(selectedTemplate.htmlContent)}
            width={dims.width}
            height={dims.height}
            fieldValues={buildFieldValues()}
          />
        ) : (
          <div className="text-[#444] text-sm">Waehle ein Template um die Vorschau zu sehen</div>
        )}
      </div>

      {/* Right: Output/Batch */}
      <div className="w-[220px] bg-[#111] border-l border-[#222] p-4 overflow-y-auto flex-shrink-0">
        <BatchPanel
          outputs={outputs}
          onDownload={downloadFile}
          onDownloadAll={downloadAllAsZip}
        />
      </div>
    </div>
  );
}
