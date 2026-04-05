// components/render-progress.tsx
'use client';

import type { CampaignVariant, CreativeFormat } from '@/lib/types';

interface RenderProgressProps {
  variants: CampaignVariant[];
  formats: CreativeFormat[];
  onDownloadAll: () => void;
}

function downloadFile(outputPath: string, format: string, headline: string) {
  const filename = `${headline || 'creative'}-${format}.jpg`;
  // Use our proxy endpoint to ensure proper Content-Disposition header
  const proxyUrl = `/api/download?url=${encodeURIComponent(outputPath)}&filename=${encodeURIComponent(filename)}`;
  const a = document.createElement('a');
  a.href = proxyUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function RenderProgress({ variants, formats, onDownloadAll }: RenderProgressProps) {
  const approvedVariants = variants.filter(v => v.approved);
  const totalRenders = approvedVariants.length * formats.length;
  const doneRenders = approvedVariants.reduce(
    (sum, v) => sum + v.outputs.filter(o => o.status === 'done').length, 0
  );
  const errorRenders = approvedVariants.reduce(
    (sum, v) => sum + v.outputs.filter(o => o.status === 'error').length, 0
  );
  const allDone = doneRenders + errorRenders === totalRenders && totalRenders > 0;
  const progress = totalRenders > 0 ? Math.round((doneRenders + errorRenders) / totalRenders * 100) : 0;

  return (
    <div className="p-6">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[#9ca3af]">{doneRenders} von {totalRenders} fertig</span>
          <span className="text-[#9ca3af]">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-white/[0.045] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#00D4FF] to-[#0090cc] rounded-full transition-all duration-300 shadow-[0_0_20px_rgba(0,212,255,0.3)]"
            style={{ width: `${progress}%` }} />
        </div>
        {errorRenders > 0 && (
          <p className="text-red-400 text-xs mt-1">{errorRenders} Fehler</p>
        )}
      </div>

      {/* Variant results grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {approvedVariants.map(variant => (
          <div key={variant.id} className="glass-card rounded-xl overflow-hidden">
            <div className="p-3">
              <p className="text-white text-sm font-semibold truncate mb-2">
                {variant.fieldValues.headline || 'Variante'}
              </p>
              <div className="space-y-1.5">
                {variant.outputs.map((output, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-[#6b7280] text-xs">{output.format}</span>
                    {output.status === 'done' && output.outputPath ? (
                      <button
                        onClick={() => downloadFile(output.outputPath!, output.format, variant.fieldValues.headline || 'creative')}
                        className="text-[#22c55e] text-xs hover:underline cursor-pointer bg-transparent border-none">
                        ✓ Download
                      </button>
                    ) : output.status === 'rendering' ? (
                      <span className="text-[#00D4FF] text-xs">Rendering...</span>
                    ) : output.status === 'error' ? (
                      <span className="text-red-400 text-xs">Fehler</span>
                    ) : (
                      <span className="text-[#4b5563] text-xs">Warten...</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Download all */}
      {allDone && doneRenders > 0 && (
        <button onClick={onDownloadAll}
          className="w-full mt-6 bg-[#00D4FF] hover:bg-[#00b4d8] text-black font-bold py-4 rounded-full text-base transition-all btn-primary shadow-[0_8px_32px_rgba(0,212,255,0.3)]">
          Alle als ZIP herunterladen ({doneRenders} PNGs)
        </button>
      )}
    </div>
  );
}
