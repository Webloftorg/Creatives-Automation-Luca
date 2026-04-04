# Reference Upload + KI Campaign Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional Step 0 to the campaign wizard where users upload a reference creative, Claude Vision analyzes it as a "Campaign Director", and the result pre-fills the entire campaign configuration.

**Architecture:** New API route `/api/analyze-reference` sends uploaded image to Claude Sonnet 4 Vision with a Campaign Director system prompt. Returns a `CampaignStrategy` JSON object containing template choice, colors, CSS overrides, and creative direction text. Two new UI components (`ReferenceUpload`, `StrategyReview`) display and let the user edit the strategy before applying it to Steps 1-3.

**Tech Stack:** Next.js 15, TypeScript, Anthropic Claude API (Sonnet 4 with vision), existing template system

---

## File Structure

### New Files
- `app/api/analyze-reference/route.ts` — Claude Vision endpoint with Campaign Director prompt
- `components/reference-upload.tsx` — Drag & drop image upload + analyze trigger
- `components/strategy-review.tsx` — Editable strategy review panel

### Modified Files
- `lib/types.ts` — Add `CampaignStrategy` interface, add `cssStrategyOverrides` to Campaign
- `components/campaign-setup.tsx` — Add Step 0, grow wizard to 4 steps, wire strategy into state
- `app/api/campaigns/[id]/generate/route.ts` — Apply strategy CSS overrides before param variations

---

## Task 1: Add CampaignStrategy Type

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add CampaignStrategy interface and cssStrategyOverrides to Campaign**

In `lib/types.ts`, add the `CampaignStrategy` interface after the `Campaign` interface, and add `cssStrategyOverrides?: Record<string, string>` to the Campaign interface.

Add after the Campaign interface (after line ~98):

```typescript
export interface CampaignStrategy {
  templateId: string;
  templateReason: string;
  primaryColor: string;
  accentColor: string;
  secondaryColor: string;
  cssOverrides: Record<string, string>;
  mood: string;
  headlineStyle: string;
  personStyle: string;
  backgroundStyle: string;
  personPrompt: string;
  backgroundPrompt: string;
}
```

In the Campaign interface, add `cssStrategyOverrides?: Record<string, string>;` after the `brandColors` field.

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | grep "types.ts" | head -5
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add CampaignStrategy type and cssStrategyOverrides to Campaign"
```

---

## Task 2: Create Analyze Reference API Route

**Files:**
- Create: `app/api/analyze-reference/route.ts`

- [ ] **Step 1: Create the API route**

Create `app/api/analyze-reference/route.ts`:

```typescript
// app/api/analyze-reference/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStorage } from '@/lib/storage';
import { clampCssVariation } from '@/lib/template-utils';
import type { CampaignStrategy } from '@/lib/types';

const anthropic = new Anthropic();

const VALID_TEMPLATES = ['dark-center', 'split-bold', 'minimal-light', 'full-impact', 'editorial'];

const CAMPAIGN_DIRECTOR_PROMPT = `Du bist ein Elite-Kampagnendirektor fuer Fitness-Werbeanzeigen. Du analysierst ein Referenz-Creative und erstellst eine komplette Kampagnenstrategie.

Du bekommst ein Bild einer professionellen Fitness-Werbeanzeige. Analysiere es und gib eine Kampagnenstrategie als JSON zurueck.

VERFUEGBARE TEMPLATES (waehle das passendste):
1. "dark-center" - Dunkler Hintergrund, Person zentral, Neon-Preis, GYMPOD-Stil
2. "split-bold" - Person links, Text rechts, farbiger Akzent, wellfit-Stil
3. "minimal-light" - Heller Hintergrund, clean, minimalistisch, JONNY M.-Stil
4. "full-impact" - Farbiger Brand-Hintergrund, maximale Aufmerksamkeit, Vorverkauf-Stil
5. "editorial" - Person als Hintergrund, Magazin-Stil, Premium-Look

CSS-VARIABLEN die du setzen kannst (alle Positionen in Prozent, Groessen in px):
- --headline-x, --headline-y: Position der Headline (Standard: 50%, 52%)
- --price-block-x, --price-block-y: Position des Preises (Standard: 50%, 70%)
- --location-x, --location-y: Position des Standorts (Standard: 50%, 4%)
- --person-position-x, --person-position-y: Person-Offset (Standard: 0%, 5%)
- --headline-size: Headline-Groesse (60-140px, Standard: 90px)
- --price-size: Preis-Groesse (80-200px, Standard: 120px, IMMER groesser als Headline!)
- --person-scale: Person-Skalierung (0.5-1.1, Standard: 0.85)
- --watermark-opacity: Watermark-Transparenz (0.0-0.1)
- --bg-blur: Hintergrund-Unschaerfe (0-10px)
- --bg-brightness: Hintergrund-Helligkeit (0.1-1.0)

ANALYSE-AUFGABEN:
1. Erkenne den Layout-Stil und waehle das passendste Template
2. Extrahiere die dominanten Farben (Primary=Hauptfarbe, Accent=hellste/auffaelligste Farbe fuer Preise)
3. Schaetze die Positionen der Elemente als CSS-Variablen-Prozente
4. Beschreibe die kreative Stimmung und den Stil
5. Schreibe Bildgenerierungs-Prompts fuer aehnliche Personen und Hintergruende

WICHTIG: accentColor MUSS immer hell und auffaellig sein (fuer den Neon-Glow-Preis).

Antworte NUR als JSON-Objekt mit dieser Struktur:
{
  "templateId": "dark-center",
  "templateReason": "Warum dieses Template passt",
  "primaryColor": "#hex",
  "accentColor": "#hex",
  "secondaryColor": "#hex",
  "cssOverrides": { "--headline-y": "35%", "--price-size": "140px" },
  "mood": "Stimmungsbeschreibung",
  "headlineStyle": "Headline-Stil Beschreibung",
  "personStyle": "Person-Stil Beschreibung",
  "backgroundStyle": "Hintergrund-Stil Beschreibung",
  "personPrompt": "Englischer Prompt fuer Imagen Personenbild",
  "backgroundPrompt": "Englischer Prompt fuer Imagen Hintergrundbild"
}

KEIN Markdown, KEINE Erklaerungen. NUR das JSON-Objekt.`;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const imageFile = formData.get('image') as File | null;
  const studioId = formData.get('studioId') as string | null;

  if (!imageFile) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }

  try {
    // Read image as base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mediaType = imageFile.type === 'image/png' ? 'image/png' : 'image/jpeg';

    // Load studio context if available
    let studioContext = '';
    if (studioId) {
      const storage = getStorage();
      await storage.init();
      const studio = await storage.getStudio(studioId);
      if (studio) {
        studioContext = `\nStudio: ${studio.name}, Standort: ${studio.location}`;
      }
    }

    // Call Claude Vision
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: CAMPAIGN_DIRECTOR_PROMPT,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `Analysiere dieses Referenz-Creative und erstelle eine Kampagnenstrategie.${studioContext}`,
          },
        ],
      }],
    });

    let text = message.content[0].type === 'text' ? message.content[0].text : '{}';
    text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    let strategy: CampaignStrategy;
    try {
      strategy = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        strategy = JSON.parse(match[0]);
      } else {
        return NextResponse.json({ error: 'Failed to parse strategy' }, { status: 500 });
      }
    }

    // Validate templateId
    if (!VALID_TEMPLATES.includes(strategy.templateId)) {
      strategy.templateId = 'dark-center';
    }

    // Validate colors (basic hex check)
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    if (!hexPattern.test(strategy.primaryColor)) strategy.primaryColor = '#FF4500';
    if (!hexPattern.test(strategy.accentColor)) strategy.accentColor = '#FF6B00';
    if (!hexPattern.test(strategy.secondaryColor)) strategy.secondaryColor = '#1a1a1a';

    // Clamp CSS overrides to safe ranges
    if (strategy.cssOverrides) {
      strategy.cssOverrides = clampCssVariation(strategy.cssOverrides);
    } else {
      strategy.cssOverrides = {};
    }

    return NextResponse.json(strategy);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Analysis failed';
    console.error('Reference analysis error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit 2>&1 | grep "analyze-reference" | head -5
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/api/analyze-reference/route.ts
git commit -m "feat: add analyze-reference API with Campaign Director prompt"
```

---

## Task 3: Create ReferenceUpload Component

**Files:**
- Create: `components/reference-upload.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/reference-upload.tsx
'use client';

import { useState, useRef } from 'react';

interface ReferenceUploadProps {
  onAnalyzed: (strategy: Record<string, unknown>) => void;
  onSkip: () => void;
  studioId: string;
}

export function ReferenceUpload({ onAnalyzed, onSkip, studioId }: ReferenceUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('studioId', studioId);
      const res = await fetch('/api/analyze-reference', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Analysis failed');
      const strategy = await res.json();
      onAnalyzed(strategy);
    } catch (err) {
      console.error('Reference analysis failed:', err);
      alert('Analyse fehlgeschlagen. Bitte versuche es erneut oder ueberspringe diesen Schritt.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white font-bold text-lg mb-1">Referenz-Creative</h2>
        <p className="text-[#888] text-sm">
          Lade ein Referenz-Creative hoch das dir gefaellt. Die KI analysiert den Stil und konfiguriert deine Kampagne automatisch.
        </p>
      </div>

      {!preview ? (
        <div
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-[#FF4500] bg-[#FF4500]/10' : 'border-[#333] hover:border-[#555]'
          }`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div className="text-[#666] text-4xl mb-3">+</div>
          <p className="text-[#888] text-sm">Bild hierher ziehen oder klicken zum Auswaehlen</p>
          <p className="text-[#555] text-xs mt-1">PNG oder JPG</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative bg-[#0a0a0a] rounded-xl overflow-hidden">
            <img src={preview} alt="Referenz" className="w-full max-h-80 object-contain" />
            <button
              onClick={() => { setPreview(null); setFile(null); }}
              className="absolute top-2 right-2 w-8 h-8 bg-black/70 rounded-full text-white text-sm flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              x
            </button>
          </div>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="w-full bg-[#FF4500] hover:bg-[#e63e00] disabled:opacity-50 text-white font-bold py-3 rounded-lg text-sm transition-colors"
          >
            {analyzing ? 'KI analysiert Referenz...' : 'Stil analysieren'}
          </button>
        </div>
      )}

      <button
        onClick={onSkip}
        disabled={analyzing}
        className="w-full bg-[#222] border border-[#333] hover:bg-[#333] text-[#ccc] font-semibold py-3 rounded-lg text-sm transition-colors"
      >
        Ohne Referenz fortfahren
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/reference-upload.tsx
git commit -m "feat: add ReferenceUpload component with drag & drop"
```

---

## Task 4: Create StrategyReview Component

**Files:**
- Create: `components/strategy-review.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/strategy-review.tsx
'use client';

import { useState } from 'react';
import type { CampaignStrategy } from '@/lib/types';

const TEMPLATE_NAMES: Record<string, string> = {
  'dark-center': 'Dark Center (GYMPOD)',
  'split-bold': 'Split Bold (wellfit)',
  'minimal-light': 'Minimal Light (JONNY M.)',
  'full-impact': 'Full Impact (Vorverkauf)',
  'editorial': 'Editorial (Magazin)',
};

interface StrategyReviewProps {
  strategy: CampaignStrategy;
  onChange: (updated: CampaignStrategy) => void;
  onApply: () => void;
  onReanalyze: () => void;
  onSkip: () => void;
  analyzing: boolean;
}

export function StrategyReview({ strategy, onChange, onApply, onReanalyze, onSkip, analyzing }: StrategyReviewProps) {
  const update = (partial: Partial<CampaignStrategy>) => {
    onChange({ ...strategy, ...partial });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white font-bold text-lg mb-1">Kampagnenstrategie</h2>
        <p className="text-[#888] text-sm">Die KI hat dein Referenz-Creative analysiert. Passe die Strategie an und uebernimm sie.</p>
      </div>

      {/* Template Selection */}
      <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4 space-y-3">
        <div>
          <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Template</label>
          <select
            value={strategy.templateId}
            onChange={e => update({ templateId: e.target.value })}
            className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm outline-none"
          >
            {Object.entries(TEMPLATE_NAMES).map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
          <p className="text-[#555] text-xs mt-1 italic">{strategy.templateReason}</p>
        </div>

        {/* Colors */}
        <div>
          <label className="text-[#888] text-xs uppercase tracking-wider mb-2 block">Farben</label>
          <div className="flex gap-3">
            {([
              ['primaryColor', 'Primaer'] as const,
              ['secondaryColor', 'Sekundaer'] as const,
              ['accentColor', 'Akzent'] as const,
            ]).map(([key, label]) => (
              <div key={key} className="flex-1">
                <label className="text-[#666] text-[10px] uppercase">{label}</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={strategy[key]}
                    onChange={e => update({ [key]: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border border-[#333] bg-transparent" />
                  <input value={strategy[key]}
                    onChange={e => update({ [key]: e.target.value })}
                    className="flex-1 bg-[#111] border border-[#333] rounded px-2 py-1.5 text-white text-xs outline-none font-mono" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex mt-2 rounded-lg overflow-hidden h-3">
            <div className="flex-1" style={{ backgroundColor: strategy.primaryColor }} />
            <div className="flex-1" style={{ backgroundColor: strategy.secondaryColor }} />
            <div className="flex-1" style={{ backgroundColor: strategy.accentColor }} />
          </div>
        </div>
      </div>

      {/* Creative Direction */}
      <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4 space-y-3">
        <label className="text-[#888] text-xs uppercase tracking-wider block">Kreative Richtung</label>
        {([
          ['mood', 'Stimmung'] as const,
          ['headlineStyle', 'Headline-Stil'] as const,
          ['personStyle', 'Personen-Stil'] as const,
          ['backgroundStyle', 'Hintergrund-Stil'] as const,
        ]).map(([key, label]) => (
          <div key={key}>
            <label className="text-[#666] text-xs mb-1 block">{label}</label>
            <input
              value={strategy[key]}
              onChange={e => update({ [key]: e.target.value })}
              className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-white text-sm outline-none"
            />
          </div>
        ))}
      </div>

      {/* Image Prompts */}
      <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4 space-y-3">
        <label className="text-[#888] text-xs uppercase tracking-wider block">Bild-Prompts (fuer KI-Generierung)</label>
        <div>
          <label className="text-[#666] text-xs mb-1 block">Personen-Prompt</label>
          <textarea
            value={strategy.personPrompt}
            onChange={e => update({ personPrompt: e.target.value })}
            className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-white text-sm outline-none resize-none h-16"
          />
        </div>
        <div>
          <label className="text-[#666] text-xs mb-1 block">Hintergrund-Prompt</label>
          <textarea
            value={strategy.backgroundPrompt}
            onChange={e => update({ backgroundPrompt: e.target.value })}
            className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-white text-sm outline-none resize-none h-16"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button onClick={onApply}
          className="w-full bg-[#FF4500] hover:bg-[#e63e00] text-white font-bold py-3 rounded-lg text-sm transition-colors">
          Strategie uebernehmen und weiter
        </button>
        <div className="flex gap-2">
          <button onClick={onReanalyze} disabled={analyzing}
            className="flex-1 bg-[#222] border border-[#333] hover:bg-[#333] disabled:opacity-50 text-[#ccc] font-semibold py-2.5 rounded-lg text-xs transition-colors">
            {analyzing ? 'Analysiere...' : 'Nochmal analysieren'}
          </button>
          <button onClick={onSkip}
            className="flex-1 bg-[#222] border border-[#333] hover:bg-[#333] text-[#ccc] font-semibold py-2.5 rounded-lg text-xs transition-colors">
            Ueberspringen
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/strategy-review.tsx
git commit -m "feat: add StrategyReview component for editable campaign strategy"
```

---

## Task 5: Integrate Step 0 into Campaign Setup

**Files:**
- Modify: `components/campaign-setup.tsx`

- [ ] **Step 1: Add imports, state, and Step 0 logic**

Add imports at top of file:
```typescript
import { ReferenceUpload } from '@/components/reference-upload';
import { StrategyReview } from '@/components/strategy-review';
import type { CampaignStrategy } from '@/lib/types';
```

Add new state variables after the existing state declarations (after `brandAnalyzed` state, around line 59):
```typescript
  // Step 0: Reference
  const [strategy, setStrategy] = useState<CampaignStrategy | null>(null);
  const [referenceAnalyzing, setReferenceAnalyzing] = useState(false);
```

Change `step` initial value from `1` to `0`:
```typescript
  const [step, setStep] = useState(0);
```

- [ ] **Step 2: Update StepIndicator for 4 steps**

Change the StepIndicator to map over `[0, 1, 2, 3]` instead of `[1, 2, 3]`, and update the step label:

```typescript
  const StepIndicator = () => (
    <div className="flex items-center gap-2 mb-6">
      {[0, 1, 2, 3].map(s => (
        <div key={s} className="flex items-center gap-2">
          <button
            onClick={() => s < step && setStep(s)}
            className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all ${
              s === step ? 'bg-[#FF4500] text-white scale-110'
              : s < step ? 'bg-[#4CAF50] text-white cursor-pointer'
              : 'bg-[#222] text-[#666]'
            }`}>
            {s < step ? '✓' : s}
          </button>
          {s < 3 && <div className={`w-8 h-0.5 ${s < step ? 'bg-[#4CAF50]' : 'bg-[#333]'}`} />}
        </div>
      ))}
      <span className="text-[#666] text-xs ml-2">
        {step === 0 ? 'Referenz' : step === 1 ? 'Basis' : step === 2 ? 'Personen' : 'Hintergruende'}
      </span>
    </div>
  );
```

- [ ] **Step 3: Add applyStrategy function**

Add this function after the `analyzeBrand` function:

```typescript
  const applyStrategy = () => {
    if (!strategy) return;
    setBaseTemplateId(strategy.templateId);
    setPrimaryColor(strategy.primaryColor);
    setSecondaryColor(strategy.secondaryColor);
    setAccentColor(strategy.accentColor);
    setBrandStyle(strategy.mood);
    setPersonPrompt(strategy.personPrompt);
    setBgPrompt(strategy.backgroundPrompt);
    setBrandAnalyzed(true);
    setStep(1);
  };
```

- [ ] **Step 4: Add Step 0 render block**

Insert before the existing `{step === 1 && (` block:

```typescript
      {step === 0 && (
        <div className="space-y-5">
          {!strategy ? (
            <ReferenceUpload
              studioId={studioId}
              onAnalyzed={(s) => setStrategy(s as CampaignStrategy)}
              onSkip={() => setStep(1)}
            />
          ) : (
            <StrategyReview
              strategy={strategy}
              onChange={setStrategy}
              onApply={applyStrategy}
              onReanalyze={() => { setStrategy(null); }}
              onSkip={() => { setStrategy(null); setStep(1); }}
              analyzing={referenceAnalyzing}
            />
          )}
        </div>
      )}
```

- [ ] **Step 5: Add cssStrategyOverrides to CampaignConfig and handleSubmit**

Add `cssStrategyOverrides?: Record<string, string>` to the CampaignConfig interface.

In `handleSubmit`, add the strategy overrides to the returned config:
```typescript
  cssStrategyOverrides: strategy?.cssOverrides,
```

- [ ] **Step 6: Commit**

```bash
git add components/campaign-setup.tsx
git commit -m "feat: integrate Step 0 reference upload into campaign wizard"
```

---

## Task 6: Wire Strategy Through to Generate Route

**Files:**
- Modify: `app/studio/[id]/campaigns/page.tsx`
- Modify: `app/api/campaigns/[id]/generate/route.ts`

- [ ] **Step 1: Update handleGenerate config type in campaigns page**

Add `cssStrategyOverrides?: Record<string, string>` to the config type in `handleGenerate`. Include it in the campaign object construction.

- [ ] **Step 2: Apply strategy overrides in generate route**

In `app/api/campaigns/[id]/generate/route.ts`, after loading the template HTML and before extracting CSS variables for AI variation, apply the strategy overrides:

Find the line where `templateCssVars` is extracted (around line 298):
```typescript
    const templateCssVars = extractCssVariables(templateHtml);
```

Insert BEFORE that line:
```typescript
    // Apply strategy CSS overrides from reference analysis (if any)
    if (campaign.cssStrategyOverrides && Object.keys(campaign.cssStrategyOverrides).length > 0) {
      templateHtml = applyCssOverrides(templateHtml, campaign.cssStrategyOverrides);
      console.log(`Applied ${Object.keys(campaign.cssStrategyOverrides).length} strategy CSS overrides`);
    }
```

This ensures the strategy overrides are baked into the template BEFORE the AI generates additional parameter variations on top.

Also add `cssStrategyOverrides` to the Campaign type usage — it's already in the Campaign interface from Task 1.

- [ ] **Step 3: Verify compilation**

```bash
npx tsc --noEmit 2>&1 | grep -v "storage-campaigns.test.ts" | grep -v "missing the following properties" | head -10
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add app/studio/[id]/campaigns/page.tsx app/api/campaigns/[id]/generate/route.ts
git commit -m "feat: wire strategy overrides through to generate route"
```

---

## Task 7: TypeScript Check + Integration Test

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "storage-campaigns.test.ts" | grep -v "missing the following properties" | head -20
```

Expected: No new errors

- [ ] **Step 2: Seed templates (if not already done)**

```bash
npx tsx scripts/seed-reference-template.ts
```

Expected: All 5 templates seeded

- [ ] **Step 3: Manual integration test**

```bash
npm run dev
```

Test checklist:
1. Navigate to Campaigns → New Campaign
2. Step 0 appears with "Referenz-Creative" upload area
3. Upload a reference image → "Stil analysieren" button works
4. Strategy review panel shows template choice, colors, creative direction
5. Edit a color → change persists
6. Click "Strategie uebernehmen" → Step 1 loads with pre-filled values
7. Verify template picker shows the strategy-selected template
8. Verify colors are pre-filled from strategy
9. "Ohne Referenz fortfahren" skips to Step 1 with defaults
10. Complete a full campaign generation → variants look like the reference style

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve issues found during integration testing"
```

---

## Summary

| Task | What | Files | Est. Time |
|------|------|-------|-----------|
| 1 | CampaignStrategy type | lib/types.ts | 3 min |
| 2 | Analyze reference API | app/api/analyze-reference/route.ts | 5 min |
| 3 | ReferenceUpload component | components/reference-upload.tsx | 5 min |
| 4 | StrategyReview component | components/strategy-review.tsx | 5 min |
| 5 | Integrate Step 0 into wizard | components/campaign-setup.tsx | 10 min |
| 6 | Wire strategy to generate route | campaigns/page.tsx, generate/route.ts | 5 min |
| 7 | TypeScript + integration test | — | 10 min |
