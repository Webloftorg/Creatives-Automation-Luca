# Reference Upload + KI Campaign Director - Design Spec

## Context & Problem

The campaign system now has 5 professional master templates and parametric CSS variation. But the user still has to manually choose a template, set colors, and configure positions. The next step: the user uploads a reference creative (a screenshot of a professional ad they like), and an AI "Campaign Director" analyzes it to auto-configure everything.

## Design Decision

**Add a "Step 0" to the campaign wizard where the user can optionally upload a reference creative. A specialized Claude Vision prompt (the "Campaign Director") analyzes the image and produces a complete campaign strategy.**

## Workflow

### Step 0: Referenz (optional, NEW)

- User sees: "Hast du ein Referenz-Creative?" with upload dropzone
- User uploads an image (PNG/JPG) of a professional ad they want to match
- System sends the image to Claude Vision (Sonnet 4 with vision)
- The "Campaign Director" prompt analyzes:
  - Layout style (which of the 5 master templates matches best)
  - Color palette (primary, secondary, accent extracted from the image)
  - Element positions (headline position, price position, person position)
  - Typography style (size ratios, weight)
  - Visual mood / brand feel (text description)
  - Suggested image generation prompts for persons and backgrounds
- Output: **CampaignStrategy** object (JSON + text briefing)
- User sees the strategy in a review panel and can edit any field
- "Uebernehmen" button applies the strategy to Step 1 (pre-fills everything)
- User can skip Step 0 entirely and go directly to Step 1 (manual mode)

### Step 1-3: Existing flow (pre-filled from strategy)

- Template picker: pre-selected based on strategy
- Brand colors: pre-filled from strategy
- Headlines: user still enters manually (but strategy may suggest a tone/style)
- CSS parameter overrides: pre-set from strategy
- Person/background image prompts: pre-filled from strategy analysis

## CampaignStrategy Type

```typescript
interface CampaignStrategy {
  // Template selection
  templateId: string;             // 'dark-center' | 'split-bold' | 'minimal-light' | 'full-impact' | 'editorial'
  templateReason: string;         // Why this template was chosen

  // Colors extracted from reference
  primaryColor: string;           // Hex
  accentColor: string;            // Hex (always bright/eye-catching)
  secondaryColor: string;         // Hex

  // CSS variable overrides to match reference layout
  cssOverrides: Record<string, string>;  // e.g. { '--headline-y': '25%', '--price-size': '140px' }

  // Creative direction (text briefing)
  mood: string;                   // e.g. "Premium, urban, energetisch"
  headlineStyle: string;          // e.g. "Kurz und knackig, 1-2 Woerter, Urgency-fokussiert"
  personStyle: string;            // e.g. "Athletic, confident, dark clothing, studio portrait"
  backgroundStyle: string;        // e.g. "Dark gym interior with warm accent lighting"

  // Image generation prompts (pre-filled from analysis)
  personPrompt: string;           // For Imagen API
  backgroundPrompt: string;       // For Imagen API
}
```

## API Route

### POST /api/analyze-reference

**Input:** multipart form data with:
- `image`: The reference creative file (PNG/JPG)
- `studioId`: Current studio ID (for context)

**Process:**
1. Read image as base64
2. Load studio data for context (name, location)
3. Send to Claude Sonnet 4 with vision:
   - System prompt: "Campaign Director" specialized prompt
   - User message: image (base64) + studio context
4. Parse structured JSON response
5. Validate templateId is one of the 5 known templates
6. Validate colors are valid hex
7. Clamp CSS overrides via `clampCssVariation()`
8. Return CampaignStrategy

**Campaign Director System Prompt:**

The prompt instructs Claude to act as an elite advertising campaign director who:
- Analyzes the reference image's layout, colors, typography, and mood
- Maps it to one of 5 known template styles (with descriptions of each)
- Extracts exact color values visible in the image
- Determines element positions as CSS variable percentages
- Writes creative direction for image generation
- Outputs structured JSON

## UI Components

### ReferenceUpload component

- Drag & drop zone for image upload
- Shows uploaded image preview
- "Analysieren" button triggers API call
- Loading state while Claude analyzes
- After analysis: shows CampaignStrategy in editable form

### StrategyReview component

- Shows the strategy in organized sections:
  - Template selection (name + reason, dropdown to change)
  - Color palette (3 color pickers, pre-filled)
  - Layout overrides (key CSS vars shown as readable labels)
  - Creative direction (mood, headline style, person style - editable textareas)
  - Image prompts (person prompt, background prompt - editable)
- "Uebernehmen und weiter" button → applies to Step 1 state
- "Nochmal analysieren" button → re-run with same image
- "Ueberspringen" → go to Step 1 without strategy

## Campaign Setup Changes

### New Step 0

The StepIndicator grows from 3 to 4 steps: Referenz → Basis → Personen → Hintergruende

Step 0 is skippable. If skipped, the wizard goes to Step 1 as before.

If strategy is applied:
- `baseTemplateId` is set from `strategy.templateId`
- `primaryColor`, `accentColor`, `secondaryColor` are set from strategy
- `brandStyle` is set from `strategy.mood`
- `personPrompt` is set from `strategy.personPrompt`
- `bgPrompt` is set from `strategy.backgroundPrompt`
- A new state `cssStrategyOverrides: Record<string, string>` stores the CSS overrides
- These overrides are passed to the generate route and applied to the template

### Generate Route Changes

The generate route receives `cssStrategyOverrides` as part of the campaign config. These are applied to the template HTML BEFORE the AI-generated parameter variations. So the flow becomes:

1. Load template HTML
2. Apply strategy CSS overrides (from reference analysis)
3. Generate additional parameter variations on top
4. Build variant matrix

## Files to Create

| File | Purpose |
|------|---------|
| `app/api/analyze-reference/route.ts` | Claude Vision API call with Campaign Director prompt |
| `components/reference-upload.tsx` | Drag & drop upload + analyze button |
| `components/strategy-review.tsx` | Editable strategy display |

## Files to Modify

| File | Change |
|------|--------|
| `components/campaign-setup.tsx` | Add Step 0, grow StepIndicator to 4 steps |
| `lib/types.ts` | Add CampaignStrategy type, add `cssStrategyOverrides` to Campaign |
| `app/api/campaigns/[id]/generate/route.ts` | Apply strategy overrides before parameter variation |
| `app/studio/[id]/campaigns/page.tsx` | Pass strategy data through to generate |

## Success Criteria

1. User uploads a GYMPOD reference → system selects "Dark Center" template with orange accent + correct positions
2. User uploads a JONNY M. reference → system selects "Minimal Light" template with clean styling
3. Strategy is shown in editable UI, user can tweak before applying
4. Generated variants match the reference's look & feel (same ballpark, not pixel-perfect)
5. Skipping Step 0 works exactly as before (no regression)
6. Full flow from upload to generated variants in under 2 minutes
