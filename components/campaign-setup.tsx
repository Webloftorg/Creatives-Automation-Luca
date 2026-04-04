// components/campaign-setup.tsx
'use client';

import { useState, useEffect } from 'react';
import { AssetGrid } from '@/components/asset-grid';
import { ImageGenerator } from '@/components/image-generator';
import { TemplatePicker } from '@/components/template-picker';
import { FORMAT_DIMENSIONS } from '@/lib/formats';
import type { SavedTemplate, CreativeFormat } from '@/lib/types';
import { ReferenceUpload } from '@/components/reference-upload';
import { StrategyReview } from '@/components/strategy-review';
import type { CampaignStrategy } from '@/lib/types';

interface CampaignConfig {
  name: string;
  baseTemplateId: string;
  headlines: string[];
  formats: CreativeFormat[];
  defaultValues: Record<string, string>;
  selectedPersons: string[];
  selectedBackgrounds: string[];
  generatePersons: boolean;
  generateBackgrounds: boolean;
  personPrompt: string;
  backgroundPrompt: string;
  personCount: number;
  backgroundCount: number;
  brandColors?: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  brandStyle?: string;
  cssStrategyOverrides?: Record<string, string>;
}

interface CampaignSetupProps {
  studioId: string;
  onGenerate: (config: CampaignConfig) => void;
  loading: boolean;
}

export function CampaignSetup({ studioId, onGenerate, loading }: CampaignSetupProps) {
  const [step, setStep] = useState(0);

  // Step 1: Basis
  const [name, setName] = useState('');
  const [baseTemplateId, setBaseTemplateId] = useState<string>('');
  const [headlines, setHeadlines] = useState<string[]>(['']);
  const [formats, setFormats] = useState<CreativeFormat[]>(
    Object.keys(FORMAT_DIMENSIONS) as CreativeFormat[]
  );
  const [price, setPrice] = useState('39,90\u20AC');
  const [originalPrice, setOriginalPrice] = useState('89,90\u20AC');

  // Branding
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#00D4FF');
  const [secondaryColor, setSecondaryColor] = useState('#1a1a1a');
  const [accentColor, setAccentColor] = useState('#0090cc');
  const [brandStyle, setBrandStyle] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [brandAnalyzed, setBrandAnalyzed] = useState(false);

  // Step 0: Reference
  const [strategy, setStrategy] = useState<CampaignStrategy | null>(null);
  const [referenceAnalyzing, setReferenceAnalyzing] = useState(false);

  // Step 2: Personen
  const [selectedPersons, setSelectedPersons] = useState<string[]>([]);
  const [generatePersons, setGeneratePersons] = useState(false);
  const [personPrompt, setPersonPrompt] = useState('Fitness Trainer, sportlich, l\u00E4chelnd, T-Shirt, Studiobeleuchtung');
  const [personCount, setPersonCount] = useState(2);
  const [showPersonGen, setShowPersonGen] = useState(false);

  // Step 3: Hintergruende
  const [selectedBgs, setSelectedBgs] = useState<string[]>([]);
  const [generateBgs, setGenerateBgs] = useState(false);
  const [bgPrompt, setBgPrompt] = useState('Modernes Fitnessstudio Interieur, Ger\u00E4te, warme Beleuchtung');
  const [bgCount, setBgCount] = useState(1);
  const [showBgGen, setShowBgGen] = useState(false);

  // Data
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [personAssets, setPersonAssets] = useState<string[]>([]);
  const [bgAssets, setBgAssets] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/templates?studioId=${studioId}`).then(r => r.json()),
      fetch('/api/templates').then(r => r.json()),
      fetch(`/api/assets/${studioId}?type=person`).then(r => r.json()),
      fetch(`/api/assets/${studioId}?type=background`).then(r => r.json()),
      fetch(`/api/studios/${studioId}`).then(r => r.json()),
    ]).then(([studioTemplates, allTemplates, persons, bgs, studioData]) => {
      const ids = new Set(studioTemplates.map((t: SavedTemplate) => t.id));
      const globals = allTemplates.filter((t: SavedTemplate) => !t.studioId && !ids.has(t.id));
      const merged = [...studioTemplates, ...globals];
      setTemplates(merged);
      if (merged.length > 0 && !baseTemplateId) {
        setBaseTemplateId(merged[0].id);
      }
      setPersonAssets(persons);
      setBgAssets(bgs);
      // Pre-fill branding from studio data
      if (studioData) {
        if (studioData.primaryColor) setPrimaryColor(studioData.primaryColor);
        if (studioData.secondaryColor) setSecondaryColor(studioData.secondaryColor);
        if (studioData.accentColor) setAccentColor(studioData.accentColor);
        if (studioData.websiteUrl) setWebsiteUrl(studioData.websiteUrl);
        if (studioData.brandStyle) {
          setBrandStyle(studioData.brandStyle);
          setBrandAnalyzed(true);
        }
      }
    });
  }, [studioId]);

  const analyzeBrand = async () => {
    if (!websiteUrl) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/analyze-brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl }),
      });
      if (!res.ok) throw new Error('Analysis failed');
      const data = await res.json();

      if (data.primaryColor) setPrimaryColor(data.primaryColor);
      if (data.secondaryColor) setSecondaryColor(data.secondaryColor);
      if (data.accentColor) setAccentColor(data.accentColor);
      if (data.brandMood) setBrandStyle(data.brandMood);
      setBrandAnalyzed(true);

      // Also save to studio
      await fetch(`/api/studios/${studioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteUrl,
          primaryColor: data.primaryColor || primaryColor,
          secondaryColor: data.secondaryColor || secondaryColor,
          accentColor: data.accentColor || accentColor,
          brandStyle: data.brandMood || '',
        }),
      });
    } catch (err) {
      console.error('Brand analysis failed:', err);
      alert('Website-Analyse fehlgeschlagen. Bitte Farben manuell eingeben.');
    } finally {
      setAnalyzing(false);
    }
  };

  const applyStrategyAndGenerate = () => {
    if (!strategy) return;
    // Direkt generieren - Scene-Bilder (Person+Hintergrund zusammen) fuer beste Qualitaet
    onGenerate({
      name: name || `Kampagne ${new Date().toLocaleDateString('de')}`,
      baseTemplateId: strategy.templateId,
      headlines: nonEmptyHeadlines.length > 0 ? nonEmptyHeadlines : ['JETZT STARTEN'],
      formats,
      defaultValues: {
        price,
        originalPrice,
        location: '',
        primaryColor: strategy.primaryColor,
        accentColor: strategy.accentColor,
      },
      selectedPersons: [],
      selectedBackgrounds: [],
      generatePersons: false,
      generateBackgrounds: true,
      personPrompt: strategy.personPrompt,
      backgroundPrompt: strategy.backgroundPrompt,
      personCount: 0,
      backgroundCount: 2,
      brandColors: {
        primaryColor: strategy.primaryColor,
        secondaryColor: strategy.secondaryColor,
        accentColor: strategy.accentColor,
      },
      brandStyle: strategy.mood,
      cssStrategyOverrides: strategy.cssOverrides,
    });
  };

  const applyStrategyManual = () => {
    if (!strategy) return;
    // Nur State vorausfuellen, manuell weiter konfigurieren
    setBaseTemplateId(strategy.templateId);
    setPrimaryColor(strategy.primaryColor);
    setSecondaryColor(strategy.secondaryColor);
    setAccentColor(strategy.accentColor);
    setBrandStyle(strategy.mood);
    setPersonPrompt(strategy.personPrompt);
    setBgPrompt(strategy.backgroundPrompt);
    setBrandAnalyzed(true);
    setStep(1);
  };

  const toggleFormat = (f: CreativeFormat) => {
    setFormats(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
    );
  };

  const togglePerson = (path: string) => {
    setSelectedPersons(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  const toggleBg = (path: string) => {
    setSelectedBgs(prev =>
      prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
    );
  };

  // Headlines helpers
  const addHeadline = () => {
    if (headlines.length < 5) {
      setHeadlines(prev => [...prev, '']);
    }
  };

  const removeHeadline = (index: number) => {
    if (headlines.length > 1) {
      setHeadlines(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateHeadline = (index: number, value: string) => {
    setHeadlines(prev => prev.map((h, i) => (i === index ? value : h)));
  };

  // Filter out empty headlines for counting
  const nonEmptyHeadlines = headlines.filter(h => h.trim().length > 0);

  const totalPersons = selectedPersons.length + (generatePersons ? personCount : 0);
  const totalBgs = selectedBgs.length + (generateBgs ? bgCount : 0);
  const totalVariants = Math.max(nonEmptyHeadlines.length, 1) * Math.max(totalPersons, 1) * Math.max(totalBgs, 1);

  const handleSubmit = () => {
    onGenerate({
      name: name || `Kampagne ${new Date().toLocaleDateString('de')}`,
      baseTemplateId,
      headlines: nonEmptyHeadlines.length > 0 ? nonEmptyHeadlines : ['JETZT STARTEN'],
      formats,
      defaultValues: {
        price,
        originalPrice,
        location: '',
        primaryColor,
        accentColor,
      },
      selectedPersons,
      selectedBackgrounds: selectedBgs,
      generatePersons,
      generateBackgrounds: generateBgs,
      personPrompt,
      backgroundPrompt: bgPrompt,
      personCount,
      backgroundCount: bgCount,
      brandColors: { primaryColor, secondaryColor, accentColor },
      brandStyle,
      cssStrategyOverrides: strategy?.cssOverrides,
    });
  };

  const reloadAssets = async () => {
    const [persons, bgs] = await Promise.all([
      fetch(`/api/assets/${studioId}?type=person`).then(r => r.json()),
      fetch(`/api/assets/${studioId}?type=background`).then(r => r.json()),
    ]);
    setPersonAssets(persons);
    setBgAssets(bgs);
  };

  // Step indicator
  const StepIndicator = () => (
    <div className="flex items-center gap-2 mb-6">
      {[0, 1, 2, 3].map(s => (
        <div key={s} className="flex items-center gap-2">
          <button
            onClick={() => s < step && setStep(s)}
            className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
              s === step ? 'bg-[#00D4FF] text-black scale-110'
              : s < step ? 'bg-[#22c55e] text-white cursor-pointer'
              : 'bg-white/[0.045] text-[#6b7280]'
            }`}>
            {s < step ? '\u2713' : s}
          </button>
          {s < 3 && <div className={`w-8 h-0.5 ${s < step ? 'bg-[#22c55e]' : 'bg-[#333]'}`} />}
        </div>
      ))}
      <span className="text-[#6b7280] text-xs ml-2">
        {step === 0 ? 'Referenz' : step === 1 ? 'Basis' : step === 2 ? 'Personen' : 'Hintergruende'}
      </span>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto">
      <StepIndicator />

      {step === 0 && (
        <div className="space-y-5">
          <div>
            <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-1 block">Kampagnen-Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none"
              placeholder="z.B. Sommerspezial Juli" />
          </div>
          {!strategy ? (
            <ReferenceUpload
              studioId={studioId}
              onAnalyzed={(s) => setStrategy(s as unknown as CampaignStrategy)}
              onSkip={() => setStep(1)}
            />
          ) : (
            <>
              <StrategyReview
                strategy={strategy}
                onChange={setStrategy}
                onApply={applyStrategyAndGenerate}
                onReanalyze={() => { setStrategy(null); }}
                onSkip={() => { applyStrategyManual(); }}
                analyzing={referenceAnalyzing}
                generating={loading}
              />

              {/* Headlines + Preis direkt hier damit alles in einem Schritt geht */}
              <div className="bg-[#050507] border border-white/[0.06] rounded-xl p-4 space-y-3">
                <label className="text-[#9ca3af] text-xs uppercase tracking-wider block">Headlines & Preis</label>
                <div className="space-y-2">
                  {headlines.map((headline, index) => (
                    <div key={index} className="flex gap-2">
                      <textarea
                        value={headline}
                        onChange={e => updateHeadline(index, e.target.value)}
                        rows={2}
                        className="flex-1 bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none resize-none"
                        placeholder={`Headline ${index + 1} (Enter = Zeilenumbruch)`}
                      />
                      {headlines.length > 1 && (
                        <button onClick={() => removeHeadline(index)}
                          className="text-[#6b7280] hover:text-red-400 text-sm px-2">x</button>
                      )}
                    </div>
                  ))}
                  {headlines.length < 5 && (
                    <button onClick={addHeadline}
                      className="text-[#00D4FF] text-xs hover:text-[#00b4d8] font-semibold">+ Headline</button>
                  )}
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[#6b7280] text-xs mb-1 block">Preis</label>
                    <input value={price} onChange={e => setPrice(e.target.value)}
                      className="w-full bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2 text-[#00D4FF] text-sm font-bold outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[#6b7280] text-xs mb-1 block">Streichpreis</label>
                    <input value={originalPrice} onChange={e => setOriginalPrice(e.target.value)}
                      className="w-full bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2 text-[#9ca3af] text-sm outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-1.5 block">Formate</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(FORMAT_DIMENSIONS).map(([key, val]) => (
                      <button key={key} onClick={() => toggleFormat(key as CreativeFormat)}
                        className={`text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${
                          formats.includes(key as CreativeFormat)
                            ? 'bg-[#00D4FF] text-black'
                            : 'bg-white/[0.03] border border-white/10 text-[#6b7280]'
                        }`}>
                        {val.label.split(' (')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* STEP 1: Basis */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-1 block">Kampagnen-Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none"
              placeholder="z.B. Sommerspezial Juli" />
          </div>

          {/* Branding Section */}
          <div className="bg-[#050507] border border-white/[0.06] rounded-xl p-4 space-y-3">
            <h3 className="text-white font-semibold text-sm">Markenidentitaet</h3>

            {/* Website URL */}
            <div>
              <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-1 block">Studio-Website (optional)</label>
              <div className="flex gap-2">
                <input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)}
                  className="flex-1 bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none"
                  placeholder="https://dein-studio.de" />
                <button
                  onClick={analyzeBrand}
                  disabled={!websiteUrl || analyzing}
                  className="btn-primary bg-[#00D4FF] hover:bg-[#00b4d8] disabled:opacity-50 text-black font-semibold py-2.5 px-4 rounded-full text-xs transition-colors whitespace-nowrap"
                >
                  {analyzing ? 'Analysiere...' : 'Stil erkennen'}
                </button>
              </div>
              <p className="text-[#6b7280] text-xs mt-1">
                KI analysiert Farben und Stil deiner Website automatisch
              </p>
            </div>

            {brandAnalyzed && brandStyle && (
              <div className="bg-[#0e0e15] border border-white/10 rounded-lg p-3">
                <p className="text-[#9ca3af] text-xs italic">{brandStyle}</p>
              </div>
            )}

            {/* Color Palette */}
            <div>
              <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-2 block">Farbpalette</label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[#6b7280] text-[10px] uppercase">Primaer</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-white/10 bg-transparent" />
                    <input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)}
                      className="flex-1 bg-[#0e0e15] border border-white/10 rounded px-2 py-1.5 text-white text-xs outline-none font-mono" />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-[#6b7280] text-[10px] uppercase">Sekundaer</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-white/10 bg-transparent" />
                    <input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)}
                      className="flex-1 bg-[#0e0e15] border border-white/10 rounded px-2 py-1.5 text-white text-xs outline-none font-mono" />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-[#6b7280] text-[10px] uppercase">Akzent</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-white/10 bg-transparent" />
                    <input value={accentColor} onChange={e => setAccentColor(e.target.value)}
                      className="flex-1 bg-[#0e0e15] border border-white/10 rounded px-2 py-1.5 text-white text-xs outline-none font-mono" />
                  </div>
                </div>
              </div>
              {/* Color preview bar */}
              <div className="flex mt-2 rounded-lg overflow-hidden h-3">
                <div className="flex-1" style={{ backgroundColor: primaryColor }} />
                <div className="flex-1" style={{ backgroundColor: secondaryColor }} />
                <div className="flex-1" style={{ backgroundColor: accentColor }} />
              </div>
            </div>
          </div>

          {/* Template Picker */}
          <div>
            <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-1.5 block">Template / Layout</label>
            {templates.length > 0 ? (
              <TemplatePicker
                templates={templates}
                selected={baseTemplateId}
                onSelect={setBaseTemplateId}
              />
            ) : (
              <p className="text-[#4b5563] text-xs">Lade Templates...</p>
            )}
          </div>

          {/* Manual Headlines */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[#9ca3af] text-xs uppercase tracking-wider">Headlines</label>
              <span className="text-[#6b7280] text-xs">{nonEmptyHeadlines.length} / 5</span>
            </div>
            <div className="space-y-2">
              {headlines.map((headline, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    value={headline}
                    onChange={e => updateHeadline(index, e.target.value)}
                    className="flex-1 bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[#00D4FF]/50 transition-colors"
                    placeholder={`Headline ${index + 1}, z.B. "JETZT STARTEN"`}
                  />
                  {headlines.length > 1 && (
                    <button
                      onClick={() => removeHeadline(index)}
                      className="text-[#6b7280] hover:text-red-400 text-sm px-2 transition-colors"
                      title="Headline entfernen"
                    >
                      x
                    </button>
                  )}
                </div>
              ))}
            </div>
            {headlines.length < 5 && (
              <button
                onClick={addHeadline}
                className="mt-2 text-[#00D4FF] hover:text-[#00b4d8] text-xs font-semibold transition-colors"
              >
                + Headline hinzufuegen
              </button>
            )}
            <p className="text-[#6b7280] text-xs mt-1">
              Gib 1-5 Werbe-Headlines ein. Leere Felder werden ignoriert.
            </p>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-1 block">Preis</label>
              <input value={price} onChange={e => setPrice(e.target.value)}
                className="w-full bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2.5 text-[#00D4FF] text-sm font-bold outline-none" />
            </div>
            <div className="flex-1">
              <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-1 block">Streichpreis</label>
              <input value={originalPrice} onChange={e => setOriginalPrice(e.target.value)}
                className="w-full bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2.5 text-[#9ca3af] text-sm outline-none" />
            </div>
          </div>

          <div>
            <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-1.5 block">Formate</label>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(FORMAT_DIMENSIONS).map(([key, val]) => (
                <button key={key} onClick={() => toggleFormat(key as CreativeFormat)}
                  className={`text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${
                    formats.includes(key as CreativeFormat)
                      ? 'bg-[#00D4FF] text-black'
                      : 'bg-white/[0.03] border border-white/10 text-[#6b7280]'
                  }`}>
                  {val.label.split(' (')[0]}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => setStep(2)}
            disabled={formats.length === 0 || !baseTemplateId}
            className="btn-primary w-full bg-[#00D4FF] hover:bg-[#00b4d8] disabled:opacity-50 text-black font-bold py-3 rounded-full text-sm transition-colors">
            Weiter &rarr; Personen
          </button>
        </div>
      )}

      {/* STEP 2: Personen */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[#9ca3af] text-xs uppercase tracking-wider">Vorhandene Personen-Bilder</label>
              <span className="text-[#00D4FF] text-xs font-semibold">{selectedPersons.length} ausgewaehlt</span>
            </div>
            {personAssets.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {personAssets.map(path => (
                  <button key={path} onClick={() => togglePerson(path)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      selectedPersons.includes(path) ? 'border-[#00D4FF] ring-2 ring-[#00D4FF]/30' : 'border-white/10 hover:border-white/20'
                    }`}>
                    <img src={`/api/assets/serve?path=${encodeURIComponent(path)}`} alt=""
                      className="w-full h-full object-cover" />
                    {selectedPersons.includes(path) && (
                      <div className="absolute inset-0 bg-[#00D4FF]/20 flex items-center justify-center">
                        <span className="text-white text-lg">{'\u2713'}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[#4b5563] text-xs">Keine Personen-Bilder vorhanden</p>
            )}
          </div>

          <div>
            <button onClick={() => setShowPersonGen(!showPersonGen)}
              className="text-[#00D4FF] text-xs hover:text-[#00b4d8] font-semibold">
              {showPersonGen ? '\u25BE KI-Generierung schlie\u00DFen' : '\u25B8 Neue Personen per KI generieren'}
            </button>
            {showPersonGen && (
              <div className="mt-2 bg-[#050507] border border-white/[0.06] rounded-lg p-3 space-y-2">
                <ImageGenerator studioId={studioId} assetType="person"
                  onGenerated={() => { reloadAssets(); }} />
                <p className="text-[#6b7280] text-xs">Personen werden automatisch freigestellt</p>
              </div>
            )}
          </div>

          <div className="bg-[#050507] border border-white/[0.06] rounded-lg p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={generatePersons} onChange={e => setGeneratePersons(e.target.checked)}
                className="accent-[#00D4FF]" />
              <span className="text-white text-sm">Zusaetzlich Personen per KI generieren lassen</span>
            </label>
            {generatePersons && (
              <div className="mt-3 space-y-2">
                <input value={personPrompt} onChange={e => setPersonPrompt(e.target.value)}
                  className="w-full bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  placeholder="Beschreibe die gew\u00FCnschten Personen..." />
                <div>
                  <label className="text-[#6b7280] text-xs">Anzahl: {personCount}</label>
                  <input type="range" min={1} max={3} value={personCount}
                    onChange={e => setPersonCount(Number(e.target.value))}
                    className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#00D4FF]" />
                </div>
              </div>
            )}
          </div>

          {totalPersons === 0 && (
            <p className="text-[#9ca3af] text-xs text-center bg-[#0e0e15] border border-white/[0.06] rounded-lg py-2 px-3">
              Personen sind optional - du kannst auch Creatives ohne Person erstellen
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={() => setStep(1)}
              className="flex-1 bg-white/[0.045] border border-white/10 text-[#e8eaed] py-3 rounded-lg text-sm font-semibold">
              &larr; Zurueck
            </button>
            <button onClick={() => setStep(3)}
              className="btn-primary flex-1 bg-[#00D4FF] hover:bg-[#00b4d8] text-black font-bold py-3 rounded-full text-sm transition-colors">
              Weiter &rarr; Hintergruende
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Hintergruende */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[#9ca3af] text-xs uppercase tracking-wider">Vorhandene Hintergrund-Bilder</label>
              <span className="text-[#00D4FF] text-xs font-semibold">{selectedBgs.length} ausgewaehlt</span>
            </div>
            {bgAssets.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {bgAssets.map(path => (
                  <button key={path} onClick={() => toggleBg(path)}
                    className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                      selectedBgs.includes(path) ? 'border-[#00D4FF] ring-2 ring-[#00D4FF]/30' : 'border-white/10 hover:border-white/20'
                    }`}>
                    <img src={`/api/assets/serve?path=${encodeURIComponent(path)}`} alt=""
                      className="w-full h-full object-cover" />
                    {selectedBgs.includes(path) && (
                      <div className="absolute inset-0 bg-[#00D4FF]/20 flex items-center justify-center">
                        <span className="text-white text-lg">{'\u2713'}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[#4b5563] text-xs">Keine Hintergrund-Bilder vorhanden</p>
            )}
          </div>

          <div>
            <button onClick={() => setShowBgGen(!showBgGen)}
              className="text-[#00D4FF] text-xs hover:text-[#00b4d8] font-semibold">
              {showBgGen ? '\u25BE KI-Generierung schlie\u00DFen' : '\u25B8 Neue Hintergruende per KI generieren'}
            </button>
            {showBgGen && (
              <div className="mt-2 bg-[#050507] border border-white/[0.06] rounded-lg p-3">
                <ImageGenerator studioId={studioId} assetType="background"
                  onGenerated={() => { reloadAssets(); }} />
              </div>
            )}
          </div>

          <div className="bg-[#050507] border border-white/[0.06] rounded-lg p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={generateBgs} onChange={e => setGenerateBgs(e.target.checked)}
                className="accent-[#00D4FF]" />
              <span className="text-white text-sm">Zusaetzlich Hintergruende per KI generieren lassen</span>
            </label>
            {generateBgs && (
              <div className="mt-3 space-y-2">
                <input value={bgPrompt} onChange={e => setBgPrompt(e.target.value)}
                  className="w-full bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  placeholder="Beschreibe den gew\u00FCnschten Hintergrund..." />
                <div>
                  <label className="text-[#6b7280] text-xs">Anzahl: {bgCount}</label>
                  <input type="range" min={1} max={3} value={bgCount}
                    onChange={e => setBgCount(Number(e.target.value))}
                    className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#00D4FF]" />
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="bg-[#0e0e15] border border-white/10 rounded-xl p-4">
            <h3 className="text-white font-bold text-sm mb-2">Zusammenfassung</h3>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#9ca3af]">Headlines</span>
                <span className="text-white font-semibold">{Math.max(nonEmptyHeadlines.length, 1)} Varianten</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9ca3af]">Personen</span>
                <span className="text-white font-semibold">{totalPersons || 0} Bilder</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9ca3af]">Hintergruende</span>
                <span className="text-white font-semibold">{totalBgs || 0} Bilder</span>
              </div>
              <div className="border-t border-white/10 pt-1 mt-1 flex justify-between">
                <span className="text-[#9ca3af]">Gesamt-Varianten</span>
                <span className="text-[#00D4FF] font-bold">{totalVariants} Creatives</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9ca3af]">x Formate</span>
                <span className="text-white font-semibold">{formats.length} Formate</span>
              </div>
              <div className="flex justify-between text-sm pt-1">
                <span className="text-[#9ca3af] font-semibold">Gesamte PNGs</span>
                <span className="text-[#00D4FF] font-bold">{totalVariants * formats.length}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep(2)}
              className="flex-1 bg-white/[0.045] border border-white/10 text-[#e8eaed] py-3 rounded-lg text-sm font-semibold">
              &larr; Zurueck
            </button>
            <button onClick={handleSubmit}
              disabled={loading || (totalBgs === 0 && !generateBgs)}
              className="btn-primary flex-1 bg-[#00D4FF] hover:bg-[#00b4d8] disabled:opacity-50 text-black font-bold py-3 rounded-full text-sm transition-colors">
              {loading ? 'Generiere Varianten...' : `${totalVariants} Varianten generieren`}
            </button>
          </div>
          {totalBgs === 0 && !generateBgs && (
            <p className="text-red-400 text-xs text-center">Waehle mindestens einen Hintergrund oder aktiviere die KI-Generierung</p>
          )}
        </div>
      )}
    </div>
  );
}
