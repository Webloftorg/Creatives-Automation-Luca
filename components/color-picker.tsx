'use client';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  return (
    <div className="flex-1">
      <div className="text-[#6b7280] text-xs mb-1">{label}</div>
      <div className="flex items-center gap-2 bg-[#0e0e15] border border-white/10 rounded-lg px-3 py-2">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="bg-transparent text-[#9ca3af] text-xs w-20 outline-none" />
      </div>
    </div>
  );
}
