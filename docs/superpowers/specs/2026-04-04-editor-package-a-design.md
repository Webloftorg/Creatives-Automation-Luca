# Editor Package A - Grundlagen-Upgrade Design Spec

## Context

The creative editor works but feels like a prototype. Elements flicker on every change, there are no alignment guides, headline wrapping is uncontrollable, and there's no undo. This package makes the editor solid and professional without changing the underlying iframe architecture.

## Scope

4 features that build on the existing iframe-based editor:
1. Headline single-line / multi-line toggle
2. Snap guides during drag
3. Live updates without iframe rebuild (eliminates flickering)
4. Undo/Redo (last 20 changes)

## Feature 1: Headline Single-line / Multi-line

### New CSS Variable

Add `--headline-wrap: normal;` to all 5 master templates' `:root` blocks.

Apply it in the `.headline` CSS class: `white-space: var(--headline-wrap);`

Current templates have `max-width: 90%; word-break: break-word;` on `.headline`. Keep `word-break: break-word` but replace any remaining hardcoded `white-space` with the variable.

### Auto-Default Logic

In the generate route and editor, when a headline value is set:
- If headline text length <= 15 characters → `--headline-wrap: nowrap` (single-line)
- If headline text length > 15 characters → `--headline-wrap: normal` (multi-line, wraps at max-width)

### Manual Override

In `css-var-slider.tsx`, when `selectedSection === 'headline'`, show a toggle button:
- Label: "Einzeilig / Mehrzeilig"
- Toggling sets `--headline-wrap` to `nowrap` or `normal`
- This is NOT a slider — it's a two-state button in the "Typografie" group

### Files to Modify
- `public/templates/*.html` (all 5) — add `--headline-wrap: normal` to `:root`, use in `.headline`
- `components/css-var-slider.tsx` — add wrap toggle button
- `lib/template-utils.ts` — add `--headline-wrap` to `REQUIRED_CSS_VARS`
- `scripts/seed-reference-template.ts` — re-seed after template changes

## Feature 2: Snap Guides During Drag

### Implementation

All snap guide logic lives inside the `DRAG_SCRIPT` injected into the iframe (in `components/live-preview.tsx`). No React components needed — it's pure DOM manipulation inside the iframe.

### Guide Types

**Canvas Center Guides:**
- Vertical red line at x=50% of `.creative-container`
- Horizontal red line at y=50%
- Appear when dragged element's center is within 2% of canvas center
- Element snaps to exact center when within threshold

**Element Alignment Guides:**
- Blue lines when dragged element aligns with another `[data-draggable]` element
- Check alignment on: top edge, bottom edge, vertical center, left edge, right edge, horizontal center
- Threshold: 2% of canvas dimension
- Snap to aligned position when within threshold

### Visual Style
- Guide lines: 1px solid, red (center) or blue (element alignment)
- Lines span full canvas width/height
- Lines created as temporary `<div>` elements inside `.creative-container`, removed on mouseup
- z-index: 999 (above all content)

### Snap Behavior
- During drag (mousemove): check all guides, show matching ones, snap position
- On mouseup: remove all guide elements, finalize position
- Snap is additive: can snap to both x-center and y-alignment simultaneously

### Files to Modify
- `components/live-preview.tsx` — rewrite DRAG_SCRIPT to include snap guide logic

## Feature 3: Live Updates Without iframe Rebuild

### Current Problem

Every state change (text edit, slider move, image selection) triggers a React re-render which rebuilds `srcdoc` on the iframe. This causes a full page reload inside the iframe — visible as a white flash/flicker.

### New Architecture

**Initialization:** iframe `srcdoc` is built ONCE when:
- Template changes
- Format changes
- Editor first opens

**Live updates via postMessage:** All other changes are sent as messages to the iframe:

```typescript
// CSS variable change (slider, drag position)
iframe.postMessage({ type: 'update-css-var', key: '--headline-size', value: '100px' })

// Text change (headline, price, location)
iframe.postMessage({ type: 'update-text', placeholder: 'headline', value: 'JETZT STARTEN' })

// Image change (person, background)
iframe.postMessage({ type: 'update-image', placeholder: 'backgroundImage', url: 'http://...' })
```

**Inside the iframe:** A listener script (part of DRAG_SCRIPT or separate injected script) handles these messages:

```javascript
window.addEventListener('message', function(e) {
  if (e.data.type === 'update-css-var') {
    document.documentElement.style.setProperty(e.data.key, e.data.value);
  }
  if (e.data.type === 'update-text') {
    // Find elements containing the placeholder text and update innerHTML
    document.querySelectorAll('[data-field="' + e.data.placeholder + '"]').forEach(el => {
      el.textContent = e.data.value;
    });
  }
  if (e.data.type === 'update-image') {
    if (e.data.placeholder === 'backgroundImage') {
      document.querySelector('.background').style.backgroundImage = "url('" + e.data.url + "')";
    } else if (e.data.placeholder === 'personImage') {
      document.querySelector('.person').src = e.data.url;
    }
  }
});
```

### Template Changes Required

Add `data-field` attributes to text elements in all 5 templates so they can be targeted by the update script:

```html
<div class="location" data-draggable="location" data-field="location">{{location}}</div>
<h1 class="headline" data-draggable="headline" data-field="headline">{{headline}}</h1>
<div class="price" data-field="price">{{price}}</div>
<div class="original-price" data-field="originalPrice">Statt {{originalPrice}}</div>
```

Note: The watermark `<span>` elements also use `{{headline}}` — they should get `data-field="headline"` too so they update live.

### React Side Changes

In `LivePreview` component:
- `srcdoc` update only on template/format change (use a separate `useEffect` with limited deps)
- New `useEffect` for field value changes: sends `postMessage` to iframe instead of rebuilding
- New `useEffect` for CSS var changes: sends `postMessage` to iframe
- Keep a ref to know if iframe is initialized (avoid sending messages before srcdoc is loaded)

### Files to Modify
- `components/live-preview.tsx` — split into init-once + live-update architecture
- `public/templates/*.html` (all 5) — add `data-field` attributes to text elements

## Feature 4: Undo/Redo

### State Structure

```typescript
interface EditorState {
  cssVars: Record<string, string>;
  fieldValues: Record<string, string>;
}

interface UndoStack {
  past: EditorState[];     // max 20
  present: EditorState;
  future: EditorState[];
}
```

### Behavior

- Every change (CSS var, text field, drag position, image selection) saves current state to `past` before applying
- `Ctrl+Z`: pop from `past`, push `present` to `future`, set popped as `present`
- `Ctrl+Y`: pop from `future`, push `present` to `past`, set popped as `present`
- New change after undo: clear `future` stack
- `past` capped at 20 entries (oldest dropped when exceeding)
- Debounce: rapid slider changes only save one undo entry per 500ms

### UI

Two buttons in the editor toolbar/header area:
- Undo button (arrow-left icon) — disabled when `past` is empty
- Redo button (arrow-right icon) — disabled when `future` is empty
- Show count badge: "(3)" next to undo if 3 steps available

### Keyboard Shortcuts

Register `Ctrl+Z` and `Ctrl+Y` (or `Ctrl+Shift+Z`) as global keyboard handlers in the editor modal/page.

### Files to Modify
- `components/creative-editor-modal.tsx` — add undo stack state, keyboard listener, toolbar buttons
- `app/studio/[id]/creatives/page.tsx` — same undo logic for standalone editor

## Files Summary

### Templates (all 5 in public/templates/)
- Add `--headline-wrap: normal` to `:root`
- Use `white-space: var(--headline-wrap)` in `.headline`
- Add `data-field` attributes to text elements

### Components
- `components/live-preview.tsx` — Major rewrite: snap guides in drag script + live update architecture
- `components/css-var-slider.tsx` — Add headline wrap toggle button
- `components/creative-editor-modal.tsx` — Add undo/redo state + keyboard shortcuts + toolbar
- `app/studio/[id]/creatives/page.tsx` — Same undo/redo for standalone editor

### Utilities
- `lib/template-utils.ts` — Add `--headline-wrap` to REQUIRED_CSS_VARS
- `scripts/seed-reference-template.ts` — Re-seed after template changes

## Success Criteria

1. Headline "MONATLICH KUENDBAR" (19 chars) → auto multi-line. "DEAL" (4 chars) → auto single-line. User can toggle.
2. Dragging headline shows red center line when at 50%. Shows blue line when aligned with price block.
3. Typing in headline text field → preview updates instantly with zero flicker.
4. Moving slider → preview updates in real-time with zero flicker.
5. Ctrl+Z undoes last change. Ctrl+Y redoes. 20 steps of history.
6. All of the above works in both campaign editor modal AND standalone creatives page.
