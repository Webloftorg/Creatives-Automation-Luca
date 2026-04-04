# Editor Package B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Canvas-level editing: quick-edit text bar, automatic element stacking, zoom controls, and keyboard nudging.

**Architecture:** Quick-edit bar is a new component rendered below the preview. Stack detection runs in the iframe's mouseup handler. Zoom is a scale prop override on LivePreview managed by parent. Nudging extends the existing keyboard listener. All builds on Package A's live-update postMessage architecture.

**Tech Stack:** React, TypeScript, iframe postMessage API, CSS Variables

---

## File Structure

### New Files
- `components/quick-edit-bar.tsx` — inline text editing bar below preview

### Modified Files
- `components/live-preview.tsx` — accept `scale` prop, add stack detection to IFRAME_SCRIPT
- `components/creative-editor-modal.tsx` — integrate QuickEditBar, zoom state, keyboard nudging
- `app/studio/[id]/creatives/page.tsx` — same three features

---

## Task 1: Quick-Edit Bar Component

**Files:**
- Create: `components/quick-edit-bar.tsx`

- [ ] **Step 1: Create the QuickEditBar component**

Write `components/quick-edit-bar.tsx`:

```typescript
// components/quick-edit-bar.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

const ELEMENT_LABELS: Record<string, string> = {
  headline: 'Headline',
  'price-block': 'Preis',
  location: 'Standort',
};

const ELEMENT_TO_FIELD: Record<string, string> = {
  headline: 'headline',
  'price-block': 'price',
  location: 'location',
};

interface QuickEditBarProps {
  selectedElement: string | null;
  fieldValues: Record<string, string>;
  onFieldChange: (field: string, value: string) => void;
  width: number;
}

export function QuickEditBar({ selectedElement, fieldValues, onFieldChange, width }: QuickEditBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldName = selectedElement ? ELEMENT_TO_FIELD[selectedElement] : null;
  const [originalValue, setOriginalValue] = useState('');

  useEffect(() => {
    if (fieldName && fieldValues[fieldName]) {
      setOriginalValue(fieldValues[fieldName]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [selectedElement]);

  if (!selectedElement || !fieldName || !(fieldName in fieldValues)) return null;

  const label = ELEMENT_LABELS[selectedElement] || selectedElement;
  const value = fieldValues[fieldName] || '';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRef.current?.blur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onFieldChange(fieldName, originalValue);
      inputRef.current?.blur();
    }
  };

  return (
    <div
      className="bg-[#1a1a1a] border-t-2 border-[#FF4500] rounded-b-lg flex items-center gap-2 px-3 py-2"
      style={{ width }}
    >
      <span className="text-[#FF4500] text-[10px] uppercase tracking-wider font-bold whitespace-nowrap">{label}</span>
      <input
        ref={inputRef}
        value={value}
        onChange={e => onFieldChange(fieldName, e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 bg-transparent border-none text-white text-sm font-semibold outline-none"
        spellCheck={false}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/quick-edit-bar.tsx
git commit -m "feat: create QuickEditBar component for inline text editing"
```

---

## Task 2: Integrate QuickEditBar into Editors

**Files:**
- Modify: `components/creative-editor-modal.tsx`
- Modify: `app/studio/[id]/creatives/page.tsx`

- [ ] **Step 1: Add QuickEditBar to creative-editor-modal.tsx**

Add import at top:
```typescript
import { QuickEditBar } from '@/components/quick-edit-bar';
```

Find the Center preview panel (where `<LivePreview` is rendered). Currently it's inside a `<div className="flex-1 flex items-center justify-center bg-[#0a0a0a] p-6">`. Wrap the LivePreview and add QuickEditBar below it:

Replace the center panel content with:
```typescript
{/* Center: Preview */}
<div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0a] p-6">
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
  <QuickEditBar
    selectedElement={selectedSection}
    fieldValues={values}
    onFieldChange={(field, value) => { pushUndo(); updateField(field, value); }}
    width={Math.min(400, dims.width) * Math.min(1, 400 / dims.width)}
  />
</div>
```

Note: the width calculation matches LivePreview's internal scale: `Math.min(400, dims.width)` when width > 400, or `dims.width` when smaller.

- [ ] **Step 2: Add QuickEditBar to standalone creatives page**

Add import at top of `app/studio/[id]/creatives/page.tsx`:
```typescript
import { QuickEditBar } from '@/components/quick-edit-bar';
```

Find the center preview panel. Wrap similarly — add QuickEditBar below LivePreview. The standalone page uses individual state vars, so the `onFieldChange` handler needs to map field names:

```typescript
<QuickEditBar
  selectedElement={selectedSection}
  fieldValues={buildFieldValues()}
  onFieldChange={(field, value) => {
    pushUndo();
    if (field === 'headline') setHeadline(value);
    else if (field === 'price') setPrice(value);
    else if (field === 'originalPrice') setOriginalPrice(value);
    else if (field === 'location') {/* location comes from studio, skip */}
  }}
  width={Math.min(400, dims.width) * Math.min(1, 400 / dims.width)}
/>
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "storage-campaigns.test.ts" | grep -v "missing the following properties" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add components/creative-editor-modal.tsx app/studio/[id]/creatives/page.tsx
git commit -m "feat: integrate QuickEditBar into both editors"
```

---

## Task 3: Stack Detection in IFRAME_SCRIPT

**Files:**
- Modify: `components/live-preview.tsx`

- [ ] **Step 1: Add stack detection function to IFRAME_SCRIPT**

In `components/live-preview.tsx`, find the IFRAME_SCRIPT string. Add the stack detection function AFTER the `clearGuides` function and BEFORE the drag handling section:

```javascript
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
    var changed = [];
    for (var j = 0; j < textElements.length - 1; j++) {
      var current = textElements[j];
      var next = textElements[j + 1];
      var gap = next.top - current.bottom;
      if (gap < minGap) {
        var newTop = current.bottom + minGap;
        next.top = newTop;
        next.bottom = newTop + next.height;
        var root = document.documentElement;
        var varName = '--' + next.id + '-y';
        root.style.setProperty(varName, newTop.toFixed(1) + '%');
        changed.push({ id: next.id, y: newTop });
      }
    }

    for (var k = 0; k < changed.length; k++) {
      parent.postMessage({ type: 'drag-end', id: changed[k].id, x: -999, y: changed[k].y }, '*');
    }
  }
```

Note: The `x: -999` sentinel value means "don't change X". The parent handler needs to check for this.

- [ ] **Step 2: Call autoStackElements in mouseup handler**

Find the mouseup handler. After the existing `parent.postMessage({ type: 'drag-end', ...})` call and BEFORE the inline style cleanup, add:

```javascript
    // Auto-stack: fix overlapping text elements
    if (id !== 'person') {
      autoStackElements(id);
    }
```

- [ ] **Step 3: Handle the x=-999 sentinel in parent**

In `components/creative-editor-modal.tsx`, find the `handleDragEnd` function. Wrap the X-position update to skip when x is -999:

Change from:
```typescript
setCssVars(prev => ({
  ...prev,
  [`--${elementId}-x`]: `${Math.round(xPercent)}%`,
  [`--${elementId}-y`]: `${Math.round(yPercent)}%`,
}));
```

To:
```typescript
setCssVars(prev => {
  const updates: Record<string, string> = { ...prev, [`--${elementId}-y`]: `${Math.round(yPercent)}%` };
  if (xPercent !== -999) {
    updates[`--${elementId}-x`] = `${Math.round(xPercent)}%`;
  }
  return updates;
});
```

Do the same in `app/studio/[id]/creatives/page.tsx` handleDragEnd.

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "storage-campaigns.test.ts" | grep -v "missing the following properties" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add components/live-preview.tsx components/creative-editor-modal.tsx app/studio/[id]/creatives/page.tsx
git commit -m "feat: add automatic stack detection for overlapping elements"
```

---

## Task 4: Zoom Controls

**Files:**
- Modify: `components/live-preview.tsx`
- Modify: `components/creative-editor-modal.tsx`
- Modify: `app/studio/[id]/creatives/page.tsx`

- [ ] **Step 1: Accept scale prop in LivePreview**

In `components/live-preview.tsx`, add `scale` prop to `LivePreviewProps`:

```typescript
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
```

Update the component signature to destructure `scale: scaleProp`:
```typescript
export function LivePreview({ html, width, height, fieldValues, cssVars, scale: scaleProp, editable = false, onDragEnd, onSelectElement }: LivePreviewProps)
```

Update the scale calculation to use the prop when provided:
```typescript
const maxDisplayWidth = 400;
const autoScale = Math.min(1, maxDisplayWidth / width);
const scale = scaleProp ?? autoScale;
```

- [ ] **Step 2: Add zoom state and controls to creative-editor-modal.tsx**

Add zoom state after existing state declarations:
```typescript
const [zoom, setZoom] = useState<number | null>(null); // null = auto-fit
```

Add zoom handler functions:
```typescript
const zoomIn = () => setZoom(prev => Math.min((prev ?? Math.min(1, 400 / dims.width)) + 0.1, 1.5));
const zoomOut = () => setZoom(prev => Math.max((prev ?? Math.min(1, 400 / dims.width)) - 0.1, 0.25));
const zoomReset = () => setZoom(null);
const zoomPercent = Math.round((zoom ?? Math.min(1, 400 / dims.width)) * 100);
```

Pass `scale={zoom ?? undefined}` to LivePreview:
```typescript
<LivePreview
  ...
  scale={zoom ?? undefined}
  ...
/>
```

Add zoom controls below QuickEditBar (or between preview and QuickEditBar):
```typescript
<div className="flex items-center gap-2 mt-2">
  <button onClick={zoomOut} className="text-[#888] hover:text-white text-sm px-2 py-1 bg-[#222] rounded transition-colors">−</button>
  <span className="text-[#666] text-xs w-10 text-center">{zoomPercent}%</span>
  <button onClick={zoomIn} className="text-[#888] hover:text-white text-sm px-2 py-1 bg-[#222] rounded transition-colors">+</button>
  <button onClick={zoomReset} className="text-[#666] hover:text-white text-xs px-2 py-1 rounded transition-colors">Fit</button>
</div>
```

Add Ctrl+Scroll handler on the preview container:
```typescript
const handleWheel = (e: React.WheelEvent) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  }
};
```

Add `onWheel={handleWheel}` to the center preview div.

- [ ] **Step 3: Add same zoom to standalone creatives page**

Repeat the same pattern in `app/studio/[id]/creatives/page.tsx`:
- Add `zoom` state
- Add `zoomIn`, `zoomOut`, `zoomReset`, `zoomPercent`
- Pass `scale={zoom ?? undefined}` to LivePreview
- Add zoom control buttons below the preview
- Add wheel handler on the preview container

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "storage-campaigns.test.ts" | grep -v "missing the following properties" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add components/live-preview.tsx components/creative-editor-modal.tsx app/studio/[id]/creatives/page.tsx
git commit -m "feat: add zoom controls with Ctrl+Scroll support"
```

---

## Task 5: Keyboard Nudging

**Files:**
- Modify: `components/creative-editor-modal.tsx`
- Modify: `app/studio/[id]/creatives/page.tsx`

- [ ] **Step 1: Add nudge handler to creative-editor-modal.tsx**

Find the existing keyboard listener (the useEffect with Ctrl+Z/Y). Extend the handler to also handle arrow keys:

```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    // Undo/Redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
    }

    // Keyboard nudging
    if (!selectedSection) return;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    // Don't nudge if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    e.preventDefault();

    const step = e.shiftKey ? 0.1 : 1;
    const xVar = selectedSection === 'person' ? '--person-position-x' : `--${selectedSection}-x`;
    const yVar = selectedSection === 'person' ? '--person-position-y' : `--${selectedSection}-y`;

    pushUndo();
    setCssVars(prev => {
      const updates = { ...prev };
      if (e.key === 'ArrowLeft') {
        updates[xVar] = `${parseFloat(prev[xVar] || '50') - step}%`;
      } else if (e.key === 'ArrowRight') {
        updates[xVar] = `${parseFloat(prev[xVar] || '50') + step}%`;
      } else if (e.key === 'ArrowUp') {
        updates[yVar] = `${parseFloat(prev[yVar] || '50') - step}%`;
      } else if (e.key === 'ArrowDown') {
        updates[yVar] = `${parseFloat(prev[yVar] || '50') + step}%`;
      }
      return updates;
    });
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [undo, redo, selectedSection, pushUndo, cssVars]);
```

Note: Added `selectedSection`, `pushUndo`, and `cssVars` to the dependency array.

- [ ] **Step 2: Add same nudge handler to standalone creatives page**

In `app/studio/[id]/creatives/page.tsx`, find the keyboard listener useEffect and extend it with the same arrow key handling. The setCssVars call is identical since the standalone page also uses `setCssVars`.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "storage-campaigns.test.ts" | grep -v "missing the following properties" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add components/creative-editor-modal.tsx app/studio/[id]/creatives/page.tsx
git commit -m "feat: add keyboard nudging with arrow keys (1% step, Shift=0.1%)"
```

---

## Task 6: Integration Test

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "storage-campaigns.test.ts" | grep -v "missing the following properties" | head -10
```

Expected: No errors.

- [ ] **Step 2: Manual testing checklist**

Start dev server and verify in both editors (campaign modal + standalone):

1. **Quick-Edit Bar:** Click headline in preview → bar appears below with text → type new text → preview updates live → Enter closes bar → Escape reverts
2. **Stack Detection:** Drag headline directly on top of price → on release, elements auto-separate with gap
3. **Zoom:** Click + button → preview gets larger. Click − → smaller. Click Fit → resets. Ctrl+Scroll works on preview area.
4. **Keyboard Nudging:** Click headline → press Right arrow → headline moves 1% right. Shift+Right → 0.1% right. Works for all elements including person.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for editor package B"
```

---

## Summary

| Task | What | Files | Est. |
|------|------|-------|------|
| 1 | QuickEditBar component | quick-edit-bar.tsx (new) | 5 min |
| 2 | Integrate QuickEditBar | editor modal, creatives page | 10 min |
| 3 | Stack detection | live-preview.tsx, both editors | 15 min |
| 4 | Zoom controls | live-preview.tsx, both editors | 10 min |
| 5 | Keyboard nudging | both editors | 10 min |
| 6 | Integration test | — | 10 min |
