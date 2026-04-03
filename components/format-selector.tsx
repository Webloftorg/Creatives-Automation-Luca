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
          className={`text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${
            selected === key
              ? 'bg-[#FF4500] text-white'
              : 'bg-[#1a1a1a] border border-[#333] text-[#888] hover:text-white'
          }`}
        >
          {val.width}×{val.height}
        </button>
      ))}
    </div>
  );
}
