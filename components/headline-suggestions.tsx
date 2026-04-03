'use client';

import { useState } from 'react';

interface HeadlineSuggestionsProps {
  studioId: string;
  price?: string;
  originalPrice?: string;
  onSelect: (headline: string) => void;
}

export function HeadlineSuggestions({ studioId, price, originalPrice, onSelect }: HeadlineSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<{ headline: string; subline?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const generate = async () => {
    setLoading(true);
    setOpen(true);
    try {
      const res = await fetch('/api/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioId, price, originalPrice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuggestions(data.variants || []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button onClick={generate}
        className="bg-[#FF4500] hover:bg-[#e63e00] rounded-lg px-3 py-2.5 text-white text-xs whitespace-nowrap font-semibold">
        {loading ? '...' : 'Vorschläge ✨'}
      </button>

      {open && suggestions.length > 0 && (
        <div className="absolute top-full right-0 mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg py-1 z-20 min-w-[250px] shadow-xl">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => { onSelect(s.headline); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-[#222] transition-colors">
              <div className="text-white text-sm font-semibold">{s.headline}</div>
              {s.subline && <div className="text-[#666] text-xs">{s.subline}</div>}
            </button>
          ))}
          <button onClick={() => setOpen(false)} className="w-full text-center text-[#555] text-xs py-1.5 hover:text-white">
            Schließen
          </button>
        </div>
      )}
    </div>
  );
}
