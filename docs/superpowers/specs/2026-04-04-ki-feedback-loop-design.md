# KI Feedback Loop - Design Spec

## Context

The campaign system generates creatives that are good but not perfect. The client (fitness studio marketing expert) knows exactly what works and what doesn't. Currently there's no way to feed this knowledge back into the system. Each campaign starts from zero.

## Design Decision

**Add a rating + comment system on each creative variant. Feedback is stored per studio and live-injected into AI prompts for future generations.**

## Feedback Capture

### UI: Rating on Variant Cards

On each variant card in the campaign review grid, add two small buttons:
- Thumbs up (green) — marks creative as "good"
- Thumbs down (red) — marks creative as "bad"
- Both are toggleable (click again to remove rating)
- Optional: clicking thumbs down opens a small text input for a comment

### Data Structure

```typescript
interface CreativeFeedback {
  id: string;
  studioId: string;
  campaignId: string;
  variantId: string;
  rating: 'good' | 'bad';
  comment?: string;
  // Snapshot of what was rated (for learning)
  cssVars: Record<string, string>;
  fieldValues: Record<string, string>;
  templateId: string;
  timestamp: string;
}
```

### Storage

- New file per studio: `data/feedback/{studioId}.json`
- Array of `CreativeFeedback` entries
- New storage methods: `saveFeedback(feedback)`, `listFeedback(studioId)`
- Keep last 100 entries per studio (oldest pruned)

## Feedback Processing (Live)

### When generating a new campaign:

1. Load all feedback for the studio: `storage.listFeedback(studioId)`
2. Build a feedback summary:
   - Count good vs bad ratings
   - Extract patterns from CSS vars of good-rated creatives (avg headline-size, price-size, person-scale, bg-brightness, overlay-opacity)
   - Collect all comments from bad-rated creatives
3. Format as a concise text block
4. Append to the parameter-variation prompt as additional context
5. Append to the campaign director prompt as additional context

### Feedback Summary Format

```
KUNDENFEEDBACK (basierend auf {n} bewerteten Creatives):
POSITIV ({good_count}x): {patterns from good creatives}
NEGATIV ({bad_count}x): {patterns from bad creatives + comments}
Passe deine Variationen entsprechend an!
```

Example:
```
KUNDENFEEDBACK (basierend auf 12 bewerteten Creatives):
POSITIV (8x): Grosse Preise (avg 130px), Person prominent (scale avg 0.9), wenig Overlay (avg 0.4)
NEGATIV (4x): "zu viel Filter", "Person zu klein", Overlay zu stark (avg 0.8), Headline zu klein (avg 70px)
Passe deine Variationen entsprechend an!
```

### Where feedback is injected:

1. **Parameter-variation prompt** — appended as last section when generating CSS variations
2. **Campaign director prompt** — appended when analyzing reference creatives
3. **Image generation prompts** — if feedback mentions image quality issues, append to Imagen prompts

## API Routes

### POST /api/feedback

Save a feedback entry.

Input: `{ studioId, campaignId, variantId, rating, comment?, cssVars, fieldValues, templateId }`
Output: `{ success: true }`

### GET /api/feedback/{studioId}

Get all feedback for a studio.

Output: `CreativeFeedback[]`

### GET /api/feedback/{studioId}/summary

Get a formatted feedback summary string ready to inject into prompts.

Output: `{ summary: string, goodCount: number, badCount: number }`

## UI Changes

### Variant Card

Add thumbs up/down buttons to the existing button bar on each variant card (next to edit, regenerate, approve buttons).

### Campaign Review Grid

Optional: Show a summary banner at the top when feedback exists: "8 von 12 Creatives positiv bewertet. Feedback wird fuer zukuenftige Kampagnen verwendet."

## Files to Create

| File | Purpose |
|------|---------|
| `app/api/feedback/route.ts` | POST feedback |
| `app/api/feedback/[studioId]/route.ts` | GET feedback list |
| `app/api/feedback/[studioId]/summary/route.ts` | GET feedback summary |

## Files to Modify

| File | Change |
|------|--------|
| `lib/types.ts` | Add CreativeFeedback interface |
| `lib/storage.ts` | Add saveFeedback, listFeedback methods |
| `components/variant-card.tsx` | Add thumbs up/down buttons |
| `app/studio/[id]/campaigns/page.tsx` | Wire feedback save calls |
| `app/api/campaigns/[id]/generate/route.ts` | Load + inject feedback summary |
| `app/api/analyze-reference/route.ts` | Load + inject feedback summary |

## Success Criteria

1. User clicks thumbs up on a creative → feedback saved to storage
2. User clicks thumbs down → comment input appears → feedback + comment saved
3. Next campaign generation: feedback summary appears in AI prompt context
4. Over time: creatives improve because AI learns studio preferences
5. Each studio has independent feedback (Studio A's feedback doesn't affect Studio B)
