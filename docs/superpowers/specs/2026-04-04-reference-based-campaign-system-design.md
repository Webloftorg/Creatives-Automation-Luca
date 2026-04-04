# Reference-Based Campaign System - Design Spec

## Context & Problem

The current campaign system tries to have AI (Claude Sonnet) generate complete HTML/CSS templates from scratch. This produces consistently unusable results: elements outside the canvas, broken proportions, no visual hierarchy, unprofessional quality. Meanwhile, the existing hand-crafted reference template works well.

The client manages **hundreds of fitness studios** with diverse styles. They need to produce professional advertising creatives at scale. Current manual process: ~1 hour per creative. Target: **5-10 minutes for 5 creatives** (80-90% quality base that gets quickly perfected).

Additionally, person image background removal is broken because `sharp` has a DLL loading issue on Windows, which `@imgly/background-removal-node` depends on.

## Design Decision

**Kill the AI HTML generator. Replace with reference-based parametric system.**

- 5 hand-crafted Master Templates covering major fitness ad styles
- AI only generates JSON with CSS variable overrides (never HTML)
- User starts by choosing a template style (or uploading a reference for style-matching)
- Headlines are entered manually by the user (they know their business better than AI)
- Optional: AI can suggest headlines, but never auto-fills
- Creatives with or without person images (person is optional)
- Batch generation via matrix: Headlines × Persons × Backgrounds × Parameter-Variations

## Campaign Workflow

### Step 1: Style & Brand

- User picks a Master Template from the library (visual previews)
- OR uploads a reference creative → system matches to closest Master Template + extracts color parameters
- User sets brand colors (manual or via website URL auto-analysis)
- User enters studio name and location

### Step 2: Content

- **Headlines**: User types 1-5 headlines manually into text inputs (add/remove fields). Optional "KI Vorschlaege" button generates suggestions that populate empty fields - user can accept, edit, or delete them.
- **Price & Original Price**: Manual entry
- **Person Images**: Optional. Select from existing assets, upload new ones, or generate via AI (with proper background removal). Multiple persons supported.
- **Background Images**: Select, upload, or generate via AI.
- **Formats**: Select target formats (Instagram Post, Story, Facebook, etc.)

### Step 3: Generate & Review

- System generates variants as matrix: Headlines × Persons × Backgrounds
- For each variant, AI generates 1-3 CSS parameter variations (position/size tweaks) as JSON
- User sees all variants in a grid
- User can: approve/reject, open in editor for quick adjustments, request "more like this" variations
- Render approved variants → Download as ZIP

## 5 Master Templates

All templates share the same CSS variable system and placeholder structure. They differ in layout, visual style, and element positioning.

### Shared Structure

Every template MUST have:
- All standard CSS variables in `:root` (positions, sizes, effects)
- All standard placeholders: `{{headline}}`, `{{price}}`, `{{originalPrice}}`, `{{location}}`, `{{personImage}}`, `{{backgroundImage}}`, `{{primaryColor}}`, `{{accentColor}}`, `{{width}}`, `{{height}}`
- `data-draggable` attributes on headline, price-block, location, person
- `class="creative-container"` on root element
- Montserrat font (Google Fonts)

### Template 1: Dark Center (GYMPOD Style)

- Dark background with blur overlay
- Person centered or slightly right, large scale
- Headline upper-center area
- Price large and centered with neon glow in accent color
- Strikethrough price below
- Footer bar in primary color with location
- Watermark text pattern in background (diagonal, semi-transparent)

### Template 2: Split Bold (wellfit Style)

- Person positioned to one side (left or right via CSS var)
- Text block on the opposite side
- Large headline with high contrast
- Price in colored accent box/highlight
- Footer bar with location + CTA
- Watermark text in background
- Dark overlay gradient heavier on text side

### Template 3: Minimal Light (JONNY M. Style)

- Light/white background (low blur, high brightness)
- Person to one side with clean edges
- Large headline in dark/black text
- Price massive, clean, minimal decoration
- Studio name + subtitle at bottom
- Watermark pattern subtle and light
- Clean, editorial feel

### Template 4: Full Impact (Vorverkauf Style)

- Background in primary brand color (not image-based blur)
- Person prominent, centered, large scale
- Headline VERY large at top
- Price MASSIVE below headline
- Urgency text space (optional field)
- No watermark (solid color bg doesn't need it)
- Maximum attention-grabbing layout

### Template 5: Editorial (Magazine Style)

- Person image as near-fullscreen background (minimal blur, higher brightness)
- Gradient overlay from bottom for text readability
- Headline overlaid on image, top portion
- Price as floating badge/accent element
- Location subtle at top or bottom
- Premium, editorial magazine feel
- Watermark optional, very subtle

## AI Role: Parameter Variation Only

When generating campaign variants, the AI receives:
- The selected Master Template's CSS variable list with current values
- The brand context (colors, style, studio name)
- Instructions to generate diverse parameter variations

The AI outputs ONLY a JSON array of CSS override objects:

```json
[
  {
    "--headline-y": "38%",
    "--price-block-y": "68%",
    "--person-position-x": "-8%",
    "--person-scale": "0.9",
    "--watermark-opacity": "0.05"
  },
  {
    "--headline-y": "22%",
    "--price-block-y": "75%",
    "--person-position-x": "12%",
    "--person-scale": "0.78",
    "--headline-size": "100px"
  }
]
```

The system applies each override set to the Master Template HTML, producing visually diverse variants that are ALL guaranteed to be professional (same tested HTML structure).

## Person Image Background Removal

### Root Cause

`@imgly/background-removal-node` depends on `sharp`. The `sharp` native DLL (`@img/sharp-win32-x64`) fails to load on the current Windows environment with `ERR_DLOPEN_FAILED`. This breaks both the primary bg removal AND the sharp-based fallback.

### Fix

1. Resolve the sharp DLL issue (rebuild native modules, or pin a working sharp version)
2. Once sharp loads, `@imgly/background-removal-node` should work as designed
3. Keep the sharp white-background fallback as secondary safety net
4. Generate person images with prompts optimized for clean background removal ("studio portrait, solid background, clean edges")

### Optional Enhancement

Add remove.bg API as a cloud fallback (configurable via env var `REMOVEBG_API_KEY`). When set, use it as primary; when unset, use local @imgly.

## What Gets Removed

- **`__ai_generate__` option** in campaign setup → replaced by template selection from library
- **`generateLayoutHtml()` function** in generate route → replaced by CSS parameter generation
- **AI-generated HTML normalization** (`normalizeLayoutHtml` still useful for user-created templates via the template editor, but not needed for master templates)

## What Stays

- Template-based batch generation (the working path)
- Creative editor modal with drag & CSS variable editing
- Render pipeline (Puppeteer-based)
- Brand analysis from website URL
- Campaign review grid with approve/reject
- "More like this" regeneration (now generates CSS param variations instead of new HTML)
- Download as ZIP

## Files to Modify

| File | Change |
|------|--------|
| `public/templates/` | Add 4 new master template HTML files |
| `scripts/seed-reference-template.ts` | Seed all 5 templates |
| `data/templates/` | 5 template JSON files after seeding |
| `components/campaign-setup.tsx` | Replace template dropdown + `__ai_generate__` with visual template picker; headlines manual input |
| `app/api/campaigns/[id]/generate/route.ts` | Remove `generateLayoutHtml`, add CSS parameter generation via AI |
| `lib/prompts.ts` | Replace `template-generation` prompt with `parameter-variation` prompt |
| `app/api/campaigns/[id]/regenerate/route.ts` | Generate CSS param variations instead of new HTML |
| `package.json` / `node_modules` | Fix sharp native module |

## Success Criteria

1. Campaign with 3 headlines × 2 persons × 1 background = 6 variants generated in < 30 seconds
2. All variants look professional (no elements outside canvas, proper hierarchy)
3. Price is always the most prominent element with visible neon glow
4. Person images have transparent backgrounds (no white rectangles)
5. User can drag elements and positions persist correctly
6. Full workflow from template selection to rendered ZIP in under 10 minutes

## Future Path

When AI improves at generating HTML/CSS (better models, fine-tuning, etc.):
- The `template-generation` prompt and `generateLayoutHtml` can be reintroduced
- AI-generated templates go through a QA preview step before batch generation
- New master templates can be AI-generated, reviewed, and added to the library
- The parametric system remains as the reliable production path
