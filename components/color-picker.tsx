'use client';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  return (
    <div className="flex-1">
      <div className="text-[#666] text-xs mb-1">{label}</div>
      <div className="flex items-center gap-2 bg-[#111] border border-[#333] rounded-lg px-3 py-2">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="bg-transparent text-[#aaa] text-xs w-20 outline-none" />
      </div>
    </div>
  );
}
