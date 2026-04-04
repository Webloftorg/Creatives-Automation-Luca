# Editor Package B - Canvas-Level Editing Design Spec

## Context

Package A made the editor solid (snap guides, zero-flicker, undo/redo, headline wrap). Package B makes it Canva-like with direct canvas interaction.

## Scope

4 features:
1. Quick-Edit text bar under preview
2. Automatic stack detection (elements auto-space when overlapping)
3. Zoom controls
4. Keyboard nudging (arrow keys)

## Feature 1: Quick-Edit Text Bar

### Trigger
When user clicks a text element in the preview (headline, price, location, originalPrice), a text editing bar appears directly below the preview.

### UI
- Slim bar, same width as the scaled preview
- Dark background (`bg-[#1a1a1a]`), subtle border top in accent color
- Contains: text input (full width), pre-filled with current value
- Auto-focuses on appear
- Element label shown as small tag (e.g., "Headline", "Preis")

### Behavior
- Every keystroke updates the preview live via postMessage (already implemented in Package A)
- Enter key: closes bar, keeps changes
- Escape key: closes bar, reverts to value before opening
- Click outside bar: closes bar, keeps changes
- Clicking a different element: switches to that element's text

### Implementation
- Lives in `LivePreview` component or a new `QuickEditBar` component rendered below the preview
- Uses the `onSelectElement` callback to know which element is selected
- Needs to map element IDs to field names: `headline` → `headline`, `price-block` → `price`, `location` → `location`
- Calls a new `onFieldChange` prop to update the field value
- Person element has no text → bar doesn't appear

### Files
- Create: `components/quick-edit-bar.tsx`
- Modify: `components/live-preview.tsx` — export the bar or render it below iframe
- Modify: `components/creative-editor-modal.tsx` — render QuickEditBar, wire onFieldChange
- Modify: `app/studio/[id]/creatives/page.tsx` — same

## Feature 2: Automatic Stack Detection

### Trigger
On mouseup (after drag), check if the dropped element vertically overlaps or is too close (<3% gap) to another text element.

### Behavior
- Only applies to text elements (headline, price-block, location) — not person
- If two elements overlap or gap < 3%: push the lower element down to create exactly 3% gap
- If the pushed element then overlaps a third element: push that one too (cascade)
- Only adjusts Y position, never X
- Updates CSS variables and sends postMessage

### Implementation
All logic in the IFRAME_SCRIPT mouseup handler. After the existing position calculation:
1. Get all `[data-draggable]` elements except person
2. Sort by their Y position (top to bottom)
3. Walk through sorted list, check gaps
4. If gap < 3%: adjust lower element's `--{id}-y` to create 3% gap
5. Apply via `root.style.setProperty`
6. Send adjusted positions via `parent.postMessage`

### Files
- Modify: `components/live-preview.tsx` — add stack detection to IFRAME_SCRIPT mouseup

## Feature 3: Zoom Controls

### UI
Three buttons rendered below the preview (inside LivePreview component or alongside it):
- `−` button: decrease zoom
- Percentage display (e.g., "75%")
- `+` button: increase zoom
- `Fit` button: reset to fit container

### Behavior
- Zoom range: 25% to 150%
- Step: 10% per click
- Ctrl+Scroll on preview: zoom in/out by 10%
- Default: auto-fit (current behavior, `Math.min(1, maxDisplayWidth / width)`)
- Zoom affects the `transform: scale()` on the iframe
- Zoom state managed in the component that renders LivePreview (editor modal / creatives page)

### Implementation
- `LivePreview` gets a new optional prop `scale?: number` that overrides the auto-calculated scale
- Parent component manages zoom state and passes it down
- Zoom buttons rendered by parent, not inside LivePreview

### Files
- Modify: `components/live-preview.tsx` — accept optional `scale` prop override
- Modify: `components/creative-editor-modal.tsx` — add zoom state, buttons, scroll handler
- Modify: `app/studio/[id]/creatives/page.tsx` — same

## Feature 4: Keyboard Nudging

### Trigger
When an element is selected (`selectedSection` is not null), arrow keys move it.

### Behavior
- Arrow keys: move selected element by 1% in that direction
- Shift+Arrow: move by 0.1% (fine-tuning)
- Updates the corresponding CSS variable:
  - `headline` → `--headline-x` / `--headline-y`
  - `price-block` → `--price-block-x` / `--price-block-y`
  - `location` → `--location-x` / `--location-y`
  - `person` → `--person-position-x` / `--person-position-y`
- Sends update via postMessage for live preview
- Each nudge is an undoable action (pushUndo)

### Implementation
- Keyboard listener in the editor component (modal / creatives page)
- Checks `selectedSection` to know which element to move
- Maps element ID to CSS variable names
- Clamps values within POSITION_BOUNDS (reuse clamp logic from template-utils or inline)

### Files
- Modify: `components/creative-editor-modal.tsx` — add arrow key handler
- Modify: `app/studio/[id]/creatives/page.tsx` — same

## Files Summary

### New Files
- `components/quick-edit-bar.tsx` — text editing bar component

### Modified Files
- `components/live-preview.tsx` — accept scale prop, stack detection in IFRAME_SCRIPT
- `components/creative-editor-modal.tsx` — QuickEditBar, zoom state, keyboard nudging
- `app/studio/[id]/creatives/page.tsx` — same three features

## Success Criteria

1. Click headline in preview → text bar appears below with "MONATLICH KUENDBAR" → type new text → preview updates live → Enter closes bar
2. Drag headline on top of price → on release, headline pushes up to create 3% gap
3. Click zoom + button → preview gets bigger. Click − → smaller. Ctrl+Scroll works.
4. Select headline → press right arrow → headline moves 1% right. Shift+right → 0.1% right.
5. All features work in both campaign editor modal AND standalone creatives page.
