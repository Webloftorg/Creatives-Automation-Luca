'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { ColorPicker } from '@/components/color-picker';
import { FileUpload } from '@/components/file-upload';
import { ImageGenerator } from '@/components/image-generator';
import { DEFAULT_PROMPTS } from '@/lib/prompts';
import type { Studio } from '@/lib/types';

const FONTS = ['Montserrat', 'Oswald', 'Bebas Neue', 'Roboto Condensed', 'Anton', 'Teko'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [studioId] = useState(uuidv4());

  // Step 1 state
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#FF4500');
  const [secondaryColor, setSecondaryColor] = useState('#1a1a2e');
  const [accentColor, setAccentColor] = useState('#FF6B00');
  const [font, setFont] = useState('Montserrat');

  // Step 2 state
  const [backgroundPaths, setBackgroundPaths] = useState<string[]>([]);
  const [personPaths, setPersonPaths] = useState<string[]>([]);

  // Step 3 state
  const [copyPrompt, setCopyPrompt] = useState(DEFAULT_PROMPTS['copy-generation']);
  const [templatePrompt, setTemplatePrompt] = useState(DEFAULT_PROMPTS['template-generation']);

  const uploadFiles = async (files: File[], type: 'background' | 'person') => {
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('studioId', studioId);
      formData.append('type', type);
      const res = await fetch('/api/assets/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (type === 'background') {
        setBackgroundPaths(prev => [...prev, data.path]);
      } else {
        setPersonPaths(prev => [...prev, data.path]);
      }
    }
  };

  const createStudio = async () => {
    const studio: Studio = {
      id: studioId,
      name,
      location,
      primaryColor,
      secondaryColor,
      accentColor,
      backgroundImages: backgroundPaths,
      personImages: personPaths,
      generatedImages: [],
      defaultFont: font,
      createdAt: new Date().toISOString(),
    };
    await fetch('/api/studios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studio),
    });
    router.push(`/studio/${studioId}/creatives`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step > s ? 'bg-[#222] border-2 border-[#4CAF50] text-[#4CAF50]' :
                step === s ? 'bg-[#FF4500] text-white' : 'bg-[#222] text-[#666]'
              }`}>
                {step > s ? '\u2713' : s}
              </div>
              {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-[#4CAF50]' : 'bg-[#333]'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Grunddaten */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold mb-1">Studio-Grunddaten</h2>
            <p className="text-[#666] text-sm mb-6">Name, Standort und Branding deines Studios</p>
            <div className="space-y-4">
              <div>
                <label className="text-[#aaa] text-xs uppercase tracking-wider">Studioname</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-3 text-white mt-1 outline-none focus:border-[#FF4500]"
                  placeholder="z.B. FitX Power Gym" />
              </div>
              <div>
                <label className="text-[#aaa] text-xs uppercase tracking-wider">Standort</label>
                <input value={location} onChange={e => setLocation(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-3 text-white mt-1 outline-none focus:border-[#FF4500]"
                  placeholder="z.B. Weissenthurm" />
              </div>
              <div>
                <label className="text-[#aaa] text-xs uppercase tracking-wider mb-2 block">Farben</label>
                <div className="flex gap-3">
                  <ColorPicker label="Prim\u00e4r" value={primaryColor} onChange={setPrimaryColor} />
                  <ColorPicker label="Sekund\u00e4r" value={secondaryColor} onChange={setSecondaryColor} />
                  <ColorPicker label="Akzent" value={accentColor} onChange={setAccentColor} />
                </div>
              </div>
              <div>
                <label className="text-[#aaa] text-xs uppercase tracking-wider">Font</label>
                <select value={font} onChange={e => setFont(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-3 text-white mt-1 outline-none">
                  {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <button onClick={() => setStep(2)} disabled={!name || !location}
              className="w-full bg-[#FF4500] hover:bg-[#e63e00] disabled:opacity-50 text-white font-bold py-3 rounded-lg mt-6 transition-colors">
              Weiter {'\u2192'}
            </button>
          </div>
        )}

        {/* Step 2: Assets */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold mb-1">Assets hochladen</h2>
            <p className="text-[#666] text-sm mb-6">Bilder f\u00fcr deine Creatives -- hochladen oder per AI generieren</p>
            <div className="space-y-6">
              <div>
                <label className="text-[#aaa] text-xs uppercase tracking-wider mb-2 block">Hintergrundbilder (Gym-Fotos)</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {backgroundPaths.map((p, i) => (
                    <div key={i} className="w-20 h-20 bg-[#1a1a1a] border border-[#333] rounded-lg overflow-hidden">
                      <div className="w-full h-full bg-[#2a2a2a]" />
                    </div>
                  ))}
                </div>
                <FileUpload onFiles={files => uploadFiles(files, 'background')} label="+ Hochladen" />
                <div className="mt-2">
                  <ImageGenerator studioId={studioId} assetType="background" onGenerated={p => setBackgroundPaths(prev => [...prev, p])} />
                </div>
              </div>
              <div>
                <label className="text-[#aaa] text-xs uppercase tracking-wider mb-1 block">Personen-Bilder</label>
                <p className="text-[#555] text-xs mb-2">Transparenter Hintergrund empfohlen</p>
                <div className="flex gap-2 flex-wrap mb-2">
                  {personPaths.map((p, i) => (
                    <div key={i} className="w-20 h-20 bg-[#1a1a1a] border border-[#333] rounded-lg" />
                  ))}
                </div>
                <FileUpload onFiles={files => uploadFiles(files, 'person')} accept="image/png" label="+ Hochladen (PNG)" />
                <div className="mt-2">
                  <ImageGenerator studioId={studioId} assetType="person" onGenerated={p => setPersonPaths(prev => [...prev, p])} />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setStep(1)} className="bg-[#222] border border-[#333] text-[#aaa] rounded-lg px-6 py-3 transition-colors">{'\u2190'} Zur\u00fcck</button>
              <button onClick={() => setStep(3)} className="flex-1 bg-[#FF4500] hover:bg-[#e63e00] text-white font-bold py-3 rounded-lg transition-colors">Weiter {'\u2192'}</button>
            </div>
          </div>
        )}

        {/* Step 3: Stil */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold mb-1">Stil pr\u00fcfen</h2>
            <p className="text-[#666] text-sm mb-6">Passe die AI-Prompts an den Stil deines Studios an</p>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[#aaa] text-xs uppercase tracking-wider">Headline-Stil</label>
                  <button onClick={() => setCopyPrompt(DEFAULT_PROMPTS['copy-generation'])}
                    className="text-[#666] text-xs border border-[#333] rounded px-2 py-0.5 hover:text-white">Standard</button>
                </div>
                <p className="text-[#555] text-xs mb-2">Steuert wie die AI Headlines und CTAs f\u00fcr dein Studio generiert</p>
                <textarea value={copyPrompt} onChange={e => setCopyPrompt(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-lg p-3 text-[#aaa] text-xs h-24 resize-none outline-none focus:border-[#FF4500]" />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[#aaa] text-xs uppercase tracking-wider">Template-Stil</label>
                  <button onClick={() => setTemplatePrompt(DEFAULT_PROMPTS['template-generation'])}
                    className="text-[#666] text-xs border border-[#333] rounded px-2 py-0.5 hover:text-white">Standard</button>
                </div>
                <p className="text-[#555] text-xs mb-2">Steuert wie die AI neue Templates f\u00fcr dein Studio designt</p>
                <textarea value={templatePrompt} onChange={e => setTemplatePrompt(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-lg p-3 text-[#aaa] text-xs h-24 resize-none outline-none focus:border-[#FF4500]" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setStep(2)} className="bg-[#222] border border-[#333] text-[#aaa] rounded-lg px-6 py-3">{'\u2190'} Zur\u00fcck</button>
              <button onClick={createStudio} className="flex-1 bg-[#4CAF50] hover:bg-[#45a049] text-white font-bold py-3 rounded-lg transition-colors">Studio erstellen {'\u2713'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
