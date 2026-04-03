'use client';

import type { CreativeOutput } from '@/lib/types';

interface BatchPanelProps {
  outputs: CreativeOutput[];
  onDownload: (outputPath: string) => void;
  onDownloadAll: () => void;
}

export function BatchPanel({ outputs, onDownload, onDownloadAll }: BatchPanelProps) {
  return (
    <div>
      <div className="text-[#888] text-xs uppercase tracking-wider mb-3">Generierte Creatives</div>

      {outputs.length === 0 ? (
        <div className="text-[#444] text-xs text-center py-8">
          Noch keine Creatives gerendert
        </div>
      ) : (
        <div className="space-y-2">
          {outputs.map((output, i) => (
            <div key={i} className="bg-[#1a1a1a] border border-[#333] rounded-lg p-2">
              {output.outputPath && output.status === 'done' && (
                <img src={`/output/${output.outputPath.split('/output/').pop()}`} alt=""
                  className="w-full h-20 object-cover rounded mb-1.5" />
              )}
              <div className="flex justify-between items-center">
                <span className="text-[#888] text-xs">{output.format}</span>
                <span className={`text-xs ${
                  output.status === 'done' ? 'text-[#4CAF50]' :
                  output.status === 'rendering' ? 'text-[#FF4500]' :
                  output.status === 'error' ? 'text-red-400' : 'text-[#666]'
                }`}>
                  {output.status === 'done' ? '✓ Fertig' :
                   output.status === 'rendering' ? 'Rendering...' :
                   output.status === 'error' ? 'Fehler' : 'Warten...'}
                </span>
              </div>
              {output.status === 'done' && output.outputPath && (
                <button onClick={() => onDownload(output.outputPath!)}
                  className="w-full mt-1.5 bg-[#222] border border-[#333] text-[#ccc] rounded py-1 text-xs hover:bg-[#333]">
                  ↓ Download PNG
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {outputs.some(o => o.status === 'done') && (
        <button onClick={onDownloadAll}
          className="w-full mt-4 bg-[#222] border border-[#444] text-[#ccc] rounded-lg py-2.5 text-sm hover:bg-[#333]">
          📦 Alle als ZIP
        </button>
      )}
    </div>
  );
}
