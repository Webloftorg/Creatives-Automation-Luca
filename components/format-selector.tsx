'use client';

import { FORMAT_DIMENSIONS } from '@/lib/formats';
import type { CreativeFormat } from '@/lib/types';

interface FormatSelectorProps {
  selected: CreativeFormat;
  onChange: (format: CreativeFormat) => void;
}

export function FormatSelector({ selected, onChange }: FormatSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {Object.entries(FORMAT_DIMENSIONS).map(([key, val]) => (
        <button
          key={key}
          onClick={() => onChange(key as CreativeFormat)}
          className={`text-xs py-1.5 px-2 rounded-md font-medium transition-all ${
            selected === key
              ? 'bg-[#00D4FF] text-black'
              : 'bg-white/[0.03] border border-white/10 text-[#9ca3af] hover:text-white hover:border-[#00D4FF]/30'
          }`}
        >
          {val.width}×{val.height}
        </button>
      ))}
    </div>
  );
}
