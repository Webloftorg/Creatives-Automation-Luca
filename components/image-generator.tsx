'use client';

import { useState } from 'react';

interface ImageGeneratorProps {
  studioId: string;
  assetType: 'person' | 'background' | 'generated';
  onGenerated: (path: string) => void;
}

export function ImageGenerator({ studioId, assetType, onGenerated }: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [generatedPath, setGeneratedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, studioId, assetType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data.base64);
      setGeneratedPath(data.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler bei der Bildgenerierung');
    } finally {
      setLoading(false);
    }
  };

  const accept = () => {
    if (generatedPath) {
      onGenerated(generatedPath);
      setPreview(null);
      setGeneratedPath(null);
      setPrompt('');
    }
  };

  return (
    <div className="bg-[#0e0e15] border border-dashed border-[#00D4FF]/30 rounded-lg p-4">
      <div className="text-[#00D4FF] text-sm font-semibold mb-2 font-[family-name:var(--font-heading)]">AI Bildgenerierung</div>
      <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
        placeholder="Beschreibe das Bild das du brauchst..."
        className="w-full bg-white/[0.03] border border-white/10 rounded-lg p-3 text-white text-sm resize-none h-20 outline-none focus:border-[#00D4FF]/50 mb-2" />
      <button onClick={generate} disabled={loading || !prompt}
        className="w-full bg-[#00D4FF] hover:bg-[#00b4d8] disabled:opacity-50 text-black font-bold py-2 rounded-full text-sm transition-all btn-primary">
        {loading ? 'Generiere...' : 'Bild generieren \u2728'}
      </button>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      {preview && (
        <div className="mt-3">
          <img src={preview} alt="Generated" className="w-full rounded-lg mb-2" />
          <div className="flex gap-2">
            <button onClick={accept} className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-white py-2 rounded-full text-sm font-semibold transition-colors">{'\u00dc'}bernehmen</button>
            <button onClick={generate} className="flex-1 bg-white/[0.045] border border-white/10 text-[#e8eaed] py-2 rounded-full text-sm hover:bg-white/[0.08] transition-colors">Neu generieren</button>
          </div>
        </div>
      )}
    </div>
  );
}
