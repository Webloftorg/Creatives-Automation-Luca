'use client';

import { useEffect, useRef, useCallback } from 'react';

interface LivePreviewProps {
  html: string;
  width: number;
  height: number;
  fieldValues: Record<string, string>;
  editable?: boolean;
  onDragEnd?: (elementId: string, xPercent: number, yPercent: number) => void;
}

const DRAG_SCRIPT = `
<script>
(function() {
  var dragging = null;
  var offsetX = 0, offsetY = 0;
  var container = null;

  document.addEventListener('mousedown', function(e) {
    var el = e.target.closest('[data-draggable]');
    if (!el) return;
    e.preventDefault();
    dragging = el;
    container = document.querySelector('.creative-container');
    if (!container) return;
    var rect = el.getBoundingClientRect();
    offsetX = e.clientX - rect.left - rect.width / 2;
    offsetY = e.clientY - rect.top;
    el.style.cursor = 'grabbing';
    el.style.outline = '2px solid #FF4500';
    el.style.outlineOffset = '4px';
  });

  document.addEventListener('mousemove', function(e) {
    if (!dragging || !container) return;
    e.preventDefault();
    var cRect = container.getBoundingClientRect();
    var xPx = e.clientX - cRect.left - offsetX;
    var yPx = e.clientY - cRect.top - offsetY;
    var xPct = (xPx / cRect.width) * 100;
    var yPct = (yPx / cRect.height) * 100;
    dragging.style.left = xPct + '%';
    dragging.style.top = yPct + '%';
  });

  document.addEventListener('mouseup', function(e) {
    if (!dragging || !container) return;
    var cRect = container.getBoundingClientRect();
    var rect = dragging.getBoundingClientRect();
    var centerX = rect.left + rect.width / 2 - cRect.left;
    var yPx = rect.top - cRect.top;
    var xPct = (centerX / cRect.width) * 100;
    var yPct = (yPx / cRect.height) * 100;
    var id = dragging.getAttribute('data-draggable');
    dragging.style.cursor = '';
    dragging.style.outline = '';
    dragging.style.outlineOffset = '';
    parent.postMessage({ type: 'drag-end', id: id, x: xPct, y: yPct }, '*');
    dragging = null;
    container = null;
  });

  // Hover cursor
  document.addEventListener('mouseover', function(e) {
    var el = e.target.closest('[data-draggable]');
    if (el) el.style.cursor = 'grab';
  });
  document.addEventListener('mouseout', function(e) {
    var el = e.target.closest('[data-draggable]');
    if (el && el !== dragging) el.style.cursor = '';
  });
})();
</script>`;

export function LivePreview({ html, width, height, fieldValues, editable = false, onDragEnd }: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!iframeRef.current || !html) return;

    let rendered = html;
    const allValues = { ...fieldValues, width: String(width), height: String(height) };
    for (const [key, value] of Object.entries(allValues)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    // Inject <base> so relative URLs resolve against localhost
    const baseTag = `<base href="${window.location.origin}/">`;
    if (rendered.includes('<head>')) {
      rendered = rendered.replace('<head>', `<head>${baseTag}`);
    } else {
      rendered = `${baseTag}${rendered}`;
    }

    // Inject drag script if editable
    if (editable) {
      if (rendered.includes('</body>')) {
        rendered = rendered.replace('</body>', `${DRAG_SCRIPT}</body>`);
      } else {
        rendered += DRAG_SCRIPT;
      }
    }

    iframeRef.current.srcdoc = rendered;
  }, [html, width, height, fieldValues, editable]);

  // Listen for drag messages from iframe
  useEffect(() => {
    if (!editable || !onDragEnd) return;

    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'drag-end') {
        onDragEnd(e.data.id, e.data.x, e.data.y);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [editable, onDragEnd]);

  const maxDisplayWidth = 400;
  const scale = Math.min(1, maxDisplayWidth / width);

  return (
    <div className="flex flex-col items-center">
      <div className="text-[#444] text-xs mb-2">
        VORSCHAU {editable && <span className="text-[#FF4500]">- Texte verschieben per Drag</span>} · {width}x{height}
      </div>
      <div
        style={{
          width: width * scale,
          height: height * scale,
          overflow: 'hidden',
          borderRadius: '4px',
          border: editable ? '1px solid #FF4500' : '1px solid #222',
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
          sandbox="allow-same-origin allow-scripts"
          title="Creative Preview"
        />
      </div>
    </div>
  );
}
