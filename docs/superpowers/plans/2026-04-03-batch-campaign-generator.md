# Batch Campaign Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add batch campaign generation: AI creates design × headline variants, user reviews/edits in a grid, batch-renders all approved variants × formats to ZIP.

**Architecture:** Extends existing Creative Generator MVP with a Campaign entity stored as JSON in `data/campaigns/`. Reuses existing `generate-template` and `generate-copy` API routes for AI generation. New campaign-specific API routes for CRUD, generate, and render. New frontend page at `/studio/[id]/campaigns` with setup wizard, review grid, and render progress.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS 4, Anthropic Claude API, Puppeteer rendering server, JSZip

---

## File Map

### Modified Files
- `lib/types.ts` — Add Campaign, CampaignVariant interfaces
- `lib/storage.ts` — Add campaign CRUD methods + init `campaigns` dir
- `components/sidebar.tsx` — Add "Kampagnen" nav item

### New Files: API
- `app/api/campaigns/route.ts` — GET list, POST create
- `app/api/campaigns/[id]/route.ts` — GET, PUT, DELETE
- `app/api/campaigns/[id]/generate/route.ts` — POST: AI generates variants
- `app/api/campaigns/[id]/render/route.ts` — POST: batch render all approved

### New Files: Components
- `components/campaign-setup.tsx` — Step 1 wizard form
- `components/variant-card.tsx` — Single variant preview card with actions
- `components/variant-grid.tsx` — Grid of variant cards with footer bar
- `components/quick-edit-overlay.tsx` — Modal for inline editing a variant
- `components/render-progress.tsx` — Batch render progress view

### New Files: Pages
- `app/studio/[id]/campaigns/page.tsx` — Campaign list + detail view

### Tests
- `tests/lib/storage-campaigns.test.ts` — Campaign storage CRUD tests

---

## Task 1: Types & Storage (TDD)

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/storage.ts`
- Create: `tests/lib/storage-campaigns.test.ts`

- [ ] **Step 1: Add Campaign types to lib/types.ts**

```typescript
// Add to lib/types.ts after the Creative interface

export interface CampaignVariant {
  id: string;
  templateHtml: string;
  fieldValues: Record<string, string>;
  approved: boolean;
  outputs: CreativeOutput[];
}

export interface Campaign {
  id: string;
  studioId: string;
  name: string;
  baseTemplateId?: string;
  designVariantCount: number;
  headlineVariantCount: number;
  formats: CreativeFormat[];
  defaultValues: Record<string, string>;
  variants: CampaignVariant[];
  status: 'draft' | 'reviewing' | 'rendering' | 'done';
  createdAt: string;
  updatedAt: string;
}
```

Also add campaign methods to the `StorageAdapter` interface:

```typescript
// Add to StorageAdapter interface after listCreatives
saveCampaign(campaign: Campaign): Promise<void>;
getCampaign(id: string): Promise<Campaign | null>;
listCampaigns(studioId: string): Promise<Campaign[]>;
deleteCampaign(id: string): Promise<void>;
```

- [ ] **Step 2: Write failing tests**

```typescript
// tests/lib/storage-campaigns.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FilesystemStorage } from '@/lib/storage';
import fs from 'fs/promises';
import path from 'path';

const TEST_DATA_DIR = path.join(process.cwd(), 'data-test-campaigns');

describe('FilesystemStorage - Campaigns', () => {
  let storage: FilesystemStorage;

  const campaign = {
    id: 'camp-1',
    studioId: 'studio-1',
    name: 'Sommerspezial',
    designVariantCount: 2,
    headlineVariantCount: 3,
    formats: ['instagram-post' as const, 'instagram-story' as const],
    defaultValues: { price: '39,90€', originalPrice: '89,90€' },
    variants: [],
    status: 'draft' as const,
    createdAt: '2026-04-03T00:00:00.000Z',
    updatedAt: '2026-04-03T00:00:00.000Z',
  };

  beforeEach(async () => {
    storage = new FilesystemStorage(TEST_DATA_DIR);
    await storage.init();
  });

  afterEach(async () => {
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  it('should save and retrieve a campaign', async () => {
    await storage.saveCampaign(campaign);
    const retrieved = await storage.getCampaign('camp-1');
    expect(retrieved).toEqual(campaign);
  });

  it('should return null for non-existent campaign', async () => {
    const result = await storage.getCampaign('nope');
    expect(result).toBeNull();
  });

  it('should list campaigns by studioId', async () => {
    await storage.saveCampaign(campaign);
    await storage.saveCampaign({ ...campaign, id: 'camp-2', studioId: 'other' });
    const list = await storage.listCampaigns('studio-1');
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('camp-1');
  });

  it('should delete a campaign', async () => {
    await storage.saveCampaign(campaign);
    await storage.deleteCampaign('camp-1');
    const result = await storage.getCampaign('camp-1');
    expect(result).toBeNull();
  });

  it('should update a campaign', async () => {
    await storage.saveCampaign(campaign);
    await storage.saveCampaign({ ...campaign, name: 'Updated', status: 'reviewing' });
    const result = await storage.getCampaign('camp-1');
    expect(result?.name).toBe('Updated');
    expect(result?.status).toBe('reviewing');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run tests/lib/storage-campaigns.test.ts
```

Expected: FAIL — `saveCampaign` is not a function.

- [ ] **Step 4: Implement campaign storage methods**

Add to `lib/storage.ts` in the `FilesystemStorage` class, after the `listCreatives` method:

```typescript
  async saveCampaign(campaign: Campaign): Promise<void> {
    await fs.writeFile(path.join(this.basePath, 'campaigns', `${campaign.id}.json`), JSON.stringify(campaign, null, 2));
  }

  async getCampaign(id: string): Promise<Campaign | null> {
    try {
      const data = await fs.readFile(path.join(this.basePath, 'campaigns', `${id}.json`), 'utf-8');
      return JSON.parse(data);
    } catch { return null; }
  }

  async listCampaigns(studioId: string): Promise<Campaign[]> {
    const all = await this.listJsonFiles('campaigns');
    const campaigns = await Promise.all(all.map(f => this.readJson<Campaign>(f)));
    return campaigns.filter(c => c.studioId === studioId);
  }

  async deleteCampaign(id: string): Promise<void> {
    try { await fs.unlink(path.join(this.basePath, 'campaigns', `${id}.json`)); } catch {}
  }
```

Also update the import line at the top of `lib/storage.ts`:

```typescript
import type { Studio, SavedTemplate, Creative, Campaign, StorageAdapter, PromptType, AssetType } from './types';
```

And add `'campaigns'` to the `init()` method's dirs array:

```typescript
  async init(): Promise<void> {
    const dirs = ['studios', 'templates', 'creatives', 'prompts', 'assets', 'campaigns'];
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run tests/lib/storage-campaigns.test.ts
```

Expected: 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/storage.ts tests/lib/storage-campaigns.test.ts
git commit -m "feat: add Campaign types and storage with tests"
```

---

## Task 2: Campaign CRUD API Routes

**Files:**
- Create: `app/api/campaigns/route.ts`
- Create: `app/api/campaigns/[id]/route.ts`

- [ ] **Step 1: Create campaigns list + create route**

```typescript
// app/api/campaigns/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET(req: NextRequest) {
  const studioId = req.nextUrl.searchParams.get('studioId');
  if (!studioId) return NextResponse.json({ error: 'studioId required' }, { status: 400 });
  const storage = getStorage();
  await storage.init();
  const campaigns = await storage.listCampaigns(studioId);
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  const campaign = await req.json();
  const storage = getStorage();
  await storage.init();
  await storage.saveCampaign(campaign);
  return NextResponse.json(campaign, { status: 201 });
}
```

- [ ] **Step 2: Create campaign detail route**

```typescript
// app/api/campaigns/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storage = getStorage();
  await storage.init();
  const campaign = await storage.getCampaign(id);
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(campaign);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await req.json();
  campaign.id = id;
  campaign.updatedAt = new Date().toISOString();
  const storage = getStorage();
  await storage.init();
  await storage.saveCampaign(campaign);
  return NextResponse.json(campaign);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storage = getStorage();
  await storage.init();
  await storage.deleteCampaign(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/campaigns/
git commit -m "feat: add campaign CRUD API routes"
```

---

## Task 3: Campaign Generate API Route

**Files:**
- Create: `app/api/campaigns/[id]/generate/route.ts`

- [ ] **Step 1: Implement generate endpoint**

This is the core AI logic. It calls existing `generate-template` and `generate-copy` endpoints internally (server-side, reusing their logic inline to avoid HTTP round-trips).

```typescript
// app/api/campaigns/[id]/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStorage } from '@/lib/storage';
import { DEFAULT_PROMPTS } from '@/lib/prompts';
import { extractCssVariables, extractPlaceholders } from '@/lib/template-utils';
import { FORMAT_DIMENSIONS } from '@/lib/formats';
import { v4 as uuidv4 } from 'uuid';
import type { Campaign, CampaignVariant, CreativeFormat } from '@/lib/types';

const anthropic = new Anthropic();

async function generateDesignHtml(
  systemPrompt: string,
  description: string,
  format: CreativeFormat,
  studioContext: string,
  variantIndex: number,
): Promise<string> {
  const dimensions = FORMAT_DIMENSIONS[format];
  const userMessage = [
    `Zielformat: ${dimensions.width}x${dimensions.height}px`,
    `Beschreibung: ${description}`,
    studioContext,
    variantIndex > 0
      ? `Dies ist Design-Variante ${variantIndex + 1}. Erstelle ein DEUTLICH ANDERES Layout als die vorherigen Varianten — andere Anordnung, andere Akzente, anderer Stil. Aber halte dich an den Referenz-Stil.`
      : '',
  ].filter(Boolean).join('\n');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  return message.content[0].type === 'text' ? message.content[0].text : '';
}

async function generateHeadlines(
  systemPrompt: string,
  studioContext: string,
  count: number,
  price?: string,
  originalPrice?: string,
): Promise<{ headline: string; subline?: string }[]> {
  const userMessage = [
    studioContext,
    price ? `Preis: ${price}` : '',
    originalPrice ? `Streichpreis: ${originalPrice}` : '',
    `Generiere genau ${count} Varianten.`,
  ].filter(Boolean).join('\n');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.slice(0, count) : [];
  } catch {
    return [];
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storage = getStorage();
  await storage.init();

  const campaign = await storage.getCampaign(id);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  const studio = await storage.getStudio(campaign.studioId);
  const studioContext = studio
    ? `Studio: ${studio.name}, Standort: ${studio.location}, Farben: Primär=${studio.primaryColor}, Akzent=${studio.accentColor}, Font: ${studio.defaultFont}`
    : '';

  // Get system prompts
  let templatePrompt = await storage.getSystemPrompt(campaign.studioId, 'template-generation');
  if (!templatePrompt) templatePrompt = DEFAULT_PROMPTS['template-generation'];

  let copyPrompt = await storage.getSystemPrompt(campaign.studioId, 'copy-generation');
  if (!copyPrompt) copyPrompt = DEFAULT_PROMPTS['copy-generation'];

  try {
    // 1. Generate design variants
    const designHtmls: string[] = [];
    const primaryFormat = campaign.formats[0] || 'instagram-post';

    if (campaign.baseTemplateId) {
      // Use existing template
      const baseTemplate = await storage.getTemplate(campaign.baseTemplateId);
      if (baseTemplate) {
        designHtmls.push(baseTemplate.htmlContent);
      }
    } else {
      // AI generates N design variants sequentially
      for (let i = 0; i < campaign.designVariantCount; i++) {
        const html = await generateDesignHtml(
          templatePrompt,
          `Fitness-Werbeanzeige mit Preis ${campaign.defaultValues.price || '39,90€'}`,
          primaryFormat,
          studioContext,
          i,
        );
        if (html) designHtmls.push(html);
      }
    }

    if (designHtmls.length === 0) {
      return NextResponse.json({ error: 'Keine Design-Varianten generiert' }, { status: 500 });
    }

    // 2. Generate headlines for each design (can run in parallel)
    const headlineResults = await Promise.all(
      designHtmls.map(() =>
        generateHeadlines(
          copyPrompt,
          studioContext,
          campaign.headlineVariantCount,
          campaign.defaultValues.price,
          campaign.defaultValues.originalPrice,
        )
      )
    );

    // 3. Combine: designs × headlines = variants
    const variants: CampaignVariant[] = [];
    for (let d = 0; d < designHtmls.length; d++) {
      const headlines = headlineResults[d] || [];
      for (let h = 0; h < headlines.length; h++) {
        variants.push({
          id: uuidv4(),
          templateHtml: designHtmls[d],
          fieldValues: {
            ...campaign.defaultValues,
            headline: headlines[h].headline,
          },
          approved: true,
          outputs: [],
        });
      }
    }

    // 4. Inject studio context into defaultValues
    if (studio) {
      campaign.defaultValues.location = campaign.defaultValues.location || studio.location;
      campaign.defaultValues.primaryColor = campaign.defaultValues.primaryColor || studio.primaryColor;
      campaign.defaultValues.accentColor = campaign.defaultValues.accentColor || studio.accentColor;
    }

    // 5. Update campaign
    campaign.variants = variants;
    campaign.status = 'reviewing';
    campaign.updatedAt = new Date().toISOString();
    await storage.saveCampaign(campaign);

    return NextResponse.json(campaign);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/campaigns/\[id\]/generate/
git commit -m "feat: add campaign variant generation API (design × headline)"
```

---

## Task 4: Campaign Render API Route

**Files:**
- Create: `app/api/campaigns/[id]/render/route.ts`

- [ ] **Step 1: Implement batch render endpoint**

```typescript
// app/api/campaigns/[id]/render/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { replacePlaceholders } from '@/lib/template-utils';
import { FORMAT_DIMENSIONS } from '@/lib/formats';
import fs from 'fs/promises';
import path from 'path';
import type { Campaign, CreativeFormat } from '@/lib/types';

const RENDER_SERVER = process.env.RENDER_SERVER_URL || 'http://localhost:3001';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storage = getStorage();
  await storage.init();

  const campaign = await storage.getCampaign(id);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  campaign.status = 'rendering';
  campaign.updatedAt = new Date().toISOString();
  await storage.saveCampaign(campaign);

  const outputDir = path.join(process.cwd(), 'public', 'output', 'campaigns', id);
  await fs.mkdir(outputDir, { recursive: true });

  const approvedVariants = campaign.variants.filter(v => v.approved);

  // Render each variant × each format
  for (const variant of approvedVariants) {
    variant.outputs = campaign.formats.map(f => ({ format: f, status: 'pending' as const }));
  }

  // Process renders with concurrency limit of 3
  const renderTasks: { variantIdx: number; formatIdx: number; format: CreativeFormat }[] = [];
  for (let vi = 0; vi < approvedVariants.length; vi++) {
    for (let fi = 0; fi < campaign.formats.length; fi++) {
      renderTasks.push({ variantIdx: vi, formatIdx: fi, format: campaign.formats[fi] });
    }
  }

  const CONCURRENCY = 3;
  for (let i = 0; i < renderTasks.length; i += CONCURRENCY) {
    const batch = renderTasks.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (task) => {
      const variant = approvedVariants[task.variantIdx];
      const dims = FORMAT_DIMENSIONS[task.format];
      const values = { ...variant.fieldValues, width: String(dims.width), height: String(dims.height) };
      const html = replacePlaceholders(variant.templateHtml, values);

      // Inject <base> for asset URLs
      const baseTag = `<base href="http://localhost:3000/">`;
      const finalHtml = html.includes('<head>')
        ? html.replace('<head>', `<head>${baseTag}`)
        : `${baseTag}${html}`;

      try {
        const res = await fetch(`${RENDER_SERVER}/api/render`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: finalHtml, width: dims.width, height: dims.height }),
        });

        if (!res.ok) throw new Error('Render failed');

        const png = Buffer.from(await res.arrayBuffer());
        const filename = `variant-${variant.id}-${task.format}.png`;
        await fs.writeFile(path.join(outputDir, filename), png);

        variant.outputs[task.formatIdx] = {
          format: task.format,
          status: 'done',
          outputPath: `/output/campaigns/${id}/${filename}`,
        };
      } catch (err) {
        variant.outputs[task.formatIdx] = {
          format: task.format,
          status: 'error',
          error: err instanceof Error ? err.message : 'Render failed',
        };
      }

      // Save progress after each render
      campaign.updatedAt = new Date().toISOString();
      await storage.saveCampaign(campaign);
    }));
  }

  campaign.status = 'done';
  campaign.updatedAt = new Date().toISOString();
  await storage.saveCampaign(campaign);

  return NextResponse.json(campaign);
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/campaigns/\[id\]/render/
git commit -m "feat: add campaign batch render API with concurrency control"
```

---

## Task 5: Sidebar Update

**Files:**
- Modify: `components/sidebar.tsx`

- [ ] **Step 1: Add Kampagnen nav item**

In `components/sidebar.tsx`, update the `NAV_ITEMS` array:

```typescript
const NAV_ITEMS = [
  { icon: '✏️', label: 'Creatives', path: 'creatives' },
  { icon: '📦', label: 'Kampagnen', path: 'campaigns' },
  { icon: '🎨', label: 'Templates', path: 'templates' },
  { icon: '📷', label: 'Assets', path: 'assets' },
  { icon: '⚙️', label: 'Einstellungen', path: 'settings' },
];
```

- [ ] **Step 2: Commit**

```bash
git add components/sidebar.tsx
git commit -m "feat: add Kampagnen to sidebar navigation"
```

---

## Task 6: Campaign Setup Component

**Files:**
- Create: `components/campaign-setup.tsx`

- [ ] **Step 1: Create campaign setup form**

```tsx
// components/campaign-setup.tsx
'use client';

import { useState, useEffect } from 'react';
import { AssetGrid } from '@/components/asset-grid';
import { FORMAT_DIMENSIONS } from '@/lib/formats';
import type { SavedTemplate, CreativeFormat } from '@/lib/types';

interface CampaignSetupProps {
  studioId: string;
  onGenerate: (config: {
    name: string;
    baseTemplateId?: string;
    designVariantCount: number;
    headlineVariantCount: number;
    formats: CreativeFormat[];
    defaultValues: Record<string, string>;
  }) => void;
  loading: boolean;
}

export function CampaignSetup({ studioId, onGenerate, loading }: CampaignSetupProps) {
  const [name, setName] = useState('');
  const [baseTemplateId, setBaseTemplateId] = useState<string>('');
  const [designCount, setDesignCount] = useState(2);
  const [headlineCount, setHeadlineCount] = useState(3);
  const [formats, setFormats] = useState<CreativeFormat[]>(
    Object.keys(FORMAT_DIMENSIONS) as CreativeFormat[]
  );
  const [price, setPrice] = useState('39,90€');
  const [originalPrice, setOriginalPrice] = useState('89,90€');
  const [selectedPerson, setSelectedPerson] = useState('');
  const [selectedBg, setSelectedBg] = useState('');

  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [personAssets, setPersonAssets] = useState<string[]>([]);
  const [bgAssets, setBgAssets] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/templates?studioId=${studioId}`).then(r => r.json()),
      fetch('/api/templates').then(r => r.json()),
      fetch(`/api/assets/${studioId}?type=person`).then(r => r.json()),
      fetch(`/api/assets/${studioId}?type=background`).then(r => r.json()),
    ]).then(([studioTemplates, allTemplates, persons, bgs]) => {
      const ids = new Set(studioTemplates.map((t: SavedTemplate) => t.id));
      const globals = allTemplates.filter((t: SavedTemplate) => !t.studioId && !ids.has(t.id));
      setTemplates([...studioTemplates, ...globals]);
      setPersonAssets(persons);
      setBgAssets(bgs);
    });
  }, [studioId]);

  const toggleFormat = (f: CreativeFormat) => {
    setFormats(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
    );
  };

  const handleSubmit = () => {
    onGenerate({
      name: name || `Kampagne ${new Date().toLocaleDateString('de')}`,
      baseTemplateId: baseTemplateId || undefined,
      designVariantCount: baseTemplateId ? 1 : designCount,
      headlineVariantCount: headlineCount,
      formats,
      defaultValues: {
        price,
        originalPrice,
        location: '', // Will be filled from studio data in generate API
        backgroundImage: selectedBg ? `/api/assets/serve?path=${encodeURIComponent(selectedBg)}` : '',
        personImage: selectedPerson ? `/api/assets/serve?path=${encodeURIComponent(selectedPerson)}` : '',
      },
    });
  };

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div>
        <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Kampagnen-Name</label>
        <input value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm outline-none"
          placeholder="z.B. Sommerspezial Juli" />
      </div>

      <div>
        <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Template-Basis</label>
        <select value={baseTemplateId} onChange={e => setBaseTemplateId(e.target.value)}
          className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm outline-none">
          <option value="">AI generiert neue Designs</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {!baseTemplateId && (
        <div>
          <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">
            Design-Varianten: {designCount}
          </label>
          <input type="range" min={1} max={4} value={designCount}
            onChange={e => setDesignCount(Number(e.target.value))}
            className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#FF4500]" />
        </div>
      )}

      <div>
        <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">
          Headline-Varianten: {headlineCount}
        </label>
        <input type="range" min={2} max={5} value={headlineCount}
          onChange={e => setHeadlineCount(Number(e.target.value))}
          className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#FF4500]" />
      </div>

      <div>
        <label className="text-[#888] text-xs uppercase tracking-wider mb-1.5 block">Formate</label>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(FORMAT_DIMENSIONS).map(([key, val]) => (
            <button key={key} onClick={() => toggleFormat(key as CreativeFormat)}
              className={`text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${
                formats.includes(key as CreativeFormat)
                  ? 'bg-[#FF4500] text-white'
                  : 'bg-[#1a1a1a] border border-[#333] text-[#666]'
              }`}>
              {val.label.split(' (')[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Preis</label>
          <input value={price} onChange={e => setPrice(e.target.value)}
            className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2.5 text-[#FF4500] text-sm font-bold outline-none" />
        </div>
        <div className="flex-1">
          <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Streichpreis</label>
          <input value={originalPrice} onChange={e => setOriginalPrice(e.target.value)}
            className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2.5 text-[#888] text-sm outline-none" />
        </div>
      </div>

      <div>
        <label className="text-[#888] text-xs uppercase tracking-wider mb-1.5 block">Person</label>
        <AssetGrid assets={personAssets} selected={selectedPerson} onSelect={setSelectedPerson} size="sm" />
      </div>

      <div>
        <label className="text-[#888] text-xs uppercase tracking-wider mb-1.5 block">Hintergrund</label>
        <AssetGrid assets={bgAssets} selected={selectedBg} onSelect={setSelectedBg} size="sm" />
      </div>

      <button onClick={handleSubmit} disabled={loading || formats.length === 0}
        className="w-full bg-[#FF4500] hover:bg-[#e63e00] disabled:opacity-50 text-white font-bold py-3 rounded-lg text-sm transition-colors">
        {loading ? 'Generiere Varianten...' : `Varianten generieren ✨ (${baseTemplateId ? 1 : designCount} × ${headlineCount} = ${(baseTemplateId ? 1 : designCount) * headlineCount})`}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/campaign-setup.tsx
git commit -m "feat: add campaign setup form component"
```

---

## Task 7: Variant Card & Quick Edit Components

**Files:**
- Create: `components/variant-card.tsx`
- Create: `components/quick-edit-overlay.tsx`

- [ ] **Step 1: Create variant card component**

```tsx
// components/variant-card.tsx
'use client';

import { LivePreview } from '@/components/live-preview';
import type { CampaignVariant } from '@/lib/types';

interface VariantCardProps {
  variant: CampaignVariant;
  onToggleApproved: () => void;
  onEdit: () => void;
}

export function VariantCard({ variant, onToggleApproved, onEdit }: VariantCardProps) {
  return (
    <div className={`bg-[#111] border rounded-xl overflow-hidden transition-all ${
      variant.approved ? 'border-[#333]' : 'border-[#222] opacity-30 grayscale'
    }`}>
      <div className="relative h-48 bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
        <LivePreview
          html={variant.templateHtml}
          width={1080}
          height={1080}
          fieldValues={variant.fieldValues}
        />
        <div className="absolute top-2 right-2 flex gap-1">
          <button onClick={onEdit}
            className="w-7 h-7 bg-black/70 rounded-md text-white text-xs flex items-center justify-center hover:bg-[#FF4500] transition-colors"
            title="Editieren">
            ✏️
          </button>
          <button onClick={onToggleApproved}
            className={`w-7 h-7 rounded-md text-xs flex items-center justify-center transition-colors ${
              variant.approved
                ? 'bg-black/70 text-white hover:bg-red-600'
                : 'bg-[#4CAF50] text-white'
            }`}
            title={variant.approved ? 'Entfernen' : 'Wiederherstellen'}>
            {variant.approved ? '×' : '↩'}
          </button>
        </div>
      </div>
      <div className="p-3">
        <p className="text-white text-sm font-semibold truncate">{variant.fieldValues.headline || 'Kein Headline'}</p>
        <p className="text-[#666] text-xs mt-0.5">{variant.fieldValues.price || ''}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create quick edit overlay**

```tsx
// components/quick-edit-overlay.tsx
'use client';

import { useState } from 'react';
import { LivePreview } from '@/components/live-preview';
import { AssetGrid } from '@/components/asset-grid';
import type { CampaignVariant } from '@/lib/types';

interface QuickEditOverlayProps {
  variant: CampaignVariant;
  personAssets: string[];
  bgAssets: string[];
  onSave: (updatedValues: Record<string, string>) => void;
  onClose: () => void;
}

export function QuickEditOverlay({ variant, personAssets, bgAssets, onSave, onClose }: QuickEditOverlayProps) {
  const [values, setValues] = useState({ ...variant.fieldValues });

  const updateField = (key: string, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8" onClick={onClose}>
      <div className="bg-[#111] border border-[#333] rounded-2xl max-w-3xl w-full flex overflow-hidden max-h-[90vh]"
        onClick={e => e.stopPropagation()}>
        {/* Preview */}
        <div className="flex-1 bg-[#0a0a0a] flex items-center justify-center p-6">
          <LivePreview html={variant.templateHtml} width={1080} height={1080} fieldValues={values} />
        </div>

        {/* Edit fields */}
        <div className="w-72 p-5 overflow-y-auto space-y-4">
          <h3 className="text-white font-bold">Quick Edit</h3>

          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Headline</label>
            <input value={values.headline || ''} onChange={e => updateField('headline', e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm outline-none" />
          </div>

          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Preis</label>
            <input value={values.price || ''} onChange={e => updateField('price', e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-[#FF4500] text-sm font-bold outline-none" />
          </div>

          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Streichpreis</label>
            <input value={values.originalPrice || ''} onChange={e => updateField('originalPrice', e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-[#888] text-sm outline-none" />
          </div>

          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider mb-1.5 block">Person</label>
            <AssetGrid assets={personAssets}
              selected={values.personImage ? decodeURIComponent(values.personImage.split('path=')[1] || '') : ''}
              onSelect={p => updateField('personImage', `/api/assets/serve?path=${encodeURIComponent(p)}`)}
              size="sm" />
          </div>

          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider mb-1.5 block">Hintergrund</label>
            <AssetGrid assets={bgAssets}
              selected={values.backgroundImage ? decodeURIComponent(values.backgroundImage.split('path=')[1] || '') : ''}
              onSelect={p => updateField('backgroundImage', `/api/assets/serve?path=${encodeURIComponent(p)}`)}
              size="sm" />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={() => onSave(values)}
              className="flex-1 bg-[#FF4500] text-white font-bold py-2.5 rounded-lg text-sm">
              Übernehmen
            </button>
            <button onClick={onClose}
              className="flex-1 bg-[#222] border border-[#333] text-[#ccc] py-2.5 rounded-lg text-sm">
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/variant-card.tsx components/quick-edit-overlay.tsx
git commit -m "feat: add variant card and quick edit overlay components"
```

---

## Task 8: Variant Grid & Render Progress Components

**Files:**
- Create: `components/variant-grid.tsx`
- Create: `components/render-progress.tsx`

- [ ] **Step 1: Create variant grid component**

```tsx
// components/variant-grid.tsx
'use client';

import { VariantCard } from '@/components/variant-card';
import type { CampaignVariant, CreativeFormat } from '@/lib/types';

interface VariantGridProps {
  variants: CampaignVariant[];
  formats: CreativeFormat[];
  onToggleApproved: (variantId: string) => void;
  onEdit: (variantId: string) => void;
  onRender: () => void;
  rendering: boolean;
}

export function VariantGrid({ variants, formats, onToggleApproved, onEdit, onRender, rendering }: VariantGridProps) {
  const approvedCount = variants.filter(v => v.approved).length;
  const totalPngs = approvedCount * formats.length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {variants.map(v => (
            <VariantCard
              key={v.id}
              variant={v}
              onToggleApproved={() => onToggleApproved(v.id)}
              onEdit={() => onEdit(v.id)}
            />
          ))}
        </div>
      </div>

      {/* Footer bar */}
      <div className="bg-[#111] border-t border-[#222] px-6 py-4 flex justify-between items-center flex-shrink-0">
        <span className="text-[#888] text-sm">
          {approvedCount} von {variants.length} Varianten aktiv
        </span>
        <button onClick={onRender} disabled={rendering || approvedCount === 0}
          className="bg-[#FF4500] hover:bg-[#e63e00] disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors">
          {rendering
            ? 'Rendering...'
            : `Alle rendern (${approvedCount} × ${formats.length} = ${totalPngs} PNGs)`}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create render progress component**

```tsx
// components/render-progress.tsx
'use client';

import type { CampaignVariant, CreativeFormat } from '@/lib/types';

interface RenderProgressProps {
  variants: CampaignVariant[];
  formats: CreativeFormat[];
  onDownloadAll: () => void;
}

export function RenderProgress({ variants, formats, onDownloadAll }: RenderProgressProps) {
  const approvedVariants = variants.filter(v => v.approved);
  const totalRenders = approvedVariants.length * formats.length;
  const doneRenders = approvedVariants.reduce(
    (sum, v) => sum + v.outputs.filter(o => o.status === 'done').length, 0
  );
  const errorRenders = approvedVariants.reduce(
    (sum, v) => sum + v.outputs.filter(o => o.status === 'error').length, 0
  );
  const allDone = doneRenders + errorRenders === totalRenders && totalRenders > 0;
  const progress = totalRenders > 0 ? Math.round((doneRenders + errorRenders) / totalRenders * 100) : 0;

  return (
    <div className="p-6">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-[#888]">{doneRenders} von {totalRenders} fertig</span>
          <span className="text-[#888]">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-[#222] rounded-full overflow-hidden">
          <div className="h-full bg-[#FF4500] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }} />
        </div>
        {errorRenders > 0 && (
          <p className="text-red-400 text-xs mt-1">{errorRenders} Fehler</p>
        )}
      </div>

      {/* Variant results grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {approvedVariants.map(variant => (
          <div key={variant.id} className="bg-[#111] border border-[#333] rounded-xl overflow-hidden">
            <div className="p-3">
              <p className="text-white text-sm font-semibold truncate mb-2">
                {variant.fieldValues.headline || 'Variante'}
              </p>
              <div className="space-y-1.5">
                {variant.outputs.map((output, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-[#666] text-xs">{output.format}</span>
                    {output.status === 'done' && output.outputPath ? (
                      <a href={output.outputPath} download
                        className="text-[#4CAF50] text-xs hover:underline">
                        ✓ Download
                      </a>
                    ) : output.status === 'rendering' ? (
                      <span className="text-[#FF4500] text-xs">Rendering...</span>
                    ) : output.status === 'error' ? (
                      <span className="text-red-400 text-xs">Fehler</span>
                    ) : (
                      <span className="text-[#444] text-xs">Warten...</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Download all */}
      {allDone && doneRenders > 0 && (
        <button onClick={onDownloadAll}
          className="w-full mt-6 bg-[#FF4500] hover:bg-[#e63e00] text-white font-bold py-4 rounded-lg text-base transition-colors">
          📦 Alle als ZIP herunterladen ({doneRenders} PNGs)
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/variant-grid.tsx components/render-progress.tsx
git commit -m "feat: add variant grid and render progress components"
```

---

## Task 9: Campaigns Page

**Files:**
- Create: `app/studio/[id]/campaigns/page.tsx`

- [ ] **Step 1: Implement campaigns page with all 3 phases**

```tsx
// app/studio/[id]/campaigns/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { CampaignSetup } from '@/components/campaign-setup';
import { VariantGrid } from '@/components/variant-grid';
import { QuickEditOverlay } from '@/components/quick-edit-overlay';
import { RenderProgress } from '@/components/render-progress';
import type { Campaign, CampaignVariant, CreativeFormat } from '@/lib/types';

type View = 'list' | 'setup' | 'review' | 'rendering';

export default function CampaignsPage() {
  const { id: studioId } = useParams<{ id: string }>();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [view, setView] = useState<View>('list');
  const [generating, setGenerating] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [editingVariant, setEditingVariant] = useState<CampaignVariant | null>(null);
  const [personAssets, setPersonAssets] = useState<string[]>([]);
  const [bgAssets, setBgAssets] = useState<string[]>([]);

  const loadCampaigns = async () => {
    const res = await fetch(`/api/campaigns?studioId=${studioId}`);
    setCampaigns(await res.json());
  };

  const loadAssets = async () => {
    const [persons, bgs] = await Promise.all([
      fetch(`/api/assets/${studioId}?type=person`).then(r => r.json()),
      fetch(`/api/assets/${studioId}?type=background`).then(r => r.json()),
    ]);
    setPersonAssets(persons);
    setBgAssets(bgs);
  };

  useEffect(() => {
    loadCampaigns();
    loadAssets();
  }, [studioId]);

  const openCampaign = (campaign: Campaign) => {
    setActiveCampaign(campaign);
    if (campaign.status === 'done' || campaign.status === 'rendering') {
      setView('rendering');
    } else if (campaign.status === 'reviewing') {
      setView('review');
    } else {
      setView('setup');
    }
  };

  const handleGenerate = async (config: {
    name: string;
    baseTemplateId?: string;
    designVariantCount: number;
    headlineVariantCount: number;
    formats: CreativeFormat[];
    defaultValues: Record<string, string>;
  }) => {
    setGenerating(true);

    // Create campaign
    const campaign: Campaign = {
      id: uuidv4(),
      studioId,
      ...config,
      variants: [],
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaign),
    });

    // Generate variants
    const res = await fetch(`/api/campaigns/${campaign.id}/generate`, { method: 'POST' });
    const updated = await res.json();

    if (res.ok) {
      setActiveCampaign(updated);
      setView('review');
    } else {
      alert(updated.error || 'Generierung fehlgeschlagen');
    }

    setGenerating(false);
    loadCampaigns();
  };

  const handleToggleApproved = async (variantId: string) => {
    if (!activeCampaign) return;
    const updated = {
      ...activeCampaign,
      variants: activeCampaign.variants.map(v =>
        v.id === variantId ? { ...v, approved: !v.approved } : v
      ),
    };
    setActiveCampaign(updated);
    await fetch(`/api/campaigns/${activeCampaign.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  };

  const handleQuickEditSave = async (updatedValues: Record<string, string>) => {
    if (!activeCampaign || !editingVariant) return;
    const updated = {
      ...activeCampaign,
      variants: activeCampaign.variants.map(v =>
        v.id === editingVariant.id ? { ...v, fieldValues: updatedValues } : v
      ),
    };
    setActiveCampaign(updated);
    setEditingVariant(null);
    await fetch(`/api/campaigns/${activeCampaign.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  };

  const handleRender = async () => {
    if (!activeCampaign) return;
    setRendering(true);
    setView('rendering');

    const res = await fetch(`/api/campaigns/${activeCampaign.id}/render`, { method: 'POST' });
    const updated = await res.json();

    if (res.ok) {
      setActiveCampaign(updated);
    }

    setRendering(false);
    loadCampaigns();
  };

  const handleDownloadAll = async () => {
    if (!activeCampaign) return;
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const variant of activeCampaign.variants.filter(v => v.approved)) {
      for (const output of variant.outputs.filter(o => o.status === 'done' && o.outputPath)) {
        const blob = await fetch(output.outputPath!).then(r => r.blob());
        zip.file(`${variant.fieldValues.headline || variant.id}-${output.format}.png`, blob);
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCampaign.name}-${Date.now()}.zip`;
    a.click();
  };

  const deleteCampaign = async (id: string) => {
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
    loadCampaigns();
  };

  // Setup view
  if (view === 'setup') {
    return (
      <div className="p-6">
        <button onClick={() => { setView('list'); setActiveCampaign(null); }}
          className="text-[#666] text-sm mb-4 hover:text-white">← Zurück</button>
        <h1 className="text-xl font-bold mb-6">Neue Kampagne</h1>
        <CampaignSetup studioId={studioId} onGenerate={handleGenerate} loading={generating} />
      </div>
    );
  }

  // Review view
  if (view === 'review' && activeCampaign) {
    return (
      <>
        <div className="flex flex-col h-full">
          <div className="px-6 pt-6 pb-2 flex justify-between items-center flex-shrink-0">
            <div>
              <button onClick={() => { setView('list'); setActiveCampaign(null); }}
                className="text-[#666] text-sm mb-2 hover:text-white block">← Zurück</button>
              <h1 className="text-xl font-bold">{activeCampaign.name}</h1>
              <p className="text-[#666] text-sm">{activeCampaign.variants.length} Varianten generiert</p>
            </div>
          </div>
          <VariantGrid
            variants={activeCampaign.variants}
            formats={activeCampaign.formats}
            onToggleApproved={handleToggleApproved}
            onEdit={id => setEditingVariant(activeCampaign.variants.find(v => v.id === id) || null)}
            onRender={handleRender}
            rendering={rendering}
          />
        </div>
        {editingVariant && (
          <QuickEditOverlay
            variant={editingVariant}
            personAssets={personAssets}
            bgAssets={bgAssets}
            onSave={handleQuickEditSave}
            onClose={() => setEditingVariant(null)}
          />
        )}
      </>
    );
  }

  // Render progress view
  if (view === 'rendering' && activeCampaign) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 pt-6 pb-2 flex-shrink-0">
          <button onClick={() => { setView('list'); setActiveCampaign(null); }}
            className="text-[#666] text-sm mb-2 hover:text-white block">← Zurück</button>
          <h1 className="text-xl font-bold">{activeCampaign.name}</h1>
        </div>
        <RenderProgress
          variants={activeCampaign.variants}
          formats={activeCampaign.formats}
          onDownloadAll={handleDownloadAll}
        />
      </div>
    );
  }

  // List view (default)
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold">Kampagnen</h1>
          <p className="text-[#666] text-sm mt-1">{campaigns.length} Kampagnen</p>
        </div>
        <button onClick={() => setView('setup')}
          className="bg-[#FF4500] hover:bg-[#e63e00] text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors">
          + Neue Kampagne
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[#444] text-sm mb-4">Noch keine Kampagnen erstellt</p>
          <button onClick={() => setView('setup')}
            className="bg-[#FF4500] hover:bg-[#e63e00] text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors">
            Erste Kampagne erstellen
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id}
              className="bg-[#111] border border-[#333] rounded-xl p-4 flex justify-between items-center hover:border-[#555] cursor-pointer transition-colors"
              onClick={() => openCampaign(c)}>
              <div>
                <h3 className="text-white font-semibold">{c.name}</h3>
                <p className="text-[#666] text-xs mt-0.5">
                  {c.variants.length} Varianten · {c.formats.length} Formate ·
                  {new Date(c.createdAt).toLocaleDateString('de')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-md ${
                  c.status === 'done' ? 'bg-[#4CAF50]/20 text-[#4CAF50]' :
                  c.status === 'rendering' ? 'bg-[#FF4500]/20 text-[#FF4500]' :
                  c.status === 'reviewing' ? 'bg-[#2196F3]/20 text-[#2196F3]' :
                  'bg-[#333] text-[#888]'
                }`}>
                  {c.status === 'done' ? 'Fertig' :
                   c.status === 'rendering' ? 'Rendert...' :
                   c.status === 'reviewing' ? 'Review' : 'Entwurf'}
                </span>
                <button onClick={e => { e.stopPropagation(); deleteCampaign(c.id); }}
                  className="text-[#666] hover:text-red-400 text-sm">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/studio/\[id\]/campaigns/
git commit -m "feat: add campaigns page with setup, review grid, and render progress"
```

---

## Task 10: Build Verification & Smoke Test

**Files:** none created — verification task

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass (including new campaign storage tests).

- [ ] **Step 2: Run Next.js build**

```bash
npx next build
```

Expected: Build succeeds, new routes visible:
- `/api/campaigns`
- `/api/campaigns/[id]`
- `/api/campaigns/[id]/generate`
- `/api/campaigns/[id]/render`
- `/studio/[id]/campaigns`

- [ ] **Step 3: Verify dev server**

```bash
npm run dev
```

Manual checks:
1. Sidebar shows "Kampagnen" between Creatives and Templates
2. Campaigns page loads with empty state
3. "Neue Kampagne" opens setup form
4. Setup form shows template dropdown, sliders, asset pickers, format checkboxes

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: batch campaign generator complete — all tests passing"
```

---

## Summary

| Task | What it builds | Key files |
|------|---------------|-----------|
| 1 | Types + Storage (TDD) | lib/types.ts, lib/storage.ts, tests/ |
| 2 | CRUD API routes | app/api/campaigns/ |
| 3 | Generate API (AI design × headlines) | app/api/campaigns/[id]/generate/ |
| 4 | Batch render API | app/api/campaigns/[id]/render/ |
| 5 | Sidebar update | components/sidebar.tsx |
| 6 | Campaign setup form | components/campaign-setup.tsx |
| 7 | Variant card + quick edit | components/variant-card.tsx, quick-edit-overlay.tsx |
| 8 | Variant grid + render progress | components/variant-grid.tsx, render-progress.tsx |
| 9 | Campaigns page (all phases) | app/studio/[id]/campaigns/page.tsx |
| 10 | Build verification + smoke test | — |
