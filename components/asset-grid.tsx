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
        // On Windows, path.join() uses backslashes, so check both separators
        const url = (path.includes('data/assets/') || path.includes('data\\assets\\'))
          ? `/api/assets/serve?path=${encodeURIComponent(path)}`
          : path;

        return (
          <div
            key={i}
            onClick={() => onSelect?.(path)}
            className={`${sizeClass} relative rounded-lg overflow-hidden border-2 cursor-pointer transition-colors ${
              selected === path ? 'border-[#FF4500]' : 'border-[#333] hover:border-[#555]'
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
