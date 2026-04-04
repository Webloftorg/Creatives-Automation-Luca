// components/reference-upload.tsx
'use client';

import { useState, useRef } from 'react';

interface ReferenceUploadProps {
  onAnalyzed: (strategy: Record<string, unknown>) => void;
  onSkip: () => void;
  studioId: string;
}

export function ReferenceUpload({ onAnalyzed, onSkip, studioId }: ReferenceUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('studioId', studioId);
      const res = await fetch('/api/analyze-reference', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Analysis failed');
      const strategy = await res.json();
      onAnalyzed(strategy);
    } catch (err) {
      console.error('Reference analysis failed:', err);
      alert('Analyse fehlgeschlagen. Bitte versuche es erneut oder ueberspringe diesen Schritt.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white font-bold text-lg mb-1 font-[family-name:var(--font-heading)]">Referenz-Creative</h2>
        <p className="text-[#9ca3af] text-sm">
          Lade ein Referenz-Creative hoch das dir gefaellt. Die KI analysiert den Stil und konfiguriert deine Kampagne automatisch.
        </p>
      </div>

      {!preview ? (
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
            dragOver ? 'border-[#00D4FF] bg-[#00D4FF]/10' : 'border-white/15 hover:border-white/30'
          }`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div className="text-[#6b7280] text-4xl mb-3">+</div>
          <p className="text-[#9ca3af] text-sm">Bild hierher ziehen oder klicken zum Auswaehlen</p>
          <p className="text-[#6b7280] text-xs mt-1">PNG oder JPG</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative bg-[#050507] rounded-xl overflow-hidden">
            <img src={preview} alt="Referenz" className="w-full max-h-80 object-contain" />
            <button
              onClick={() => { setPreview(null); setFile(null); }}
              className="absolute top-2 right-2 w-8 h-8 bg-black/70 backdrop-blur-sm rounded-full text-white text-sm flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              x
            </button>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="w-full bg-[#00D4FF] hover:bg-[#00b4d8] disabled:opacity-50 text-black font-bold py-3 rounded-full text-sm transition-all btn-primary shadow-[0_4px_20px_rgba(0,212,255,0.3)]"
          >
            {analyzing ? 'KI analysiert Referenz...' : 'Stil analysieren'}
          </button>
        </div>
      )}

      <button
        onClick={onSkip}
        disabled={analyzing}
        className="w-full bg-white/[0.045] border border-white/10 hover:bg-white/[0.08] text-[#e8eaed] font-semibold py-3 rounded-full text-sm transition-all backdrop-blur-sm"
      >
        Ohne Referenz fortfahren
      </button>
    </div>
  );
}
