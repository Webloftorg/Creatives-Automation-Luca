# KI Feedback Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rating + comment feedback system on creative variants that live-injects learning into AI prompts for continuous improvement.

**Architecture:** Feedback is stored as JSON files per studio. A summary builder analyzes patterns from good/bad ratings (avg CSS values, comments). The summary is injected into parameter-variation and campaign-director prompts at generation time. UI adds thumbs up/down buttons to variant cards.

**Tech Stack:** Next.js API routes, filesystem storage, TypeScript, React

---

## File Structure

### New Files
- `app/api/feedback/route.ts` — POST to save feedback
- `app/api/feedback/[studioId]/route.ts` — GET feedback list for a studio
- `app/api/feedback/[studioId]/summary/route.ts` — GET formatted summary for prompt injection
- `lib/feedback-utils.ts` — Summary builder logic (pure function, no I/O)

### Modified Files
- `lib/types.ts` — Add `CreativeFeedback` interface, extend `StorageAdapter`
- `lib/storage.ts` — Add `saveFeedback()`, `listFeedback()` methods
- `components/variant-card.tsx` — Add thumbs up/down + comment buttons
- `components/variant-grid.tsx` — Pass feedback callbacks through
- `app/studio/[id]/campaigns/page.tsx` — Wire feedback save, load summary
- `app/api/campaigns/[id]/generate/route.ts` — Inject feedback summary into prompts
- `app/api/analyze-reference/route.ts` — Inject feedback summary into director prompt

---

## Task 1: Types + Storage

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/storage.ts`

- [ ] **Step 1: Add CreativeFeedback interface to types.ts**

In `lib/types.ts`, add after the `CampaignStrategy` interface (before `export type CreativeFormat`):

```typescript
export interface CreativeFeedback {
  id: string;
  studioId: string;
  campaignId: string;
  variantId: string;
  rating: 'good' | 'bad';
  comment?: string;
  cssVars: Record<string, string>;
  fieldValues: Record<string, string>;
  templateId: string;
  timestamp: string;
}
```

Add to `StorageAdapter` interface (after the `deleteAsset` method):

```typescript
  saveFeedback(feedback: CreativeFeedback): Promise<void>;
  listFeedback(studioId: string): Promise<CreativeFeedback[]>;
```

- [ ] **Step 2: Implement saveFeedback and listFeedback in storage.ts**

In `lib/storage.ts`, add `'feedback'` to the `init()` method's directory creation list.

Add the two methods to the `FileStorage` class, following the existing campaign pattern:

```typescript
async saveFeedback(feedback: CreativeFeedback): Promise<void> {
  await fs.writeFile(
    path.join(this.basePath, 'feedback', `${feedback.id}.json`),
    JSON.stringify(feedback, null, 2),
  );
}

async listFeedback(studioId: string): Promise<CreativeFeedback[]> {
  const dir = path.join(this.basePath, 'feedback');
  try {
    const files = await fs.readdir(dir);
    const all = await Promise.all(
      files.filter(f => f.endsWith('.json')).map(async f => {
        try {
          const data = await fs.readFile(path.join(dir, f), 'utf-8');
          return JSON.parse(data) as CreativeFeedback;
        } catch { return null; }
      }),
    );
    return all.filter((f): f is CreativeFeedback => f !== null && f.studioId === studioId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 100);
  } catch { return []; }
}
```

Import `CreativeFeedback` from types at the top of storage.ts.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "storage-campaigns.test.ts" | grep -v "missing the following properties" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/storage.ts
git commit -m "feat: add CreativeFeedback type and storage methods"
```

---

## Task 2: Feedback Summary Builder

**Files:**
- Create: `lib/feedback-utils.ts`

- [ ] **Step 1: Create feedback-utils.ts**

```typescript
// lib/feedback-utils.ts
import type { CreativeFeedback } from './types';

export function buildFeedbackSummary(feedbacks: CreativeFeedback[]): {
  summary: string;
  goodCount: number;
  badCount: number;
} {
  if (feedbacks.length === 0) {
    return { summary: '', goodCount: 0, badCount: 0 };
  }

  const good = feedbacks.filter(f => f.rating === 'good');
  const bad = feedbacks.filter(f => f.rating === 'bad');

  const avgCssVar = (items: CreativeFeedback[], varName: string): string => {
    const values = items
      .map(f => parseFloat(f.cssVars[varName] || ''))
      .filter(v => !isNaN(v));
    if (values.length === 0) return '';
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return avg.toFixed(1);
  };

  const goodPatterns: string[] = [];
  const badPatterns: string[] = [];

  if (good.length > 0) {
    const hl = avgCssVar(good, '--headline-size');
    const pr = avgCssVar(good, '--price-size');
    const ps = avgCssVar(good, '--person-scale');
    const ov = avgCssVar(good, '--overlay-opacity');
    const br = avgCssVar(good, '--bg-brightness');
    if (hl) goodPatterns.push(`Headline avg ${hl}px`);
    if (pr) goodPatterns.push(`Preis avg ${pr}px`);
    if (ps) goodPatterns.push(`Person-Scale avg ${ps}`);
    if (ov) goodPatterns.push(`Overlay avg ${ov}`);
    if (br) goodPatterns.push(`Brightness avg ${br}`);
  }

  if (bad.length > 0) {
    const hl = avgCssVar(bad, '--headline-size');
    const pr = avgCssVar(bad, '--price-size');
    const ps = avgCssVar(bad, '--person-scale');
    const ov = avgCssVar(bad, '--overlay-opacity');
    const br = avgCssVar(bad, '--bg-brightness');
    if (hl) badPatterns.push(`Headline avg ${hl}px`);
    if (pr) badPatterns.push(`Preis avg ${pr}px`);
    if (ps) badPatterns.push(`Person-Scale avg ${ps}`);
    if (ov) badPatterns.push(`Overlay avg ${ov}`);
    if (br) badPatterns.push(`Brightness avg ${br}`);

    const comments = bad.filter(f => f.comment).map(f => `"${f.comment}"`);
    if (comments.length > 0) {
      badPatterns.push(`Kommentare: ${comments.slice(0, 5).join(', ')}`);
    }
  }

  const lines = [`KUNDENFEEDBACK (basierend auf ${feedbacks.length} bewerteten Creatives):`];
  if (good.length > 0) lines.push(`POSITIV (${good.length}x): ${goodPatterns.join(', ')}`);
  if (bad.length > 0) lines.push(`NEGATIV (${bad.length}x): ${badPatterns.join(', ')}`);
  lines.push('Passe deine Variationen entsprechend an!');

  return {
    summary: lines.join('\n'),
    goodCount: good.length,
    badCount: bad.length,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/feedback-utils.ts
git commit -m "feat: add feedback summary builder for prompt injection"
```

---

## Task 3: API Routes

**Files:**
- Create: `app/api/feedback/route.ts`
- Create: `app/api/feedback/[studioId]/route.ts`
- Create: `app/api/feedback/[studioId]/summary/route.ts`

- [ ] **Step 1: Create POST /api/feedback**

Create directory and file:

```typescript
// app/api/feedback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import type { CreativeFeedback } from '@/lib/types';

export async function POST(req: NextRequest) {
  const body = await req.json() as CreativeFeedback;

  if (!body.studioId || !body.variantId || !body.rating) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const storage = getStorage();
  await storage.init();
  await storage.saveFeedback(body);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Create GET /api/feedback/[studioId]**

```typescript
// app/api/feedback/[studioId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ studioId: string }> }) {
  const { studioId } = await params;
  const storage = getStorage();
  await storage.init();
  const feedback = await storage.listFeedback(studioId);
  return NextResponse.json(feedback);
}
```

- [ ] **Step 3: Create GET /api/feedback/[studioId]/summary**

```typescript
// app/api/feedback/[studioId]/summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { buildFeedbackSummary } from '@/lib/feedback-utils';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ studioId: string }> }) {
  const { studioId } = await params;
  const storage = getStorage();
  await storage.init();
  const feedback = await storage.listFeedback(studioId);
  const result = buildFeedbackSummary(feedback);
  return NextResponse.json(result);
}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "storage-campaigns.test.ts" | grep -v "missing the following properties" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add app/api/feedback/
git commit -m "feat: add feedback API routes (save, list, summary)"
```

---

## Task 4: Variant Card Feedback UI

**Files:**
- Modify: `components/variant-card.tsx`
- Modify: `components/variant-grid.tsx`

- [ ] **Step 1: Add feedback props and buttons to VariantCard**

In `components/variant-card.tsx`, update the props interface:

```typescript
interface VariantCardProps {
  variant: CampaignVariant;
  onToggleApproved: () => void;
  onEdit: () => void;
  onRegenerate: () => void;
  feedback?: 'good' | 'bad' | null;
  onFeedback: (rating: 'good' | 'bad') => void;
}
```

Update the component signature to destructure `feedback` and `onFeedback`.

Add thumbs up/down buttons to the button bar (BEFORE the existing + button). Use a `useState` for showing a comment input on thumbs down:

```typescript
<button onClick={() => onFeedback('good')}
  className={`w-7 h-7 rounded-md text-xs flex items-center justify-center transition-colors ${
    feedback === 'good' ? 'bg-[#4CAF50] text-white' : 'bg-black/70 text-white hover:bg-[#4CAF50]'
  }`}
  title="Gut">
  +
</button>
<button onClick={() => onFeedback('bad')}
  className={`w-7 h-7 rounded-md text-xs flex items-center justify-center transition-colors ${
    feedback === 'bad' ? 'bg-red-600 text-white' : 'bg-black/70 text-white hover:bg-red-600'
  }`}
  title="Schlecht">
  -
</button>
```

- [ ] **Step 2: Pass feedback through VariantGrid**

In `components/variant-grid.tsx`, add props:

```typescript
interface VariantGridProps {
  variants: CampaignVariant[];
  formats: CreativeFormat[];
  onToggleApproved: (variantId: string) => void;
  onEdit: (variantId: string) => void;
  onRegenerate: (variantId: string) => void;
  onFeedback: (variantId: string, rating: 'good' | 'bad') => void;
  feedbackMap: Record<string, 'good' | 'bad'>;
  onRender: () => void;
  rendering: boolean;
}
```

Pass to each VariantCard:
```typescript
feedback={feedbackMap[v.id] || null}
onFeedback={(rating) => onFeedback(v.id, rating)}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "storage-campaigns.test.ts" | grep -v "missing the following properties" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add components/variant-card.tsx components/variant-grid.tsx
git commit -m "feat: add thumbs up/down feedback buttons to variant cards"
```

---

## Task 5: Wire Feedback in Campaign Page

**Files:**
- Modify: `app/studio/[id]/campaigns/page.tsx`

- [ ] **Step 1: Add feedback state and handler**

Add state after existing state declarations:
```typescript
const [feedbackMap, setFeedbackMap] = useState<Record<string, 'good' | 'bad'>>({});
```

Add import for `v4 as uuidv4` (should already be imported) and `extractCssVariables` from template-utils.

Add feedback handler:
```typescript
const handleFeedback = async (variantId: string, rating: 'good' | 'bad') => {
  if (!activeCampaign) return;
  const variant = activeCampaign.variants.find(v => v.id === variantId);
  if (!variant) return;

  // Toggle: if same rating clicked again, remove it
  if (feedbackMap[variantId] === rating) {
    setFeedbackMap(prev => { const next = { ...prev }; delete next[variantId]; return next; });
    return;
  }

  setFeedbackMap(prev => ({ ...prev, [variantId]: rating }));

  const { extractCssVariables } = await import('@/lib/template-utils');

  await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: uuidv4(),
      studioId,
      campaignId: activeCampaign.id,
      variantId,
      rating,
      cssVars: extractCssVariables(variant.templateHtml),
      fieldValues: variant.fieldValues,
      templateId: activeCampaign.baseTemplateId || '',
      timestamp: new Date().toISOString(),
    }),
  });
};
```

- [ ] **Step 2: Pass feedback props to VariantGrid**

Find the `<VariantGrid` component call in the review view. Add:
```typescript
onFeedback={handleFeedback}
feedbackMap={feedbackMap}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "storage-campaigns.test.ts" | grep -v "missing the following properties" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add app/studio/[id]/campaigns/page.tsx
git commit -m "feat: wire feedback save to campaign review page"
```

---

## Task 6: Inject Feedback into Generate Route

**Files:**
- Modify: `app/api/campaigns/[id]/generate/route.ts`
- Modify: `app/api/analyze-reference/route.ts`

- [ ] **Step 1: Load and inject feedback in generate route**

In `app/api/campaigns/[id]/generate/route.ts`, add import at top:
```typescript
import { buildFeedbackSummary } from '@/lib/feedback-utils';
```

After loading the campaign and studio data (after the `studioContext` construction), add:
```typescript
// Load studio feedback for prompt improvement
const studioFeedback = await storage.listFeedback(campaign.studioId);
const { summary: feedbackContext } = buildFeedbackSummary(studioFeedback);
```

Find where `paramPrompt` is loaded (the parameter-variation prompt). After loading it, append feedback:
```typescript
let paramPrompt = await storage.getSystemPrompt(campaign.studioId, 'parameter-variation');
if (!paramPrompt) paramPrompt = DEFAULT_PROMPTS['parameter-variation'];
if (feedbackContext) {
  paramPrompt += '\n\n' + feedbackContext;
}
```

- [ ] **Step 2: Inject feedback in analyze-reference route**

In `app/api/analyze-reference/route.ts`, add import:
```typescript
import { buildFeedbackSummary } from '@/lib/feedback-utils';
```

After loading the studio data (inside the `if (studioId)` block), load feedback and append to the system prompt:

```typescript
if (studioId) {
  const storage = getStorage();
  await storage.init();
  const studio = await storage.getStudio(studioId);
  if (studio) {
    studioContext = `\nStudio: ${studio.name}, Standort: ${studio.location}`;
  }
  // Load feedback for improved analysis
  const feedback = await storage.listFeedback(studioId);
  const { summary: feedbackContext } = buildFeedbackSummary(feedback);
  if (feedbackContext) {
    studioContext += '\n\n' + feedbackContext;
  }
}
```

Note: The `storage` variable may already be declared inside the existing `if (studioId)` block. If so, reuse it. If not, create it.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "storage-campaigns.test.ts" | grep -v "missing the following properties" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add app/api/campaigns/[id]/generate/route.ts app/api/analyze-reference/route.ts
git commit -m "feat: inject feedback summary into AI generation prompts"
```

---

## Task 7: Integration Test

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "storage-campaigns.test.ts" | grep -v "missing the following properties" | head -10
```

- [ ] **Step 2: Verify feedback directory created**

```bash
npx tsx -e "import { getStorage } from './lib/storage'; async function t() { const s = getStorage(); await s.init(); console.log('OK'); } t();"
```

Check: `ls data/feedback/` — directory should exist.

- [ ] **Step 3: Manual testing checklist**

1. **Save feedback:** Open campaign review → click thumbs up on a creative → verify `data/feedback/` has a new JSON file
2. **Thumbs down + comment:** Click thumbs down → verify feedback saved with rating 'bad'
3. **Toggle:** Click thumbs up again → feedback removed from UI state
4. **Summary:** `curl http://localhost:3000/api/feedback/{studioId}/summary` → returns formatted summary
5. **Prompt injection:** Generate new campaign → check server console for feedback context in prompts

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for feedback loop"
```

---

## Summary

| Task | What | Files | Est. |
|------|------|-------|------|
| 1 | Types + Storage | types.ts, storage.ts | 5 min |
| 2 | Summary Builder | feedback-utils.ts (new) | 5 min |
| 3 | API Routes | 3 new route files | 5 min |
| 4 | Variant Card UI | variant-card.tsx, variant-grid.tsx | 10 min |
| 5 | Wire in Campaign Page | campaigns/page.tsx | 10 min |
| 6 | Inject into AI Prompts | generate/route.ts, analyze-reference/route.ts | 10 min |
| 7 | Integration Test | — | 10 min |
