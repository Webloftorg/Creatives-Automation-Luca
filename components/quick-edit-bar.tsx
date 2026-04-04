// components/quick-edit-bar.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

const ELEMENT_LABELS: Record<string, string> = {
  headline: 'Headline',
  'price-block': 'Preis',
  location: 'Standort',
};

const ELEMENT_TO_FIELD: Record<string, string> = {
  headline: 'headline',
  'price-block': 'price',
  location: 'location',
};

interface QuickEditBarProps {
  selectedElement: string | null;
  fieldValues: Record<string, string>;
  onFieldChange: (field: string, value: string) => void;
  width: number;
}

export function QuickEditBar({ selectedElement, fieldValues, onFieldChange, width }: QuickEditBarProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fieldName = selectedElement ? ELEMENT_TO_FIELD[selectedElement] : null;
  const [originalValue, setOriginalValue] = useState('');

  useEffect(() => {
    if (fieldName && fieldValues[fieldName]) {
      setOriginalValue(fieldValues[fieldName]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [selectedElement]);

  if (!selectedElement || !fieldName || !(fieldName in fieldValues)) return null;

  const label = ELEMENT_LABELS[selectedElement] || selectedElement;
  const value = fieldValues[fieldName] || '';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRef.current?.blur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onFieldChange(fieldName, originalValue);
      inputRef.current?.blur();
    }
  };

  return (
    <div
      className="bg-[#15151e] border-t-2 border-[#00D4FF] rounded-b-lg flex items-center gap-2 px-3 py-2"
      style={{ width }}
    >
      <span className="text-[#00D4FF] text-[10px] uppercase tracking-wider font-bold whitespace-nowrap">{label}</span>
      <textarea
        ref={inputRef}
        value={value}
        onChange={e => onFieldChange(fieldName, e.target.value)}
        onKeyDown={handleKeyDown}
        rows={selectedElement === 'headline' ? 2 : 1}
        className="flex-1 bg-transparent border-none text-white text-sm font-semibold outline-none resize-none"
        spellCheck={false}
      />
    </div>
  );
}
