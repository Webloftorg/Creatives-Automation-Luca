# Editor Package A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the creative editor solid and professional with headline wrap control, snap guides, zero-flicker live updates, and undo/redo.

**Architecture:** All changes stay within the existing iframe-based architecture. The iframe gets a richer injected script (snap guides, live update listener). The React side sends postMessage updates instead of rebuilding srcdoc. Undo/redo is a simple state stack in the editor components.

**Tech Stack:** React, TypeScript, iframe postMessage API, CSS Variables

---

## File Structure

### Modified Files
- `public/templates/*.html` (all 5) — add `--headline-wrap` CSS var, `data-field` attributes, `white-space: var(--headline-wrap)` on `.headline`
- `components/live-preview.tsx` — Major rewrite: new IFRAME_SCRIPT with snap guides + live update listener, split useEffect into init-once + live-update
- `components/css-var-slider.tsx` — add headline wrap toggle button
- `components/creative-editor-modal.tsx` — add undo/redo state, keyboard shortcuts, toolbar buttons, pass cssVars to LivePreview for live updates
- `app/studio/[id]/creatives/page.tsx` — same undo/redo logic
- `lib/template-utils.ts` — add `--headline-wrap` to REQUIRED_CSS_VARS
- `scripts/seed-reference-template.ts` — re-seed

---

## Task 1: Template Updates (headline-wrap + data-field attributes)

**Files:**
- Modify: `public/templates/price-offer-reference.html`
- Modify: `public/templates/split-bold.html`
- Modify: `public/templates/minimal-light.html`
- Modify: `public/templates/full-impact.html`
- Modify: `public/templates/editorial.html`
- Modify: `lib/template-utils.ts`

- [ ] **Step 1: Add `--headline-wrap` to all 5 templates**

In each template's `:root` block, add `--headline-wrap: normal;` after `--overlay-color`.

In each template's `.headline` CSS class, change the line that has `max-width: 90%; word-break: break-word;` to:
```css
max-width: 90%; word-break: break-word; white-space: var(--headline-wrap);
```

- [ ] **Step 2: Add `data-field` attributes to all 5 templates**

In each template's HTML body, add `data-field` attributes to text elements so they can be targeted by the live update script:

```html
<div class="location" data-draggable="location" data-field="location">{{location}}</div>
<h1 class="headline" data-draggable="headline" data-field="headline">{{headline}}</h1>
```

Inside the `.price-block`:
```html
<div class="price" data-field="price">{{price}}</div>
<div class="original-price" data-field="originalPrice">Statt {{originalPrice}}</div>
```

For watermark `<span>` elements that contain `{{headline}}`, add `data-field="headline"`:
```html
<span data-field="headline">{{headline}}</span>
```

For footer-bar `<span>` elements containing `{{location}}`, add `data-field="location"`:
```html
<span data-field="location">{{location}}</span>
```

- [ ] **Step 3: Add `--headline-wrap` to REQUIRED_CSS_VARS in template-utils.ts**

In `lib/template-utils.ts`, find the `REQUIRED_CSS_VARS` object and add:
```typescript
'--headline-wrap': 'normal',
```

- [ ] **Step 4: Re-seed templates and verify**

```bash
npx tsx scripts/seed-reference-template.ts
```

Verify with:
```bash
grep -c "data-field" public/templates/*.html
grep -c "headline-wrap" public/templates/*.html
```

Each template should have multiple `data-field` matches and 2 `headline-wrap` matches (one in `:root`, one in `.headline`).

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "storage-campaigns.test.ts" | grep -v "missing the following properties" | head -5
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add public/templates/ lib/template-utils.ts data/templates/
git commit -m "feat: add headline-wrap CSS var and data-field attributes to all templates"
```

---

## Task 2: Headline Wrap Toggle in CSS Var Slider

**Files:**
- Modify: `components/css-var-slider.tsx`

- [ ] **Step 1: Add wrap toggle to CssVarSlider**

In `components/css-var-slider.tsx`, add a headline wrap toggle button. Insert it right before the group loop (before `{Object.entries(groups).map(...)}`), visible only when `selectedSection === 'headline'`:

```typescript
{selectedSection === 'headline' && (
  <div>
    <div className="text-[#666] text-[10px] uppercase tracking-widest mb-2">Textumbruch</div>
    <div className="flex gap-2">
      <button
        onClick={() => onChange('--headline-wrap', 'nowrap')}
        className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${
          (variables['--headline-wrap'] || 'normal') === 'nowrap'
            ? 'bg-[#FF4500] text-white' : 'bg-[#1a1a1a] border border-[#333] text-[#666]'
        }`}>
        Einzeilig
      </button>
      <button
        onClick={() => onChange('--headline-wrap', 'normal')}
        className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${
          (variables['--headline-wrap'] || 'normal') === 'normal'
            ? 'bg-[#FF4500] text-white' : 'bg-[#1a1a1a] border border-[#333] text-[#666]'
        }`}>
        Mehrzeilig
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 2: Verify toggle renders**

Start dev server, open editor, select headline element. The "Textumbruch" toggle should appear above other sliders in the Stil tab.

- [ ] **Step 3: Commit**

```bash
git add components/css-var-slider.tsx
git commit -m "feat: add headline single-line/multi-line toggle"
```

---

## Task 3: Live Preview Rewrite (snap guides + live updates)

This is the biggest task. The `DRAG_SCRIPT` gets rewritten as `IFRAME_SCRIPT` which includes drag handling, snap guides, AND a live update message listener.

**Files:**
- Modify: `components/live-preview.tsx`

- [ ] **Step 1: Add new props to LivePreview**

Add `cssVars` prop to `LivePreviewProps` so the component can send CSS var updates without rebuilding:

```typescript
interface LivePreviewProps {
  html: string;
  width: number;
  height: number;
  fieldValues: Record<string, string>;
  cssVars?: Record<string, string>;
  editable?: boolean;
  onDragEnd?: (elementId: string, xPercent: number, yPercent: number) => void;
  onSelectElement?: (elementId: string | null) => void;
}
```

Update the component signature to destructure `cssVars`:
```typescript
export function LivePreview({ html, width, height, fieldValues, cssVars, editable = false, onDragEnd, onSelectElement }: LivePreviewProps)
```

- [ ] **Step 2: Replace DRAG_SCRIPT with IFRAME_SCRIPT**

Replace the entire `DRAG_SCRIPT` constant with a new `IFRAME_SCRIPT` that includes three systems:

1. **Drag handling** (same logic as current, with snap guides added)
2. **Snap guides** (center lines + element alignment)
3. **Live update listener** (receives postMessage for CSS vars, text, images)

```javascript
const IFRAME_SCRIPT = `
<script>
(function() {
  // ─── LIVE UPDATE LISTENER ───
  window.addEventListener('message', function(e) {
    if (!e.data || !e.data.type) return;
    if (e.data.type === 'update-css-var') {
      document.documentElement.style.setProperty(e.data.key, e.data.value);
    }
    if (e.data.type === 'update-text') {
      document.querySelectorAll('[data-field="' + e.data.field + '"]').forEach(function(el) {
        if (el.childElementCount === 0) {
          el.textContent = e.data.value;
        } else if (el.classList.contains('original-price')) {
          el.textContent = 'Statt ' + e.data.value;
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
    if (e.data.type === 'init-complete') {
      parent.postMessage({ type: 'iframe-ready' }, '*');
    }
  });

  // ─── SNAP GUIDES ───
  var guideElements = [];
  var SNAP_THRESHOLD = 2; // percent

  function clearGuides() {
    guideElements.forEach(function(el) { el.remove(); });
    guideElements = [];
  }

  function createGuide(isVertical, position, color) {
    var container = document.querySelector('.creative-container');
    if (!container) return;
    var guide = document.createElement('div');
    guide.style.position = 'absolute';
    guide.style.zIndex = '999';
    guide.style.pointerEvents = 'none';
    if (isVertical) {
      guide.style.left = position + '%';
      guide.style.top = '0';
      guide.style.width = '1px';
      guide.style.height = '100%';
    } else {
      guide.style.top = position + '%';
      guide.style.left = '0';
      guide.style.height = '1px';
      guide.style.width = '100%';
    }
    guide.style.backgroundColor = color;
    guide.className = 'snap-guide';
    container.appendChild(guide);
    guideElements.push(guide);
  }

  function checkSnap(xPct, yPct, draggedId) {
    clearGuides();
    var snappedX = xPct, snappedY = yPct;
    var container = document.querySelector('.creative-container');
    if (!container) return { x: xPct, y: yPct };
    var cRect = container.getBoundingClientRect();

    // Center guides
    if (Math.abs(xPct - 50) < SNAP_THRESHOLD) {
      snappedX = 50;
      createGuide(true, 50, '#FF4500');
    }
    if (Math.abs(yPct - 50) < SNAP_THRESHOLD) {
      snappedY = 50;
      createGuide(false, 50, '#FF4500');
    }

    // Element alignment guides
    var others = document.querySelectorAll('[data-draggable]');
    others.forEach(function(other) {
      if (other.getAttribute('data-draggable') === draggedId) return;
      var oRect = other.getBoundingClientRect();
      var oCenterX = ((oRect.left + oRect.width / 2 - cRect.left) / cRect.width) * 100;
      var oCenterY = ((oRect.top + oRect.height / 2 - cRect.top) / cRect.height) * 100;
      var oTop = ((oRect.top - cRect.top) / cRect.height) * 100;
      var oBottom = ((oRect.bottom - cRect.top) / cRect.height) * 100;

      // Horizontal center alignment
      if (Math.abs(xPct - oCenterX) < SNAP_THRESHOLD) {
        snappedX = oCenterX;
        createGuide(true, oCenterX, '#4488FF');
      }
      // Vertical center alignment
      if (Math.abs(yPct - oCenterY) < SNAP_THRESHOLD) {
        snappedY = oCenterY;
        createGuide(false, oCenterY, '#4488FF');
      }
      // Top edge alignment
      if (Math.abs(yPct - oTop) < SNAP_THRESHOLD) {
        snappedY = oTop;
        createGuide(false, oTop, '#4488FF');
      }
      // Bottom edge alignment
      if (Math.abs(yPct - oBottom) < SNAP_THRESHOLD) {
        snappedY = oBottom;
        createGuide(false, oBottom, '#4488FF');
      }
    });

    return { x: snappedX, y: snappedY };
  }

  // ─── DRAG HANDLING ───
  var dragging = null;
  var offsetX = 0, offsetY = 0;
  var container = null;
  var dragId = null;

  document.addEventListener('mousedown', function(e) {
    var el = e.target.closest('[data-draggable]');
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

    // Check snap guides
    var elRect = dragging.getBoundingClientRect();
    var elCenterX = xPct + (elRect.width / cRect.width * 100) / 2;
    var elCenterY = yPct + (elRect.height / cRect.height * 100) / 2;
    var snapped = checkSnap(elCenterX, elCenterY, dragId);

    // Apply snapped position (convert back from center to top-left)
    var finalX = snapped.x - (elRect.width / cRect.width * 100) / 2;
    var finalY = snapped.y - (elRect.height / cRect.height * 100) / 2;
    dragging.style.left = finalX + '%';
    dragging.style.top = finalY + '%';
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

    dragging.style.left = '';
    dragging.style.top = '';
    dragging.style.bottom = '';
    dragging.style.transform = '';
    dragging = null;
    container = null;
    dragId = null;
  });

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
```

- [ ] **Step 3: Split useEffect into init-once + live-update**

Replace the current single useEffect (that rebuilds srcdoc on every change) with two separate effects:

**Effect 1: Initialize iframe (runs only on html/format change)**
```typescript
const iframeReady = useRef(false);
const prevFieldValues = useRef<Record<string, string>>({});
const prevCssVars = useRef<Record<string, string>>({});

// Build srcdoc only on template/format change
useEffect(() => {
  if (!iframeRef.current || !html) return;
  iframeReady.current = false;

  let rendered = html;
  const allValues = { ...fieldValues, width: String(width), height: String(height) };
  for (const [key, value] of Object.entries(allValues)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  const baseTag = `<base href="${window.location.origin}/">`;
  if (rendered.includes('<head>')) {
    rendered = rendered.replace('<head>', `<head>${baseTag}`);
  } else {
    rendered = `${baseTag}${rendered}`;
  }

  if (editable) {
    if (rendered.includes('</body>')) {
      rendered = rendered.replace('</body>', `${IFRAME_SCRIPT}</body>`);
    } else {
      rendered += IFRAME_SCRIPT;
    }
  }

  iframeRef.current.srcdoc = rendered;
  prevFieldValues.current = { ...fieldValues };
  prevCssVars.current = { ...cssVars || {} };
}, [html, width, height, editable]);
```

**Effect 2: Live-update field values via postMessage**
```typescript
useEffect(() => {
  if (!iframeReady.current || !iframeRef.current?.contentWindow) return;
  const cw = iframeRef.current.contentWindow;

  for (const [key, value] of Object.entries(fieldValues)) {
    if (prevFieldValues.current[key] !== value) {
      if (key === 'backgroundImage' || key === 'personImage') {
        cw.postMessage({ type: 'update-image', field: key, value }, '*');
      } else if (!['width', 'height', 'primaryColor', 'accentColor'].includes(key)) {
        cw.postMessage({ type: 'update-text', field: key, value }, '*');
      }
    }
  }
  prevFieldValues.current = { ...fieldValues };
}, [fieldValues]);
```

**Effect 3: Live-update CSS vars via postMessage**
```typescript
useEffect(() => {
  if (!iframeReady.current || !iframeRef.current?.contentWindow || !cssVars) return;
  const cw = iframeRef.current.contentWindow;

  for (const [key, value] of Object.entries(cssVars)) {
    if (prevCssVars.current[key] !== value) {
      cw.postMessage({ type: 'update-css-var', key, value }, '*');
    }
  }
  prevCssVars.current = { ...cssVars };
}, [cssVars]);
```

**Update the message listener to handle iframe-ready:**
```typescript
useEffect(() => {
  if (!editable) return;
  const handler = (e: MessageEvent) => {
    if (e.data?.type === 'iframe-ready') {
      iframeReady.current = true;
    }
    if (e.data?.type === 'drag-end' && onDragEnd) {
      onDragEnd(e.data.id, e.data.x, e.data.y);
    }
    if (e.data?.type === 'element-select' && onSelectElement) {
      onSelectElement(e.data.id);
    }
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}, [editable, onDragEnd, onSelectElement]);
```

- [ ] **Step 4: Update callers to pass cssVars**

In `creative-editor-modal.tsx`, update the LivePreview call to pass `cssVars`:
```typescript
<LivePreview
  html={getStyledHtml(templateHtml)}
  width={dims.width}
  height={dims.height}
  fieldValues={values}
  cssVars={cssVars}
  editable
  onDragEnd={handleDragEnd}
  onSelectElement={setSelectedSection}
/>
```

In `app/studio/[id]/creatives/page.tsx`, same change — pass `cssVars` to `LivePreview`.

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "storage-campaigns.test.ts" | grep -v "missing the following properties" | head -10
```

- [ ] **Step 6: Commit**

```bash
git add components/live-preview.tsx components/creative-editor-modal.tsx app/studio/[id]/creatives/page.tsx
git commit -m "feat: live preview with snap guides and zero-flicker updates"
```

---

## Task 4: Undo/Redo System

**Files:**
- Modify: `components/creative-editor-modal.tsx`

- [ ] **Step 1: Add undo/redo state and helpers**

After the existing state declarations (around line 40), add:

```typescript
// Undo/Redo
interface EditorSnapshot { cssVars: Record<string, string>; fieldValues: Record<string, string>; }
const [undoStack, setUndoStack] = useState<EditorSnapshot[]>([]);
const [redoStack, setRedoStack] = useState<EditorSnapshot[]>([]);
const lastSnapshotTime = useRef(0);

const pushUndo = useCallback(() => {
  const now = Date.now();
  if (now - lastSnapshotTime.current < 500) return; // Debounce
  lastSnapshotTime.current = now;
  setUndoStack(prev => {
    const next = [...prev, { cssVars: { ...cssVars }, fieldValues: { ...values } }];
    return next.length > 20 ? next.slice(-20) : next;
  });
  setRedoStack([]);
}, [cssVars, values]);

const undo = useCallback(() => {
  setUndoStack(prev => {
    if (prev.length === 0) return prev;
    const snapshot = prev[prev.length - 1];
    setRedoStack(r => [...r, { cssVars: { ...cssVars }, fieldValues: { ...values } }]);
    setCssVars(snapshot.cssVars);
    setValues(snapshot.fieldValues);
    setTextFields(buildTextFields(snapshot.fieldValues));
    return prev.slice(0, -1);
  });
}, [cssVars, values]);

const redo = useCallback(() => {
  setRedoStack(prev => {
    if (prev.length === 0) return prev;
    const snapshot = prev[prev.length - 1];
    setUndoStack(u => [...u, { cssVars: { ...cssVars }, fieldValues: { ...values } }]);
    setCssVars(snapshot.cssVars);
    setValues(snapshot.fieldValues);
    setTextFields(buildTextFields(snapshot.fieldValues));
    return prev.slice(0, -1);
  });
}, [cssVars, values]);
```

Where `buildTextFields` is extracted from the existing `useEffect` that initializes `textFields` — extract the field-building logic into a standalone function that takes `fieldValues` and returns the `textFields` array.

- [ ] **Step 2: Wire pushUndo into change handlers**

Modify `handleCssVarChange`:
```typescript
const handleCssVarChange = (key: string, value: string) => {
  pushUndo();
  setCssVars(prev => ({ ...prev, [key]: value }));
};
```

Modify `updateField`:
```typescript
const updateField = (key: string, value: string) => {
  pushUndo();
  setValues(prev => ({ ...prev, [key]: value }));
  setTextFields(prev => prev.map(f => f.key === key ? { ...f, value } : f));
};
```

Modify `handleDragEnd`:
```typescript
const handleDragEnd = useCallback((elementId: string, xPercent: number, yPercent: number) => {
  pushUndo();
  if (elementId === 'person') {
    setCssVars(prev => ({
      ...prev,
      '--person-position-x': `${Math.round(xPercent)}%`,
      '--person-position-y': `${Math.round(yPercent)}%`,
    }));
  } else {
    setCssVars(prev => ({
      ...prev,
      [`--${elementId}-x`]: `${Math.round(xPercent)}%`,
      [`--${elementId}-y`]: `${Math.round(yPercent)}%`,
    }));
  }
}, [pushUndo]);
```

- [ ] **Step 3: Add keyboard shortcut listener**

Add a useEffect for keyboard shortcuts:
```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [undo, redo]);
```

- [ ] **Step 4: Add undo/redo buttons to toolbar**

In the editor header area (where the title "Creative Editor" and close button are), add undo/redo buttons:

```typescript
<div className="flex items-center gap-2">
  <button onClick={undo} disabled={undoStack.length === 0}
    className="text-[#888] hover:text-white disabled:text-[#333] text-sm px-2 py-1 rounded transition-colors"
    title="Rueckgaengig (Ctrl+Z)">
    ← {undoStack.length > 0 && <span className="text-[10px] text-[#666]">({undoStack.length})</span>}
  </button>
  <button onClick={redo} disabled={redoStack.length === 0}
    className="text-[#888] hover:text-white disabled:text-[#333] text-sm px-2 py-1 rounded transition-colors"
    title="Wiederherstellen (Ctrl+Y)">
    → {redoStack.length > 0 && <span className="text-[10px] text-[#666]">({redoStack.length})</span>}
  </button>
</div>
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "storage-campaigns.test.ts" | grep -v "missing the following properties" | head -10
```

- [ ] **Step 6: Commit**

```bash
git add components/creative-editor-modal.tsx
git commit -m "feat: add undo/redo with 20-step history and Ctrl+Z/Y shortcuts"
```

---

## Task 5: Undo/Redo in Standalone Creatives Page

**Files:**
- Modify: `app/studio/[id]/creatives/page.tsx`

- [ ] **Step 1: Add same undo/redo logic to creatives page**

The standalone creatives page uses the same state structure (`cssVars`, field values like `headline`, `price`, etc.). Add the same `EditorSnapshot` type, `undoStack`/`redoStack` state, `pushUndo`/`undo`/`redo` functions, keyboard listener, and toolbar buttons.

The field values in this page are individual state variables (`headline`, `price`, `originalPrice`, `selectedPerson`, `selectedBg`), not a single `values` Record. Adapt the snapshot to capture these:

```typescript
interface EditorSnapshot {
  cssVars: Record<string, string>;
  headline: string;
  price: string;
  originalPrice: string;
  selectedPerson: string;
  selectedBg: string;
}
```

The `pushUndo`, `undo`, `redo` functions snapshot/restore these individual values.

Add the same keyboard listener and toolbar buttons (undo/redo arrows near the render buttons at the bottom of the left panel).

- [ ] **Step 2: Pass cssVars to LivePreview**

Update the `LivePreview` call in the standalone editor to pass `cssVars`:
```typescript
<LivePreview
  html={getStyledHtml(selectedTemplate.htmlContent)}
  width={dims.width}
  height={dims.height}
  fieldValues={buildFieldValues()}
  cssVars={cssVars}
  editable
  onDragEnd={handleDragEnd}
  onSelectElement={setSelectedSection}
/>
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "storage-campaigns.test.ts" | grep -v "missing the following properties" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add app/studio/[id]/creatives/page.tsx
git commit -m "feat: add undo/redo to standalone creatives editor"
```

---

## Task 6: Integration Test + Template Re-seed

- [ ] **Step 1: Re-seed all templates**

```bash
npx tsx scripts/seed-reference-template.ts
```

- [ ] **Step 2: Full TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "storage-campaigns.test.ts" | grep -v "missing the following properties" | head -10
```

Expected: No errors.

- [ ] **Step 3: Manual testing checklist**

Start dev server and verify:

1. **Headline wrap toggle:** Open editor → select headline → Stil tab → see "Einzeilig/Mehrzeilig" toggle. Set to Einzeilig → long headline stays on one line. Set to Mehrzeilig → wraps at 90% width.

2. **Snap guides:** Drag headline → see red center line at 50%. Drag to align with price block → see blue alignment line.

3. **Zero flicker:** Type in headline text field → preview updates instantly without white flash. Move slider → preview updates smoothly.

4. **Undo/Redo:** Make 3 changes → Ctrl+Z three times → all reverted. Ctrl+Y → re-applied. Toolbar shows count badges.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration test fixes for editor package A"
```

---

## Summary

| Task | What | Files | Est. |
|------|------|-------|------|
| 1 | Template updates (CSS var + data-field) | templates, template-utils | 10 min |
| 2 | Headline wrap toggle | css-var-slider | 5 min |
| 3 | Live preview rewrite (snap + live updates) | live-preview, editor modal, creatives page | 25 min |
| 4 | Undo/Redo in editor modal | creative-editor-modal | 15 min |
| 5 | Undo/Redo in standalone editor | creatives page | 10 min |
| 6 | Integration test | — | 10 min |
