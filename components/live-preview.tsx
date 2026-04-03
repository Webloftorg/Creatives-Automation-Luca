'use client';

import { useEffect, useRef } from 'react';

interface LivePreviewProps {
  html: string;
  width: number;
  height: number;
  fieldValues: Record<string, string>;
}

export function LivePreview({ html, width, height, fieldValues }: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!iframeRef.current || !html) return;

    let rendered = html;
    const allValues = { ...fieldValues, width: String(width), height: String(height) };
    for (const [key, value] of Object.entries(allValues)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    iframeRef.current.srcdoc = rendered;
  }, [html, width, height, fieldValues]);

  const maxDisplayWidth = 400;
  const scale = Math.min(1, maxDisplayWidth / width);

  return (
    <div className="flex flex-col items-center">
      <div className="text-[#444] text-xs mb-2">
        VORSCHAU · {width}×{height}
      </div>
      <div
        style={{
          width: width * scale,
          height: height * scale,
          overflow: 'hidden',
          borderRadius: '4px',
          border: '1px solid #222',
        }}
      >
        <iframe
          ref={iframeRef}
          style={{
            width,
            height,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            border: 'none',
          }}
          sandbox="allow-same-origin"
          title="Creative Preview"
        />
      </div>
    </div>
  );
}
