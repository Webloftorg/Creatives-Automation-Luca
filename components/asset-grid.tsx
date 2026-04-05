'use client';

interface AssetGridProps {
  assets: string[];
  selected?: string;
  onSelect?: (path: string) => void;
  onDelete?: (path: string) => void;
  size?: 'sm' | 'md';
}

export function AssetGrid({ assets, selected, onSelect, onDelete, size = 'md' }: AssetGridProps) {
  const sizeClass = size === 'sm' ? 'w-12 h-12' : 'w-20 h-20';

  return (
    <div className="flex gap-2 flex-wrap">
      {assets.map((path, i) => {
        // Always route through serve API - works for both filesystem and Supabase paths
        const url = path.startsWith('http') || path.startsWith('/api/')
          ? path
          : `/api/assets/serve?path=${encodeURIComponent(path)}`;

        return (
          <div
            key={i}
            onClick={() => onSelect?.(selected === path ? '' : path)}
            className={`${sizeClass} relative rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
              selected === path ? 'border-[#00D4FF] shadow-[0_0_12px_rgba(0,212,255,0.3)]' : 'border-white/10 hover:border-white/25'
            }`}
          >
            <img src={url} alt="" className="w-full h-full object-cover" />
            {onDelete && (
              <button
                onClick={e => { e.stopPropagation(); onDelete(path); }}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 rounded text-white text-xs flex items-center justify-center hover:bg-red-600"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
