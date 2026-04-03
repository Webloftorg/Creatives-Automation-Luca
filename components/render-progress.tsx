// components/render-progress.tsx
'use client';

import type { CampaignVariant, CreativeFormat } from '@/lib/types';

interface RenderProgressProps {
  variants: CampaignVariant[];
  formats: CreativeFormat[];
  onDownloadAll: () => void;
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
          <span className="text-[#888]">{doneRenders} von {totalRenders} fertig</span>
          <span className="text-[#888]">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-[#222] rounded-full overflow-hidden">
          <div className="h-full bg-[#FF4500] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }} />
        </div>
        {errorRenders > 0 && (
          <p className="text-red-400 text-xs mt-1">{errorRenders} Fehler</p>
        )}
      </div>

      {/* Variant results grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {approvedVariants.map(variant => (
          <div key={variant.id} className="bg-[#111] border border-[#333] rounded-xl overflow-hidden">
            <div className="p-3">
              <p className="text-white text-sm font-semibold truncate mb-2">
                {variant.fieldValues.headline || 'Variante'}
              </p>
              <div className="space-y-1.5">
                {variant.outputs.map((output, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-[#666] text-xs">{output.format}</span>
                    {output.status === 'done' && output.outputPath ? (
                      <a href={output.outputPath} download
                        className="text-[#4CAF50] text-xs hover:underline">
                        ✓ Download
                      </a>
                    ) : output.status === 'rendering' ? (
                      <span className="text-[#FF4500] text-xs">Rendering...</span>
                    ) : output.status === 'error' ? (
                      <span className="text-red-400 text-xs">Fehler</span>
                    ) : (
                      <span className="text-[#444] text-xs">Warten...</span>
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
          className="w-full mt-6 bg-[#FF4500] hover:bg-[#e63e00] text-white font-bold py-4 rounded-lg text-base transition-colors">
          Alle als ZIP herunterladen ({doneRenders} PNGs)
        </button>
      )}
    </div>
  );
}
