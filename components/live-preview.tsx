'use client';

import { useEffect, useRef } from 'react';

interface LivePreviewProps {
  html: string;
  width: number;
  height: number;
  fieldValues: Record<string, string>;
  cssVars?: Record<string, string>;
  scale?: number;
  editable?: boolean;
  onDragEnd?: (elementId: string, xPercent: number, yPercent: number) => void;
  onSelectElement?: (elementId: string | null) => void;
}

const IFRAME_SCRIPT = `
<script>
(function() {
  // ── 1. Live Update Listener ──
  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;
    if (e.data.type === 'update-css-var') {
      document.documentElement.style.setProperty(e.data.key, e.data.value);
    }
    if (e.data.type === 'update-text') {
      var safeVal = e.data.value.replace(/&/g,'&amp;').replace(/\\x3c/g,'&lt;').replace(/>/g,'&gt;');
      document.querySelectorAll('[data-field="' + e.data.field + '"]').forEach(function(el) {
        if (el.classList.contains('original-price')) {
          el.textContent = 'Statt ' + e.data.value;
        } else if (e.data.field === 'headline') {
          el.innerHTML = safeVal.replace(/\\n/g, '<br>');
        } else {
          el.textContent = e.data.value;
        }
      });
    }
    if (e.data.type === 'update-image') {
      if (e.data.field === 'backgroundImage') {
        var bg = document.querySelector('.background');
        if (bg) bg.style.backgroundImage = "url('" + e.data.value + "')";
      } else if (e.data.field === 'personImage') {
        var person = document.querySelector('.person');
        if (person) person.src = e.data.value;
      }
    }
  });

  // ── 2. Snap Guides ──
  var guides = [];

  function clearGuides() {
    for (var i = 0; i < guides.length; i++) {
      if (guides[i].parentNode) guides[i].parentNode.removeChild(guides[i]);
    }
    guides = [];
  }

  function createGuide(isVertical, positionPercent, color) {
    var g = document.createElement('div');
    g.style.position = 'absolute';
    g.style.zIndex = '999';
    g.style.pointerEvents = 'none';
    if (isVertical) {
      g.style.left = positionPercent + '%';
      g.style.top = '0';
      g.style.width = '1px';
      g.style.height = '100%';
    } else {
      g.style.top = positionPercent + '%';
      g.style.left = '0';
      g.style.height = '1px';
      g.style.width = '100%';
    }
    g.style.backgroundColor = color;
    var container = document.querySelector('.creative-container');
    if (container) container.appendChild(g);
    guides.push(g);
    return g;
  }

  function getElementCenter(el, cRect) {
    var r = el.getBoundingClientRect();
    return {
      x: ((r.left + r.width / 2 - cRect.left) / cRect.width) * 100,
      y: ((r.top + r.height / 2 - cRect.top) / cRect.height) * 100,
      left: ((r.left - cRect.left) / cRect.width) * 100,
      right: ((r.right - cRect.left) / cRect.width) * 100,
      top: ((r.top - cRect.top) / cRect.height) * 100,
      bottom: ((r.bottom - cRect.top) / cRect.height) * 100
    };
  }

  var SNAP_THRESHOLD = 2;

  function checkSnap(draggedEl, cRect, xPct, yPct, elWidth, elHeight) {
    clearGuides();
    var cx = xPct + elWidth / 2;
    var cy = yPct + elHeight / 2;
    var snappedX = xPct;
    var snappedY = yPct;

    // Check canvas center (50%, 50%)
    if (Math.abs(cx - 50) < SNAP_THRESHOLD) {
      createGuide(true, 50, 'red');
      snappedX = 50 - elWidth / 2;
    }
    if (Math.abs(cy - 50) < SNAP_THRESHOLD) {
      createGuide(false, 50, 'red');
      snappedY = 50 - elHeight / 2;
    }

    // Check other draggable elements
    var others = document.querySelectorAll('[data-draggable]');
    for (var i = 0; i < others.length; i++) {
      var other = others[i];
      if (other === draggedEl) continue;
      var oc = getElementCenter(other, cRect);

      // Snap to other element's center X
      if (Math.abs(cx - oc.x) < SNAP_THRESHOLD) {
        createGuide(true, oc.x, 'blue');
        snappedX = oc.x - elWidth / 2;
      }
      // Snap to other element's center Y
      if (Math.abs(cy - oc.y) < SNAP_THRESHOLD) {
        createGuide(false, oc.y, 'blue');
        snappedY = oc.y - elHeight / 2;
      }
      // Snap to other element's left edge
      if (Math.abs(cx - oc.left) < SNAP_THRESHOLD) {
        createGuide(true, oc.left, 'blue');
        snappedX = oc.left - elWidth / 2;
      }
      // Snap to other element's right edge
      if (Math.abs(cx - oc.right) < SNAP_THRESHOLD) {
        createGuide(true, oc.right, 'blue');
        snappedX = oc.right - elWidth / 2;
      }
      // Snap to other element's top edge
      if (Math.abs(cy - oc.top) < SNAP_THRESHOLD) {
        createGuide(false, oc.top, 'blue');
        snappedY = oc.top - elHeight / 2;
      }
      // Snap to other element's bottom edge
      if (Math.abs(cy - oc.bottom) < SNAP_THRESHOLD) {
        createGuide(false, oc.bottom, 'blue');
        snappedY = oc.bottom - elHeight / 2;
      }
    }

    return { x: snappedX, y: snappedY };
  }

  // ── Stack Detection ──
  function autoStackElements(draggedId) {
    var container = document.querySelector('.creative-container');
    if (!container) return;
    var cRect = container.getBoundingClientRect();
    var textElements = [];
    var draggables = document.querySelectorAll('[data-draggable]');
    for (var i = 0; i < draggables.length; i++) {
      var id = draggables[i].getAttribute('data-draggable');
      if (id === 'person') continue;
      var r = draggables[i].getBoundingClientRect();
      textElements.push({
        id: id,
        el: draggables[i],
        top: ((r.top - cRect.top) / cRect.height) * 100,
        bottom: ((r.bottom - cRect.top) / cRect.height) * 100,
        height: (r.height / cRect.height) * 100
      });
    }
    textElements.sort(function(a, b) { return a.top - b.top; });
    var minGap = 3;
    for (var j = 0; j < textElements.length - 1; j++) {
      var current = textElements[j];
      var next = textElements[j + 1];
      var gap = next.top - current.bottom;
      if (gap < minGap) {
        var newTop = current.bottom + minGap;
        next.top = newTop;
        next.bottom = newTop + next.height;
        var root = document.documentElement;
        root.style.setProperty('--' + next.id + '-y', newTop.toFixed(1) + '%');
        parent.postMessage({ type: 'stack-adjust', id: next.id, y: newTop }, '*');
      }
    }
  }

  // ── 3. Drag Handling ──
  var dragging = null;
  var offsetX = 0, offsetY = 0;
  var container = null;
  var dragId = null;

  document.addEventListener('mousedown', function(e) {
    var el = e.target.closest('[data-draggable]');

    // Reset outlines
    document.querySelectorAll('[data-draggable]').forEach(function(node) {
      node.style.outline = '';
      node.style.outlineOffset = '';
    });

    if (!el) {
      parent.postMessage({ type: 'element-select', id: null }, '*');
      return;
    }

    e.preventDefault();
    dragging = el;
    container = document.querySelector('.creative-container');
    dragId = el.getAttribute('data-draggable');

    parent.postMessage({ type: 'element-select', id: dragId }, '*');

    if (!container) return;

    var rect = el.getBoundingClientRect();
    var cRect = container.getBoundingClientRect();

    var currentLeftPx = rect.left - cRect.left;
    var currentTopPx = rect.top - cRect.top;

    el.style.left = (currentLeftPx / cRect.width * 100) + '%';
    el.style.top = (currentTopPx / cRect.height * 100) + '%';
    el.style.transform = 'none';
    el.style.bottom = 'auto';

    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    el.style.cursor = 'grabbing';
    el.style.outline = '2px solid #00D4FF';
    el.style.outlineOffset = '4px';
  });

  document.addEventListener('mousemove', function(e) {
    if (!dragging || !container) return;
    e.preventDefault();
    var cRect = container.getBoundingClientRect();
    var elRect = dragging.getBoundingClientRect();
    var elWidthPct = (elRect.width / cRect.width) * 100;
    var elHeightPct = (elRect.height / cRect.height) * 100;

    var xPx = e.clientX - cRect.left - offsetX;
    var yPx = e.clientY - cRect.top - offsetY;
    var xPct = (xPx / cRect.width) * 100;
    var yPct = (yPx / cRect.height) * 100;

    var snapped = checkSnap(dragging, cRect, xPct, yPct, elWidthPct, elHeightPct);
    dragging.style.left = snapped.x + '%';
    dragging.style.top = snapped.y + '%';
  });

  document.addEventListener('mouseup', function(e) {
    if (!dragging || !container) return;
    clearGuides();
    var cRect = container.getBoundingClientRect();
    var rect = dragging.getBoundingClientRect();
    var id = dragId;
    var root = document.documentElement;
    dragging.style.cursor = '';

    if (id === 'person') {
      var centerX = rect.left + rect.width / 2 - cRect.left;
      var xOffsetPct = (centerX / cRect.width) * 100 - 50;
      var bottomPx = cRect.bottom - rect.bottom;
      var bottomPct = (bottomPx / cRect.height) * 100;
      root.style.setProperty('--person-position-x', xOffsetPct.toFixed(1) + '%');
      root.style.setProperty('--person-position-y', bottomPct.toFixed(1) + '%');
      parent.postMessage({ type: 'drag-end', id: id, x: xOffsetPct, y: bottomPct }, '*');
    } else {
      var centerX = rect.left + rect.width / 2 - cRect.left;
      var topPx = rect.top - cRect.top;
      var xPct = (centerX / cRect.width) * 100;
      var yPct = (topPx / cRect.height) * 100;
      root.style.setProperty('--' + id + '-x', xPct.toFixed(1) + '%');
      root.style.setProperty('--' + id + '-y', yPct.toFixed(1) + '%');
      parent.postMessage({ type: 'drag-end', id: id, x: xPct, y: yPct }, '*');
    }

    // Keep inline styles in place - do NOT clear them.
    // Clearing left/top/transform causes elements to snap to CSS-var positions
    // which interacts badly with translateX(-50%) centering, causing elements
    // to jump off-screen. The inline position is visually correct; CSS vars
    // are sent to parent for persistence and re-applied on next iframe rebuild.

    dragging.style.outline = '';
    dragging.style.outlineOffset = '';

    dragging = null;
    container = null;
    dragId = null;
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

  // Signal ready
  parent.postMessage({ type: 'iframe-ready' }, '*');
})();
</script>`;

// Keys that are CSS variables, not text content
const CSS_VAR_KEYS = new Set(['width', 'height', 'primaryColor', 'accentColor']);
// Keys that are image updates
const IMAGE_KEYS = new Set(['backgroundImage', 'personImage']);

export function LivePreview({ html, width, height, fieldValues, cssVars, scale: scaleProp, editable = false, onDragEnd, onSelectElement }: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReady = useRef(false);
  const prevFieldValues = useRef<Record<string, string>>({});
  const prevCssVars = useRef<Record<string, string>>({});

  // ── useEffect 1: Init iframe ──
  useEffect(() => {
    if (!iframeRef.current || !html) return;

    iframeReady.current = false;

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

    // Inject iframe script if editable
    if (editable) {
      if (rendered.includes('</body>')) {
        rendered = rendered.replace('</body>', `${IFRAME_SCRIPT}</body>`);
      } else {
        rendered += IFRAME_SCRIPT;
      }
    }

    iframeRef.current.srcdoc = rendered;

    // Store initial values in refs for diffing
    prevFieldValues.current = { ...fieldValues };
    prevCssVars.current = { ...(cssVars || {}) };
  }, [html, width, height, editable]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── useEffect 2: Live update fieldValues ──
  useEffect(() => {
    if (!iframeReady.current || !iframeRef.current?.contentWindow) return;

    const prev = prevFieldValues.current;
    for (const [key, value] of Object.entries(fieldValues)) {
      if (CSS_VAR_KEYS.has(key)) continue;
      if (prev[key] === value) continue;

      if (IMAGE_KEYS.has(key)) {
        iframeRef.current.contentWindow.postMessage({ type: 'update-image', field: key, value }, '*');
      } else {
        iframeRef.current.contentWindow.postMessage({ type: 'update-text', field: key, value }, '*');
      }
    }

    prevFieldValues.current = { ...fieldValues };
  }, [fieldValues]);

  // ── useEffect 3: Live update cssVars ──
  useEffect(() => {
    if (!iframeReady.current || !iframeRef.current?.contentWindow || !cssVars) return;

    const prev = prevCssVars.current;
    for (const [key, value] of Object.entries(cssVars)) {
      if (prev[key] === value) continue;
      iframeRef.current.contentWindow.postMessage({ type: 'update-css-var', key, value }, '*');
    }

    prevCssVars.current = { ...cssVars };
  }, [cssVars]);

  // ── useEffect 4: Message listener ──
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data?.type) return;
      if (e.data.type === 'iframe-ready') {
        iframeReady.current = true;
        // Send all current CSS vars to newly ready iframe
        if (cssVars && iframeRef.current?.contentWindow) {
          for (const [key, value] of Object.entries(cssVars)) {
            iframeRef.current.contentWindow.postMessage({ type: 'update-css-var', key, value }, '*');
          }
        }
      }
      if (e.data?.type === 'drag-end' && editable && onDragEnd) {
        onDragEnd(e.data.id, e.data.x, e.data.y);
      }
      if (e.data?.type === 'element-select' && editable && onSelectElement) {
        onSelectElement(e.data.id);
      }
      if (e.data?.type === 'stack-adjust' && onDragEnd) {
        // Stack adjustment only changes Y, keep X unchanged
        onDragEnd(e.data.id, -999, e.data.y);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [editable, onDragEnd, onSelectElement, cssVars]);

  const maxDisplayWidth = 400;
  const autoScale = Math.min(1, maxDisplayWidth / width);
  const scale = scaleProp ?? autoScale;

  return (
    <div className="flex flex-col items-center">
      <div className="text-[#6b7280] text-xs mb-2">
        VORSCHAU {editable && <span className="text-[#00D4FF]">- Texte verschieben per Drag</span>} · {width}x{height}
      </div>
      <div
        style={{
          width: width * scale,
          height: height * scale,
          overflow: 'hidden',
          borderRadius: '4px',
          border: editable ? '1px solid #00D4FF' : '1px solid rgba(255,255,255,0.06)',
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
