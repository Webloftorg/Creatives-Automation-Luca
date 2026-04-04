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
      <div className="text-[#9ca3af] text-xs uppercase tracking-wider mb-3">Generierte Creatives</div>

      {outputs.length === 0 ? (
        <div className="text-[#4b5563] text-xs text-center py-8">
          Noch keine Creatives gerendert
        </div>
      ) : (
        <div className="space-y-2">
          {outputs.map((output, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/10 rounded-lg p-2 backdrop-blur-sm">
              {output.outputPath && output.status === 'done' && (
                <img src={`/output/${output.outputPath.split('/output/').pop()}`} alt=""
                  className="w-full h-20 object-cover rounded mb-1.5" />
              )}
              <div className="flex justify-between items-center">
                <span className="text-[#9ca3af] text-xs">{output.format}</span>
                <span className={`text-xs ${
                  output.status === 'done' ? 'text-[#22c55e]' :
                  output.status === 'rendering' ? 'text-[#00D4FF]' :
                  output.status === 'error' ? 'text-red-400' : 'text-[#6b7280]'
                }`}>
                  {output.status === 'done' ? '✓ Fertig' :
                   output.status === 'rendering' ? 'Rendering...' :
                   output.status === 'error' ? 'Fehler' : 'Warten...'}
                </span>
              </div>
              {output.status === 'done' && output.outputPath && (
                <button onClick={() => onDownload(output.outputPath!)}
                  className="w-full mt-1.5 bg-white/[0.045] border border-white/10 text-[#e8eaed] rounded py-1 text-xs hover:bg-white/[0.08] transition-colors">
                  ↓ Download
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {outputs.some(o => o.status === 'done') && (
        <button onClick={onDownloadAll}
          className="w-full mt-4 bg-white/[0.045] border border-white/15 text-[#e8eaed] rounded-lg py-2.5 text-sm hover:bg-white/[0.08] transition-colors">
          📦 Alle als ZIP
        </button>
      )}
    </div>
  );
}
