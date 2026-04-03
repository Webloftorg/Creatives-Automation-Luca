# Creative Generator MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Next.js app that generates professional fitness ad creatives from templates, with AI-powered template generation, copy suggestions, and image creation -- demo-ready for client presentation.

**Architecture:** Monorepo with Next.js 15 frontend (Port 3000) and standalone Express+Puppeteer rendering server (Port 3001), started together via `concurrently`. All data stored locally as JSON files and images on the filesystem, behind a `StorageAdapter` interface for future Supabase migration.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Express, Puppeteer, Anthropic Claude API (Sonnet), Google AI Studio (Imagen 4), Sharp, Vitest

---

## File Map

### Root
- `package.json` — root workspace with `concurrently` dev script
- `tsconfig.base.json` — shared TS settings
- `.gitignore`
- `.env` — already exists with ANTHROPIC_API_KEY, GOOGLE_API_KEY
- `next.config.ts` — Next.js config
- `tailwind.config.ts` — Tailwind with dark theme
- `postcss.config.mjs` — PostCSS for Tailwind

### /lib (shared logic)
- `lib/types.ts` — all TypeScript interfaces and types
- `lib/storage.ts` — StorageAdapter interface + FilesystemStorage class
- `lib/template-utils.ts` — placeholder replacement, CSS var extraction, field detection
- `lib/prompts.ts` — 3 default system prompts (copy, template-gen, template-edit)
- `lib/formats.ts` — CreativeFormat → dimensions mapping

### /data (local storage)
- `data/studios/` — one JSON per studio
- `data/templates/` — one JSON per saved template
- `data/creatives/` — one JSON per creative
- `data/prompts/` — custom prompts per studio
- `data/assets/` — uploaded/generated images per studio

### /public
- `public/output/` — rendered PNGs
- `public/templates/` — reference template HTML files

### /rendering-server
- `rendering-server/package.json` — express, puppeteer, cors, tsx
- `rendering-server/tsconfig.json`
- `rendering-server/src/index.ts` — Express server on port 3001
- `rendering-server/src/routes/render.ts` — POST /api/render → PNG
- `rendering-server/src/utils/browser.ts` — Puppeteer browser pool (1 browser, max 3 pages)

### /app (Next.js pages)
- `app/layout.tsx` — root layout, dark theme, Inter/Montserrat fonts
- `app/globals.css` — Tailwind base + dark theme vars
- `app/page.tsx` — home: studio list + "Neues Studio" button
- `app/onboarding/page.tsx` — 3-step studio creation wizard
- `app/studio/[id]/layout.tsx` — studio layout with icon sidebar
- `app/studio/[id]/creatives/page.tsx` — creative generator dashboard
- `app/studio/[id]/templates/page.tsx` — template management (list + editor)
- `app/studio/[id]/assets/page.tsx` — asset library with AI generation
- `app/studio/[id]/settings/page.tsx` — system prompts + studio data editing

### /app/api (API routes)
- `app/api/studios/route.ts` — GET (list) + POST (create)
- `app/api/studios/[id]/route.ts` — GET + PUT
- `app/api/templates/route.ts` — GET (list) + POST (save)
- `app/api/templates/[id]/route.ts` — GET + PUT + DELETE
- `app/api/assets/upload/route.ts` — POST (multipart upload)
- `app/api/assets/[studioId]/route.ts` — GET (list) + DELETE
- `app/api/generate-copy/route.ts` — POST (Claude headline suggestions)
- `app/api/generate-template/route.ts` — POST (Claude template gen/edit)
- `app/api/generate-image/route.ts` — POST (Imagen 4)
- `app/api/preview/route.ts` — GET/POST (HTML for iframe)
- `app/api/render/route.ts` — POST (proxy to rendering-server)
- `app/api/creatives/route.ts` — GET (list) + POST (save)

### /components (React UI)
- `components/sidebar.tsx` — collapsible icon sidebar
- `components/studio-card.tsx` — studio card for home page
- `components/color-picker.tsx` — hex color picker input
- `components/asset-grid.tsx` — thumbnail grid for asset selection
- `components/template-card.tsx` — template card with thumbnail
- `components/live-preview.tsx` — iframe preview component
- `components/format-selector.tsx` — format toggle buttons
- `components/batch-panel.tsx` — output list + batch mode
- `components/image-generator.tsx` — Imagen 4 prompt + preview
- `components/css-var-slider.tsx` — CSS variable slider control
- `components/headline-suggestions.tsx` — AI suggestions dropdown
- `components/file-upload.tsx` — drag & drop file upload

### /tests
- `tests/lib/storage.test.ts` — FilesystemStorage tests
- `tests/lib/template-utils.test.ts` — template utility tests

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `.gitignore`
- Create: `rendering-server/package.json`, `rendering-server/tsconfig.json`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd "c:/Users/Administrator/Documents/Creatives Automation Luca"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

When prompted for overwriting, accept (the directory only has Referenzen/ and .env).

- [ ] **Step 2: Install root dependencies**

```bash
npm install concurrently sharp uuid
npm install -D @types/uuid vitest
```

- [ ] **Step 3: Create rendering-server package.json**

```json
// rendering-server/package.json
{
  "name": "creative-generator-rendering-server",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "express": "^4.21.0",
    "cors": "^2.8.5",
    "puppeteer": "^23.0.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 4: Create rendering-server tsconfig.json**

```json
// rendering-server/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 5: Install rendering-server dependencies**

```bash
cd rendering-server && npm install && cd ..
```

- [ ] **Step 6: Update root package.json scripts**

Add to root `package.json` scripts:

```json
{
  "scripts": {
    "dev": "concurrently --names next,render --prefix-colors blue,green \"npm run dev:next\" \"npm run dev:render\"",
    "dev:next": "next dev",
    "dev:render": "cd rendering-server && npm run dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest"
  }
}
```

- [ ] **Step 7: Create data directories and .gitignore**

```bash
mkdir -p data/studios data/templates data/creatives data/prompts data/assets
mkdir -p public/output public/templates
```

`.gitignore` — add these lines (keep existing entries from create-next-app):

```
# Data (local storage)
data/studios/*
data/templates/*
data/creatives/*
data/prompts/*
data/assets/*
public/output/*
!data/studios/.gitkeep
!data/templates/.gitkeep
!data/creatives/.gitkeep
!data/prompts/.gitkeep
!data/assets/.gitkeep
!public/output/.gitkeep

# Env
.env
.env.local

# Superpowers
.superpowers/
```

Create `.gitkeep` files:

```bash
touch data/studios/.gitkeep data/templates/.gitkeep data/creatives/.gitkeep data/prompts/.gitkeep data/assets/.gitkeep public/output/.gitkeep
```

- [ ] **Step 8: Create vitest config**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 9: Commit scaffolding**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js + rendering-server monorepo"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `lib/types.ts`
- Create: `lib/formats.ts`

- [ ] **Step 1: Write lib/types.ts**

```typescript
// lib/types.ts

export interface Studio {
  id: string;
  name: string;
  location: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logo?: string;
  backgroundImages: string[];
  personImages: string[];
  generatedImages: string[];
  defaultFont: string;
  createdAt: string;
}

export interface SavedTemplate {
  id: string;
  name: string;
  description?: string;
  studioId?: string;
  type: TemplateType;
  htmlContent: string;
  cssVariables: Record<string, string>;
  dynamicFields: DynamicField[];
  thumbnail?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DynamicField {
  key: string;
  label: string;
  type: 'text' | 'image' | 'color';
  placeholder?: string;
  required: boolean;
}

export interface Creative {
  id: string;
  studioId: string;
  templateId: string;
  fieldValues: Record<string, string>;
  outputs: CreativeOutput[];
  createdAt: string;
}

export interface CreativeOutput {
  format: CreativeFormat;
  status: 'pending' | 'rendering' | 'done' | 'error';
  outputPath?: string;
  error?: string;
}

export type CreativeFormat =
  | 'instagram-post'
  | 'instagram-story'
  | 'facebook-feed'
  | 'facebook-story';

export type TemplateType =
  | 'price-offer'
  | 'trial-offer'
  | 'new-opening'
  | 'seasonal'
  | 'custom';

export type PromptType =
  | 'copy-generation'
  | 'template-generation'
  | 'template-editing';

export type AssetType = 'person' | 'background' | 'logo' | 'generated';

export interface StorageAdapter {
  getStudio(id: string): Promise<Studio | null>;
  saveStudio(studio: Studio): Promise<void>;
  listStudios(): Promise<Studio[]>;

  getTemplate(id: string): Promise<SavedTemplate | null>;
  saveTemplate(template: SavedTemplate): Promise<void>;
  listTemplates(studioId?: string): Promise<SavedTemplate[]>;
  deleteTemplate(id: string): Promise<void>;

  saveCreative(creative: Creative): Promise<void>;
  listCreatives(studioId: string): Promise<Creative[]>;

  uploadAsset(file: Buffer, filename: string, studioId: string, type: AssetType): Promise<string>;
  listAssets(studioId: string, type?: AssetType): Promise<string[]>;
  deleteAsset(path: string): Promise<void>;

  getSystemPrompt(studioId: string, type: PromptType): Promise<string>;
  saveSystemPrompt(studioId: string, type: PromptType, prompt: string): Promise<void>;
}
```

- [ ] **Step 2: Write lib/formats.ts**

```typescript
// lib/formats.ts
import type { CreativeFormat } from './types';

export const FORMAT_DIMENSIONS: Record<CreativeFormat, { width: number; height: number; label: string }> = {
  'instagram-post':  { width: 1080, height: 1080, label: 'Instagram Post (1080×1080)' },
  'instagram-story': { width: 1080, height: 1920, label: 'Instagram Story (1080×1920)' },
  'facebook-feed':   { width: 1200, height: 628,  label: 'Facebook Feed (1200×628)' },
  'facebook-story':  { width: 1080, height: 1920, label: 'Facebook Story (1080×1920)' },
};

export const ALL_FORMATS = Object.keys(FORMAT_DIMENSIONS) as CreativeFormat[];
```

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts lib/formats.ts
git commit -m "feat: add TypeScript types and format definitions"
```

---

## Task 3: Storage Layer

**Files:**
- Create: `lib/storage.ts`
- Create: `tests/lib/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/lib/storage.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FilesystemStorage } from '@/lib/storage';
import fs from 'fs/promises';
import path from 'path';

const TEST_DATA_DIR = path.join(process.cwd(), 'data-test');

describe('FilesystemStorage', () => {
  let storage: FilesystemStorage;

  beforeEach(async () => {
    storage = new FilesystemStorage(TEST_DATA_DIR);
    await storage.init();
  });

  afterEach(async () => {
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  });

  describe('studios', () => {
    const studio = {
      id: 'test-studio-1',
      name: 'FitX Power Gym',
      location: 'Weissenthurm',
      primaryColor: '#FF4500',
      secondaryColor: '#1a1a2e',
      accentColor: '#FF6B00',
      backgroundImages: [],
      personImages: [],
      generatedImages: [],
      defaultFont: 'Montserrat',
      createdAt: '2026-04-03T00:00:00.000Z',
    };

    it('should save and retrieve a studio', async () => {
      await storage.saveStudio(studio);
      const retrieved = await storage.getStudio('test-studio-1');
      expect(retrieved).toEqual(studio);
    });

    it('should return null for non-existent studio', async () => {
      const result = await storage.getStudio('nonexistent');
      expect(result).toBeNull();
    });

    it('should list all studios', async () => {
      await storage.saveStudio(studio);
      await storage.saveStudio({ ...studio, id: 'test-studio-2', name: 'Gym 2' });
      const studios = await storage.listStudios();
      expect(studios).toHaveLength(2);
    });
  });

  describe('templates', () => {
    const template = {
      id: 'tmpl-1',
      name: 'Price Offer V1',
      studioId: 'studio-1',
      type: 'price-offer' as const,
      htmlContent: '<div>{{headline}}</div>',
      cssVariables: { '--bg-blur': '6px' },
      dynamicFields: [{ key: 'headline', label: 'Headline', type: 'text' as const, required: true }],
      version: 1,
      createdAt: '2026-04-03T00:00:00.000Z',
      updatedAt: '2026-04-03T00:00:00.000Z',
    };

    it('should save and retrieve a template', async () => {
      await storage.saveTemplate(template);
      const retrieved = await storage.getTemplate('tmpl-1');
      expect(retrieved).toEqual(template);
    });

    it('should list templates filtered by studioId', async () => {
      await storage.saveTemplate(template);
      await storage.saveTemplate({ ...template, id: 'tmpl-2', studioId: 'studio-2' });
      const filtered = await storage.listTemplates('studio-1');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('tmpl-1');
    });

    it('should list all templates when no studioId given', async () => {
      await storage.saveTemplate(template);
      await storage.saveTemplate({ ...template, id: 'tmpl-2', studioId: 'studio-2' });
      const all = await storage.listTemplates();
      expect(all).toHaveLength(2);
    });

    it('should delete a template', async () => {
      await storage.saveTemplate(template);
      await storage.deleteTemplate('tmpl-1');
      const result = await storage.getTemplate('tmpl-1');
      expect(result).toBeNull();
    });
  });

  describe('assets', () => {
    it('should upload and list assets by type', async () => {
      const buf = Buffer.from('fake-image-data');
      const resultPath = await storage.uploadAsset(buf, 'gym.jpg', 'studio-1', 'background');
      expect(resultPath).toContain('studio-1');
      expect(resultPath).toContain('background');

      const assets = await storage.listAssets('studio-1', 'background');
      expect(assets).toHaveLength(1);
    });

    it('should list all assets when no type given', async () => {
      const buf = Buffer.from('fake');
      await storage.uploadAsset(buf, 'gym.jpg', 'studio-1', 'background');
      await storage.uploadAsset(buf, 'person.png', 'studio-1', 'person');
      const all = await storage.listAssets('studio-1');
      expect(all).toHaveLength(2);
    });

    it('should delete an asset', async () => {
      const buf = Buffer.from('fake');
      const assetPath = await storage.uploadAsset(buf, 'gym.jpg', 'studio-1', 'background');
      await storage.deleteAsset(assetPath);
      const assets = await storage.listAssets('studio-1', 'background');
      expect(assets).toHaveLength(0);
    });
  });

  describe('prompts', () => {
    it('should save and retrieve a custom prompt', async () => {
      await storage.saveSystemPrompt('studio-1', 'copy-generation', 'Custom prompt');
      const prompt = await storage.getSystemPrompt('studio-1', 'copy-generation');
      expect(prompt).toBe('Custom prompt');
    });

    it('should return empty string for non-existent prompt', async () => {
      const prompt = await storage.getSystemPrompt('studio-1', 'copy-generation');
      expect(prompt).toBe('');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/lib/storage.test.ts
```

Expected: FAIL — `FilesystemStorage` does not exist.

- [ ] **Step 3: Implement FilesystemStorage**

```typescript
// lib/storage.ts
import fs from 'fs/promises';
import path from 'path';
import type { Studio, SavedTemplate, Creative, StorageAdapter, PromptType, AssetType } from './types';

export class FilesystemStorage implements StorageAdapter {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || path.join(process.cwd(), 'data');
  }

  async init(): Promise<void> {
    const dirs = ['studios', 'templates', 'creatives', 'prompts', 'assets'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.basePath, dir), { recursive: true });
    }
  }

  // --- Studios ---

  async getStudio(id: string): Promise<Studio | null> {
    try {
      const data = await fs.readFile(path.join(this.basePath, 'studios', `${id}.json`), 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async saveStudio(studio: Studio): Promise<void> {
    await fs.writeFile(
      path.join(this.basePath, 'studios', `${studio.id}.json`),
      JSON.stringify(studio, null, 2),
    );
  }

  async listStudios(): Promise<Studio[]> {
    const files = await this.listJsonFiles('studios');
    return Promise.all(files.map(f => this.readJson<Studio>(f)));
  }

  // --- Templates ---

  async getTemplate(id: string): Promise<SavedTemplate | null> {
    try {
      const data = await fs.readFile(path.join(this.basePath, 'templates', `${id}.json`), 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async saveTemplate(template: SavedTemplate): Promise<void> {
    await fs.writeFile(
      path.join(this.basePath, 'templates', `${template.id}.json`),
      JSON.stringify(template, null, 2),
    );
  }

  async listTemplates(studioId?: string): Promise<SavedTemplate[]> {
    const all = await this.listJsonFiles('templates');
    const templates = await Promise.all(all.map(f => this.readJson<SavedTemplate>(f)));
    if (studioId) return templates.filter(t => t.studioId === studioId);
    return templates;
  }

  async deleteTemplate(id: string): Promise<void> {
    try {
      await fs.unlink(path.join(this.basePath, 'templates', `${id}.json`));
    } catch {
      // already deleted
    }
  }

  // --- Creatives ---

  async saveCreative(creative: Creative): Promise<void> {
    await fs.writeFile(
      path.join(this.basePath, 'creatives', `${creative.id}.json`),
      JSON.stringify(creative, null, 2),
    );
  }

  async listCreatives(studioId: string): Promise<Creative[]> {
    const all = await this.listJsonFiles('creatives');
    const creatives = await Promise.all(all.map(f => this.readJson<Creative>(f)));
    return creatives.filter(c => c.studioId === studioId);
  }

  // --- Assets ---

  async uploadAsset(file: Buffer, filename: string, studioId: string, type: AssetType): Promise<string> {
    const dir = path.join(this.basePath, 'assets', studioId, type);
    await fs.mkdir(dir, { recursive: true });
    const ext = path.extname(filename);
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = path.join(dir, uniqueName);
    await fs.writeFile(filePath, file);
    return filePath;
  }

  async listAssets(studioId: string, type?: AssetType): Promise<string[]> {
    const studioDir = path.join(this.basePath, 'assets', studioId);
    const types: AssetType[] = type ? [type] : ['person', 'background', 'logo', 'generated'];
    const results: string[] = [];

    for (const t of types) {
      const dir = path.join(studioDir, t);
      try {
        const files = await fs.readdir(dir);
        results.push(...files.filter(f => !f.startsWith('.')).map(f => path.join(dir, f)));
      } catch {
        // dir doesn't exist yet
      }
    }
    return results;
  }

  async deleteAsset(assetPath: string): Promise<void> {
    try {
      await fs.unlink(assetPath);
    } catch {
      // already deleted
    }
  }

  // --- Prompts ---

  async getSystemPrompt(studioId: string, type: PromptType): Promise<string> {
    try {
      return await fs.readFile(
        path.join(this.basePath, 'prompts', `${studioId}-${type}.txt`),
        'utf-8',
      );
    } catch {
      return '';
    }
  }

  async saveSystemPrompt(studioId: string, type: PromptType, prompt: string): Promise<void> {
    await fs.writeFile(
      path.join(this.basePath, 'prompts', `${studioId}-${type}.txt`),
      prompt,
    );
  }

  // --- Helpers ---

  private async listJsonFiles(subdir: string): Promise<string[]> {
    const dir = path.join(this.basePath, subdir);
    try {
      const files = await fs.readdir(dir);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => path.join(dir, f));
    } catch {
      return [];
    }
  }

  private async readJson<T>(filePath: string): Promise<T> {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  }
}

// Singleton for the app
let storageInstance: FilesystemStorage | null = null;

export function getStorage(): FilesystemStorage {
  if (!storageInstance) {
    storageInstance = new FilesystemStorage();
  }
  return storageInstance;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/lib/storage.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/storage.ts tests/lib/storage.test.ts
git commit -m "feat: add FilesystemStorage with full test coverage"
```

---

## Task 4: Template Utilities

**Files:**
- Create: `lib/template-utils.ts`
- Create: `tests/lib/template-utils.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/lib/template-utils.test.ts
import { describe, it, expect } from 'vitest';
import {
  replacePlaceholders,
  extractPlaceholders,
  extractCssVariables,
  placeholdersToDynamicFields,
} from '@/lib/template-utils';

describe('replacePlaceholders', () => {
  it('should replace all {{placeholders}} with values', () => {
    const html = '<h1>{{headline}}</h1><p>{{price}}</p>';
    const values = { headline: 'MONATLICH KÜNDBAR', price: '39,90€' };
    const result = replacePlaceholders(html, values);
    expect(result).toBe('<h1>MONATLICH KÜNDBAR</h1><p>39,90€</p>');
  });

  it('should leave unreplaced placeholders as empty string', () => {
    const html = '<h1>{{headline}}</h1><p>{{missing}}</p>';
    const result = replacePlaceholders(html, { headline: 'Test' });
    expect(result).toBe('<h1>Test</h1><p></p>');
  });

  it('should handle multiple occurrences of the same placeholder', () => {
    const html = '{{name}} loves {{name}}';
    const result = replacePlaceholders(html, { name: 'Gym' });
    expect(result).toBe('Gym loves Gym');
  });
});

describe('extractPlaceholders', () => {
  it('should extract all unique placeholder keys from HTML', () => {
    const html = '{{headline}} {{price}} {{headline}} {{location}}';
    const keys = extractPlaceholders(html);
    expect(keys).toEqual(['headline', 'price', 'location']);
  });

  it('should return empty array for no placeholders', () => {
    expect(extractPlaceholders('<h1>Hello</h1>')).toEqual([]);
  });
});

describe('extractCssVariables', () => {
  it('should extract CSS custom properties from :root', () => {
    const html = `<style>:root {
      --bg-blur: 6px;
      --bg-brightness: 0.4;
      --headline-size: 72px;
    }</style>`;
    const vars = extractCssVariables(html);
    expect(vars).toEqual({
      '--bg-blur': '6px',
      '--bg-brightness': '0.4',
      '--headline-size': '72px',
    });
  });

  it('should return empty object if no :root block', () => {
    expect(extractCssVariables('<div>hello</div>')).toEqual({});
  });
});

describe('placeholdersToDynamicFields', () => {
  it('should convert placeholder keys to DynamicField array', () => {
    const keys = ['headline', 'price', 'backgroundImage', 'primaryColor'];
    const fields = placeholdersToDynamicFields(keys);
    expect(fields).toEqual([
      { key: 'headline', label: 'Headline', type: 'text', required: true },
      { key: 'price', label: 'Price', type: 'text', required: true },
      { key: 'backgroundImage', label: 'Background Image', type: 'image', required: true },
      { key: 'primaryColor', label: 'Primary Color', type: 'color', required: true },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/lib/template-utils.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement template-utils.ts**

```typescript
// lib/template-utils.ts
import type { DynamicField } from './types';

/**
 * Replace all {{placeholder}} tokens in HTML with provided values.
 * Missing values are replaced with empty string.
 */
export function replacePlaceholders(html: string, values: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '');
}

/**
 * Extract all unique placeholder keys from an HTML template.
 */
export function extractPlaceholders(html: string): string[] {
  const matches = html.matchAll(/\{\{(\w+)\}\}/g);
  const keys = new Set<string>();
  for (const match of matches) {
    keys.add(match[1]);
  }
  return Array.from(keys);
}

/**
 * Extract CSS custom properties from :root {} block in HTML.
 */
export function extractCssVariables(html: string): Record<string, string> {
  const rootMatch = html.match(/:root\s*\{([^}]+)\}/);
  if (!rootMatch) return {};

  const vars: Record<string, string> = {};
  const lines = rootMatch[1].split(';');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('--')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let value = trimmed.slice(colonIdx + 1).trim();
    // Remove trailing comments
    const commentIdx = value.indexOf('/*');
    if (commentIdx !== -1) value = value.slice(0, commentIdx).trim();
    // Remove {{placeholder}} patterns from value — these are template vars, not CSS vars
    if (!value.startsWith('{{')) {
      vars[key] = value;
    }
  }
  return vars;
}

// Keys that map to image fields
const IMAGE_KEYS = new Set(['backgroundImage', 'personImage', 'logo']);
// Keys that map to color fields
const COLOR_KEYS = new Set(['primaryColor', 'secondaryColor', 'accentColor']);
// System keys that don't need user input
const SYSTEM_KEYS = new Set(['width', 'height']);

/**
 * Convert placeholder keys to DynamicField descriptors.
 * Skips system keys (width, height).
 */
export function placeholdersToDynamicFields(keys: string[]): DynamicField[] {
  return keys
    .filter(key => !SYSTEM_KEYS.has(key))
    .map(key => ({
      key,
      label: camelToTitle(key),
      type: IMAGE_KEYS.has(key) ? 'image' as const : COLOR_KEYS.has(key) ? 'color' as const : 'text' as const,
      required: true,
    }));
}

function camelToTitle(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/lib/template-utils.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/template-utils.ts tests/lib/template-utils.test.ts
git commit -m "feat: add template placeholder and CSS variable utilities"
```

---

## Task 5: Default System Prompts

**Files:**
- Create: `lib/prompts.ts`

- [ ] **Step 1: Write lib/prompts.ts**

```typescript
// lib/prompts.ts
import type { PromptType } from './types';

export const DEFAULT_PROMPTS: Record<PromptType, string> = {
  'copy-generation': `Du bist ein Direct-Response-Copywriter spezialisiert auf Fitnessstudio-Werbeanzeigen im deutschen Markt. Du schreibst kurze, knackige Headlines und CTAs die auf Social Media Aufmerksamkeit erregen.

Regeln:
- Headlines: MAX 3-4 Wörter, UPPERCASE-tauglich
- Immer auf Deutsch
- Nutze Urgency und FOMO
- Preisanker und Streichpreise sind dein bestes Werkzeug
- Typische Hooks: "Monatlich kündbar", "Ohne Vertragsbindung", "Nur diesen Monat", "Neueröffnung", "X Tage unverbindlich", "Jetzt starten"

Antworte NUR als JSON-Array mit Objekten: { "headline": string, "subline"?: string }
Generiere immer 5 Varianten.`,

  'template-generation': `Du bist ein Senior Frontend-Entwickler und Grafikdesigner spezialisiert auf Social-Media-Werbeanzeigen für Fitnessstudios. Du erstellst HTML/CSS-Templates die per Puppeteer zu hochauflösenden PNGs gerendert werden.

REFERENZ-STIL (dies ist der bewährte Stil des Kunden -- alle Templates sollen sich daran orientieren):
- Typografie: Montserrat Black (font-weight: 900), UPPERCASE Headlines
- Preis in kräftigem Orange auf dunklem halbtransparentem Balken (#000000cc), deutlich größer als der Rest
- Streichpreis mit line-through, darunter, kleinere Schrift, reduzierte Opacity
- Hintergrund: Gym-Foto, geblurt (4-8px), abgedunkelt (brightness 0.3-0.5)
- Person: Freigestellt (PNG mit Transparenz), zentriert oder leicht versetzt, überlappt teilweise mit Text für Tiefe
- Text-Lesbarkeit: IMMER text-shadow (2px 2px 8px rgba(0,0,0,0.8)) auf allen Textelementen
- Standort oben, weiß, bold
- Gesamtwirkung: Bold, impact-driven, direct-response Werbung

WICHTIGE REGELN:
- Erstelle ein VOLLSTÄNDIGES, eigenständiges HTML-Dokument
- Nutze Google Fonts via CDN (bevorzugt: Montserrat)
- Alle Styles inline im <style>-Tag, KEIN externes CSS
- Nutze CSS-Variablen in :root für alle anpassbaren Werte (--bg-blur, --bg-brightness, --headline-size, --price-size, --person-scale, --person-position-y, etc.)
- Platzhalter im Format {{platzhalterName}} für dynamische Inhalte
- Die folgenden Platzhalter MÜSSEN unterstützt werden: {{width}}, {{height}}, {{backgroundImage}}, {{personImage}}, {{primaryColor}}, {{accentColor}}, {{location}}
- Weitere Platzhalter je nach Template-Typ ({{headline}}, {{price}}, {{originalPrice}}, etc.)
- Bilder als URL einbinden (werden beim Rendern ersetzt)
- KEIN JavaScript im Template
- Design muss professionell aussehen -- vergleichbar mit echten Social Media Ads
- Person-Bilder sind freigestellt (PNG mit Transparenz) und sollen den Hintergrund teilweise überdecken

Antworte NUR mit dem vollständigen HTML-Code, kein Markdown, keine Erklärungen.`,

  'template-editing': `Du bist ein Senior Frontend-Entwickler. Du bekommst ein bestehendes HTML/CSS-Template für eine Fitness-Werbeanzeige und eine Änderungsanweisung. Passe das Template entsprechend an.

REGELN:
- Gib das VOLLSTÄNDIGE angepasste HTML zurück (nicht nur die Änderungen)
- Behalte alle bestehenden Platzhalter ({{...}}) bei
- Behalte die CSS-Variablen-Struktur bei
- Füge keine neuen Platzhalter hinzu ohne sie in der Antwort zu dokumentieren
- Wenn neue CSS-Variablen nötig sind, füge sie in :root hinzu
- Verändere NICHT die grundlegende Struktur wenn nicht explizit gewünscht
- Der Referenz-Stil (Montserrat Black, Orange-Preis auf dunklem Balken, geblurter Gym-Hintergrund) soll beibehalten werden, es sei denn der User wünscht explizit etwas anderes

Antworte NUR mit dem vollständigen angepassten HTML-Code, kein Markdown, keine Erklärungen.`,
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/prompts.ts
git commit -m "feat: add default system prompts with reference style"
```

---

## Task 6: Reference Template

**Files:**
- Create: `public/templates/price-offer-reference.html`

- [ ] **Step 1: Create the hardcoded reference template**

This template must match the reference images exactly: Montserrat Black, orange price on dark bar, blurred gym background, cutout person overlapping text.

```html
<!-- public/templates/price-offer-reference.html -->
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-color: {{primaryColor}};
      --accent-color: {{accentColor}};
      --bg-blur: 6px;
      --bg-brightness: 0.35;
      --headline-size: 72px;
      --price-size: 96px;
      --person-scale: 0.85;
      --person-position-y: 5%;
      --location-size: 28px;
      --strikethrough-size: 28px;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    .creative-container {
      width: {{width}}px;
      height: {{height}}px;
      position: relative;
      overflow: hidden;
      font-family: 'Montserrat', sans-serif;
      background: #0a0a0a;
    }

    .background {
      position: absolute;
      inset: 0;
      background-image: url('{{backgroundImage}}');
      background-size: cover;
      background-position: center;
      filter: blur(var(--bg-blur)) brightness(var(--bg-brightness));
      transform: scale(1.15);
    }

    .overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to bottom,
        rgba(0,0,0,0.2) 0%,
        rgba(0,0,0,0.1) 30%,
        rgba(0,0,0,0.4) 60%,
        rgba(0,0,0,0.7) 100%
      );
      z-index: 1;
    }

    .person {
      position: absolute;
      z-index: 2;
      bottom: var(--person-position-y);
      left: 50%;
      transform: translateX(-50%) scale(var(--person-scale));
      height: 85%;
      width: auto;
      object-fit: contain;
      filter: drop-shadow(0 4px 20px rgba(0,0,0,0.5));
    }

    .content {
      position: absolute;
      z-index: 3;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 40px;
    }

    .location {
      font-size: var(--location-size);
      font-weight: 700;
      color: white;
      text-align: center;
      text-shadow: 2px 2px 8px rgba(0,0,0,0.8);
      text-transform: uppercase;
      letter-spacing: 2px;
    }

    .bottom-block {
      text-align: center;
    }

    .headline {
      font-size: var(--headline-size);
      font-weight: 900;
      color: white;
      text-transform: uppercase;
      text-shadow: 2px 2px 8px rgba(0,0,0,0.8);
      line-height: 1.05;
      margin-bottom: 16px;
    }

    .price-block {
      background: rgba(0, 0, 0, 0.75);
      display: inline-block;
      padding: 12px 40px;
      border-radius: 8px;
    }

    .price {
      font-size: var(--price-size);
      font-weight: 900;
      color: var(--accent-color);
      text-shadow: 0 0 30px rgba(255,69,0,0.3);
      line-height: 1.1;
    }

    .original-price {
      font-size: var(--strikethrough-size);
      font-weight: 700;
      color: rgba(255,255,255,0.6);
      text-decoration: line-through;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div class="creative-container">
    <div class="background"></div>
    <div class="overlay"></div>
    <img class="person" src="{{personImage}}" alt="">
    <div class="content">
      <div class="location">{{location}}</div>
      <div class="bottom-block">
        <h1 class="headline">{{headline}}</h1>
        <div class="price-block">
          <div class="price">{{price}}</div>
          <div class="original-price">Statt {{originalPrice}}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 2: Seed the reference template as a SavedTemplate JSON**

Create a script or manually create the JSON so it appears in the template list:

```typescript
// scripts/seed-reference-template.ts
import fs from 'fs/promises';
import path from 'path';

const template = {
  id: 'reference-price-offer',
  name: 'Preis-Angebot (Referenz-Stil)',
  description: 'Der bewährte Stil aus den Referenz-Creatives. Orange Preis auf dunklem Balken, Montserrat Black, geblurter Gym-Hintergrund.',
  studioId: undefined,
  type: 'price-offer',
  htmlContent: '', // will be loaded from file
  cssVariables: {
    '--bg-blur': '6px',
    '--bg-brightness': '0.35',
    '--headline-size': '72px',
    '--price-size': '96px',
    '--person-scale': '0.85',
    '--person-position-y': '5%',
    '--location-size': '28px',
    '--strikethrough-size': '28px',
  },
  dynamicFields: [
    { key: 'headline', label: 'Headline', type: 'text', required: true },
    { key: 'price', label: 'Preis', type: 'text', required: true },
    { key: 'originalPrice', label: 'Streichpreis', type: 'text', required: true },
    { key: 'location', label: 'Standort', type: 'text', required: true },
    { key: 'backgroundImage', label: 'Hintergrundbild', type: 'image', required: true },
    { key: 'personImage', label: 'Person', type: 'image', required: true },
  ],
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

async function seed() {
  const htmlPath = path.join(process.cwd(), 'public/templates/price-offer-reference.html');
  template.htmlContent = await fs.readFile(htmlPath, 'utf-8');

  const outDir = path.join(process.cwd(), 'data/templates');
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(
    path.join(outDir, `${template.id}.json`),
    JSON.stringify(template, null, 2),
  );
  console.log('Reference template seeded.');
}

seed();
```

Run:

```bash
npx tsx scripts/seed-reference-template.ts
```

- [ ] **Step 3: Commit**

```bash
git add public/templates/price-offer-reference.html scripts/seed-reference-template.ts
git commit -m "feat: add hardcoded reference template matching client style"
```

---

## Task 7: Rendering Server

**Files:**
- Create: `rendering-server/src/index.ts`
- Create: `rendering-server/src/routes/render.ts`
- Create: `rendering-server/src/utils/browser.ts`

- [ ] **Step 1: Implement browser pool**

```typescript
// rendering-server/src/utils/browser.ts
import puppeteer, { type Browser, type Page } from 'puppeteer';

let browser: Browser | null = null;
let activePages = 0;
const MAX_PAGES = 3;

export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browser;
}

export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  if (activePages >= MAX_PAGES) {
    throw new Error('Too many concurrent renders. Try again shortly.');
  }

  const b = await getBrowser();
  const page = await b.newPage();
  activePages++;

  try {
    return await fn(page);
  } finally {
    activePages--;
    await page.close().catch(() => {});
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
```

- [ ] **Step 2: Implement render route**

```typescript
// rendering-server/src/routes/render.ts
import { Router, type Request, type Response } from 'express';
import { withPage } from '../utils/browser.js';

const router = Router();

interface RenderBody {
  html: string;
  width: number;
  height: number;
  deviceScaleFactor?: number;
}

router.post('/api/render', async (req: Request, res: Response) => {
  const { html, width, height, deviceScaleFactor = 2 } = req.body as RenderBody;

  if (!html || !width || !height) {
    res.status(400).json({ error: 'Missing required fields: html, width, height' });
    return;
  }

  try {
    const png = await withPage(async (page) => {
      await page.setViewport({ width, height, deviceScaleFactor });
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
      return await page.screenshot({
        type: 'png',
        clip: { x: 0, y: 0, width, height },
      });
    });

    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Render failed';
    res.status(500).json({ error: message });
  }
});

export default router;
```

- [ ] **Step 3: Implement Express server**

```typescript
// rendering-server/src/index.ts
import express from 'express';
import cors from 'cors';
import renderRouter from './routes/render.js';
import { closeBrowser } from './utils/browser.js';

const app = express();
const PORT = process.env.RENDER_PORT || 3001;

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json({ limit: '10mb' }));

app.use(renderRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const server = app.listen(PORT, () => {
  console.log(`Rendering server running on http://localhost:${PORT}`);
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  server.close();
});

process.on('SIGINT', async () => {
  await closeBrowser();
  server.close();
});
```

- [ ] **Step 4: Test rendering server manually**

```bash
cd rendering-server && npm run dev &
```

In another terminal:

```bash
curl -X POST http://localhost:3001/api/render \
  -H "Content-Type: application/json" \
  -d '{"html":"<html><body><div style=\"width:200px;height:200px;background:red;\"></div></body></html>","width":200,"height":200}' \
  --output test-render.png
```

Verify `test-render.png` is a 400x400 red square (2x device scale factor). Clean up:

```bash
rm test-render.png
```

- [ ] **Step 5: Commit**

```bash
git add rendering-server/src/
git commit -m "feat: add Express + Puppeteer rendering server"
```

---

## Task 8: Next.js API Routes — Preview + Render Proxy

**Files:**
- Create: `app/api/preview/route.ts`
- Create: `app/api/render/route.ts`

- [ ] **Step 1: Preview route (returns HTML for iframe)**

```typescript
// app/api/preview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { replacePlaceholders } from '@/lib/template-utils';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { templateId, html: rawHtml, fieldValues = {}, width = 1080, height = 1080 } = body;

  let html: string;

  if (templateId) {
    const storage = getStorage();
    await storage.init();
    const template = await storage.getTemplate(templateId);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    html = template.htmlContent;
  } else if (rawHtml) {
    html = rawHtml;
  } else {
    return NextResponse.json({ error: 'Provide templateId or html' }, { status: 400 });
  }

  const values = { ...fieldValues, width: String(width), height: String(height) };
  const rendered = replacePlaceholders(html, values);

  return new NextResponse(rendered, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
```

- [ ] **Step 2: Render proxy route (forwards to rendering server)**

```typescript
// app/api/render/route.ts
import { NextRequest, NextResponse } from 'next/server';

const RENDER_SERVER = process.env.RENDER_SERVER_URL || 'http://localhost:3001';

export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const response = await fetch(`${RENDER_SERVER}/api/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const png = await response.arrayBuffer();
    return new NextResponse(Buffer.from(png), {
      headers: { 'Content-Type': 'image/png' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Rendering server unreachable. Is it running on port 3001?' },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/preview/route.ts app/api/render/route.ts
git commit -m "feat: add preview and render proxy API routes"
```

---

## Task 9: Next.js API Routes — Studio + Template + Asset CRUD

**Files:**
- Create: `app/api/studios/route.ts`
- Create: `app/api/studios/[id]/route.ts`
- Create: `app/api/templates/route.ts`
- Create: `app/api/templates/[id]/route.ts`
- Create: `app/api/assets/upload/route.ts`
- Create: `app/api/assets/[studioId]/route.ts`
- Create: `app/api/creatives/route.ts`

- [ ] **Step 1: Studio routes**

```typescript
// app/api/studios/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET() {
  const storage = getStorage();
  await storage.init();
  const studios = await storage.listStudios();
  return NextResponse.json(studios);
}

export async function POST(req: NextRequest) {
  const storage = getStorage();
  await storage.init();
  const studio = await req.json();
  await storage.saveStudio(studio);
  return NextResponse.json(studio, { status: 201 });
}
```

```typescript
// app/api/studios/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storage = getStorage();
  await storage.init();
  const studio = await storage.getStudio(id);
  if (!studio) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(studio);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storage = getStorage();
  await storage.init();
  const data = await req.json();
  await storage.saveStudio({ ...data, id });
  return NextResponse.json({ ...data, id });
}
```

- [ ] **Step 2: Template routes**

```typescript
// app/api/templates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET(req: NextRequest) {
  const storage = getStorage();
  await storage.init();
  const studioId = req.nextUrl.searchParams.get('studioId') || undefined;
  const templates = await storage.listTemplates(studioId);
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const storage = getStorage();
  await storage.init();
  const template = await req.json();
  await storage.saveTemplate(template);
  return NextResponse.json(template, { status: 201 });
}
```

```typescript
// app/api/templates/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storage = getStorage();
  await storage.init();
  const template = await storage.getTemplate(id);
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(template);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storage = getStorage();
  await storage.init();
  const data = await req.json();
  await storage.saveTemplate({ ...data, id });
  return NextResponse.json({ ...data, id });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storage = getStorage();
  await storage.init();
  await storage.deleteTemplate(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Asset routes**

```typescript
// app/api/assets/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import type { AssetType } from '@/lib/types';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const studioId = formData.get('studioId') as string;
  const type = formData.get('type') as AssetType;

  if (!file || !studioId || !type) {
    return NextResponse.json({ error: 'Missing file, studioId, or type' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getStorage();
  await storage.init();
  const assetPath = await storage.uploadAsset(buffer, file.name, studioId, type);

  return NextResponse.json({ path: assetPath }, { status: 201 });
}
```

```typescript
// app/api/assets/[studioId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import type { AssetType } from '@/lib/types';

export async function GET(req: NextRequest, { params }: { params: Promise<{ studioId: string }> }) {
  const { studioId } = await params;
  const type = req.nextUrl.searchParams.get('type') as AssetType | null;
  const storage = getStorage();
  await storage.init();
  const assets = await storage.listAssets(studioId, type || undefined);
  return NextResponse.json(assets);
}

export async function DELETE(req: NextRequest) {
  const { path: assetPath } = await req.json();
  const storage = getStorage();
  await storage.init();
  await storage.deleteAsset(assetPath);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Creative routes**

```typescript
// app/api/creatives/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET(req: NextRequest) {
  const studioId = req.nextUrl.searchParams.get('studioId');
  if (!studioId) return NextResponse.json({ error: 'studioId required' }, { status: 400 });

  const storage = getStorage();
  await storage.init();
  const creatives = await storage.listCreatives(studioId);
  return NextResponse.json(creatives);
}

export async function POST(req: NextRequest) {
  const storage = getStorage();
  await storage.init();
  const creative = await req.json();
  await storage.saveCreative(creative);
  return NextResponse.json(creative, { status: 201 });
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/studios/ app/api/templates/ app/api/assets/ app/api/creatives/
git commit -m "feat: add CRUD API routes for studios, templates, assets, creatives"
```

---

## Task 10: AI API Routes — Copy, Template, Image Generation

**Files:**
- Create: `app/api/generate-copy/route.ts`
- Create: `app/api/generate-template/route.ts`
- Create: `app/api/generate-image/route.ts`

- [ ] **Step 1: Install Anthropic SDK**

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Copy generation route**

```typescript
// app/api/generate-copy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStorage } from '@/lib/storage';
import { DEFAULT_PROMPTS } from '@/lib/prompts';

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const { studioId, offerType, price, originalPrice, customContext } = await req.json();

  const storage = getStorage();
  await storage.init();

  // Load studio-specific prompt or default
  let systemPrompt = await storage.getSystemPrompt(studioId, 'copy-generation');
  if (!systemPrompt) systemPrompt = DEFAULT_PROMPTS['copy-generation'];

  // Load studio data for context
  const studio = studioId ? await storage.getStudio(studioId) : null;

  const userMessage = [
    studio ? `Studio: ${studio.name}, Standort: ${studio.location}` : '',
    offerType ? `Angebotstyp: ${offerType}` : '',
    price ? `Preis: ${price}` : '',
    originalPrice ? `Streichpreis: ${originalPrice}` : '',
    customContext ? `Kontext: ${customContext}` : '',
  ].filter(Boolean).join('\n');

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    // Parse JSON array from response
    const variants = JSON.parse(text);
    return NextResponse.json({ variants });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Copy generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 3: Template generation route**

```typescript
// app/api/generate-template/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getStorage } from '@/lib/storage';
import { DEFAULT_PROMPTS } from '@/lib/prompts';
import { extractPlaceholders, extractCssVariables, placeholdersToDynamicFields } from '@/lib/template-utils';
import { FORMAT_DIMENSIONS } from '@/lib/formats';
import type { CreativeFormat } from '@/lib/types';

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const { prompt, format, studioId, baseTemplate, referenceTemplateIds } = await req.json();

  const storage = getStorage();
  await storage.init();

  // Determine if editing or generating
  const isEditing = Boolean(baseTemplate);
  const promptType = isEditing ? 'template-editing' : 'template-generation';

  let systemPrompt = studioId
    ? await storage.getSystemPrompt(studioId, promptType)
    : '';
  if (!systemPrompt) systemPrompt = DEFAULT_PROMPTS[promptType];

  // Build user message
  const dimensions = FORMAT_DIMENSIONS[format as CreativeFormat] || FORMAT_DIMENSIONS['instagram-post'];
  const parts: string[] = [];

  parts.push(`Zielformat: ${dimensions.width}x${dimensions.height}px`);

  if (isEditing) {
    parts.push(`\nBestehendes Template:\n${baseTemplate}`);
    parts.push(`\nÄnderung: ${prompt}`);
  } else {
    parts.push(`\nBeschreibung: ${prompt}`);
  }

  // Add reference templates if provided
  if (referenceTemplateIds && referenceTemplateIds.length > 0) {
    for (const refId of referenceTemplateIds) {
      const refTemplate = await storage.getTemplate(refId);
      if (refTemplate) {
        parts.push(`\nReferenz-Template "${refTemplate.name}":\n${refTemplate.htmlContent}`);
      }
    }
  }

  // Add studio colors if available
  if (studioId) {
    const studio = await storage.getStudio(studioId);
    if (studio) {
      parts.push(`\nStudio-Farben: Primär=${studio.primaryColor}, Akzent=${studio.accentColor}`);
      parts.push(`Font: ${studio.defaultFont}`);
    }
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: parts.join('\n') }],
    });

    const html = message.content[0].type === 'text' ? message.content[0].text : '';

    // Extract metadata from generated HTML
    const placeholders = extractPlaceholders(html);
    const cssVariables = extractCssVariables(html);
    const dynamicFields = placeholdersToDynamicFields(placeholders);

    return NextResponse.json({ html, dynamicFields, cssVariables });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Template generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 4: Image generation route (Imagen 4)**

```typescript
// app/api/generate-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import type { AssetType } from '@/lib/types';

export async function POST(req: NextRequest) {
  const { prompt, studioId, assetType = 'generated' } = await req.json() as {
    prompt: string;
    studioId: string;
    assetType?: AssetType;
  };

  if (!prompt || !studioId) {
    return NextResponse.json({ error: 'prompt and studioId required' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_API_KEY not configured' }, { status: 500 });
  }

  try {
    // Call Imagen 4 via Google AI Studio REST API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '1:1',
          },
        }),
      },
    );

    if (!response.ok) {
      const errBody = await response.text();
      return NextResponse.json({ error: `Imagen API error: ${errBody}` }, { status: 502 });
    }

    const data = await response.json();
    const base64Image = data.predictions?.[0]?.bytesBase64Encoded;

    if (!base64Image) {
      return NextResponse.json({ error: 'No image returned from Imagen' }, { status: 502 });
    }

    // Save to asset library
    const buffer = Buffer.from(base64Image, 'base64');
    const storage = getStorage();
    await storage.init();
    const assetPath = await storage.uploadAsset(buffer, 'generated.png', studioId, assetType);

    return NextResponse.json({
      path: assetPath,
      base64: `data:image/png;base64,${base64Image}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Image generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/generate-copy/ app/api/generate-template/ app/api/generate-image/
git commit -m "feat: add AI API routes for copy, template, and image generation"
```

---

## Task 11: Frontend — Root Layout + Dark Theme + Home Page

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `app/page.tsx`
- Create: `components/studio-card.tsx`

- [ ] **Step 1: Set up globals.css with dark theme**

```css
/* app/globals.css */
@import "tailwindcss";

:root {
  --background: #0a0a0a;
  --panel: #111111;
  --panel-border: #222222;
  --accent: #FF4500;
  --accent-hover: #e63e00;
  --success: #4CAF50;
  --text-primary: #ffffff;
  --text-secondary: #aaaaaa;
  --text-muted: #666666;
}

body {
  background: var(--background);
  color: var(--text-primary);
  font-family: 'Inter', system-ui, sans-serif;
}

/* Scrollbar styling */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--background); }
::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
```

- [ ] **Step 2: Set up root layout**

```tsx
// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Creative Generator',
  description: 'Fitness Ad Creative Automation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Create StudioCard component**

```tsx
// components/studio-card.tsx
'use client';

import type { Studio } from '@/lib/types';
import Link from 'next/link';

export function StudioCard({ studio }: { studio: Studio }) {
  return (
    <Link href={`/studio/${studio.id}/creatives`}>
      <div className="bg-[#111] border border-[#222] rounded-xl p-5 hover:border-[#FF4500] transition-colors cursor-pointer group">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-content-center text-white font-bold text-lg"
            style={{ backgroundColor: studio.primaryColor }}
          >
            <span className="flex items-center justify-center w-full h-full">
              {studio.name[0]}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-white group-hover:text-[#FF4500] transition-colors">
              {studio.name}
            </h3>
            <p className="text-sm text-[#666]">{studio.location}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-5 h-5 rounded" style={{ backgroundColor: studio.primaryColor }} />
          <div className="w-5 h-5 rounded" style={{ backgroundColor: studio.secondaryColor }} />
          <div className="w-5 h-5 rounded" style={{ backgroundColor: studio.accentColor }} />
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Create Home page**

```tsx
// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StudioCard } from '@/components/studio-card';
import type { Studio } from '@/lib/types';

export default function HomePage() {
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/studios')
      .then(r => r.json())
      .then(setStudios)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">Creative Generator</h1>
            <p className="text-[#666] text-sm mt-1">Fitness Ad Automation</p>
          </div>
          <button
            onClick={() => router.push('/onboarding')}
            className="bg-[#FF4500] hover:bg-[#e63e00] text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            + Neues Studio
          </button>
        </div>

        {loading ? (
          <div className="text-[#666]">Lade Studios...</div>
        ) : studios.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-[#444] text-6xl mb-4">&#127947;</div>
            <h2 className="text-xl font-semibold mb-2">Noch keine Studios</h2>
            <p className="text-[#666] mb-6">Erstelle dein erstes Studio um loszulegen.</p>
            <button
              onClick={() => router.push('/onboarding')}
              className="bg-[#FF4500] hover:bg-[#e63e00] text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Studio anlegen
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {studios.map(s => <StudioCard key={s.id} studio={s} />)}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run dev and verify home page renders**

```bash
npm run dev:next
```

Open http://localhost:3000. Expect dark background, "Creative Generator" header, "Noch keine Studios" empty state, orange "Studio anlegen" button.

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx app/globals.css app/page.tsx components/studio-card.tsx
git commit -m "feat: add dark-themed root layout and home page with studio list"
```

---

## Task 12: Onboarding Flow (3 Steps)

**Files:**
- Create: `app/onboarding/page.tsx`
- Create: `components/file-upload.tsx`
- Create: `components/color-picker.tsx`
- Create: `components/image-generator.tsx`

- [ ] **Step 1: Create FileUpload component**

```tsx
// components/file-upload.tsx
'use client';

import { useCallback } from 'react';

interface FileUploadProps {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  label?: string;
}

export function FileUpload({ onFiles, accept = 'image/*', multiple = true, label = 'Drag & Drop oder klicken' }: FileUploadProps) {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    onFiles(files);
  }, [onFiles]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    onFiles(files);
  }, [onFiles]);

  return (
    <label
      className="flex flex-col items-center justify-center w-full h-32 border border-dashed border-[#444] rounded-lg cursor-pointer hover:border-[#FF4500] transition-colors bg-[#111]"
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
    >
      <span className="text-[#555] text-sm">{label}</span>
      <input
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
      />
    </label>
  );
}
```

- [ ] **Step 2: Create ColorPicker component**

```tsx
// components/color-picker.tsx
'use client';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  return (
    <div className="flex-1">
      <div className="text-[#666] text-xs mb-1">{label}</div>
      <div className="flex items-center gap-2 bg-[#111] border border-[#333] rounded-lg px-3 py-2">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
        />
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bg-transparent text-[#aaa] text-xs w-20 outline-none"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create ImageGenerator component**

```tsx
// components/image-generator.tsx
'use client';

import { useState } from 'react';

interface ImageGeneratorProps {
  studioId: string;
  assetType: 'person' | 'background' | 'generated';
  onGenerated: (path: string) => void;
}

export function ImageGenerator({ studioId, assetType, onGenerated }: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [generatedPath, setGeneratedPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, studioId, assetType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data.base64);
      setGeneratedPath(data.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler bei der Bildgenerierung');
    } finally {
      setLoading(false);
    }
  };

  const accept = () => {
    if (generatedPath) {
      onGenerated(generatedPath);
      setPreview(null);
      setGeneratedPath(null);
      setPrompt('');
    }
  };

  return (
    <div className="bg-[#111] border border-dashed border-[#FF4500] rounded-lg p-4">
      <div className="text-[#FF4500] text-sm font-semibold mb-2">AI Bildgenerierung</div>
      <textarea
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="Beschreibe das Bild das du brauchst..."
        className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm resize-none h-20 outline-none mb-2"
      />
      <button
        onClick={generate}
        disabled={loading || !prompt}
        className="w-full bg-[#FF4500] hover:bg-[#e63e00] disabled:opacity-50 text-white font-bold py-2 rounded-lg text-sm transition-colors"
      >
        {loading ? 'Generiere...' : 'Bild generieren ✨'}
      </button>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      {preview && (
        <div className="mt-3">
          <img src={preview} alt="Generated" className="w-full rounded-lg mb-2" />
          <div className="flex gap-2">
            <button onClick={accept} className="flex-1 bg-[#4CAF50] text-white py-2 rounded-lg text-sm font-semibold">
              Übernehmen
            </button>
            <button onClick={generate} className="flex-1 bg-[#222] border border-[#333] text-[#ccc] py-2 rounded-lg text-sm">
              Neu generieren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create Onboarding page**

```tsx
// app/onboarding/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { ColorPicker } from '@/components/color-picker';
import { FileUpload } from '@/components/file-upload';
import { ImageGenerator } from '@/components/image-generator';
import { DEFAULT_PROMPTS } from '@/lib/prompts';
import type { Studio } from '@/lib/types';

const FONTS = ['Montserrat', 'Oswald', 'Bebas Neue', 'Roboto Condensed', 'Anton', 'Teko'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [studioId] = useState(uuidv4());

  // Step 1 state
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#FF4500');
  const [secondaryColor, setSecondaryColor] = useState('#1a1a2e');
  const [accentColor, setAccentColor] = useState('#FF6B00');
  const [font, setFont] = useState('Montserrat');

  // Step 2 state
  const [backgroundPaths, setBackgroundPaths] = useState<string[]>([]);
  const [personPaths, setPersonPaths] = useState<string[]>([]);

  // Step 3 state
  const [copyPrompt, setCopyPrompt] = useState(DEFAULT_PROMPTS['copy-generation']);
  const [templatePrompt, setTemplatePrompt] = useState(DEFAULT_PROMPTS['template-generation']);

  const uploadFiles = async (files: File[], type: 'background' | 'person') => {
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('studioId', studioId);
      formData.append('type', type);
      const res = await fetch('/api/assets/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (type === 'background') {
        setBackgroundPaths(prev => [...prev, data.path]);
      } else {
        setPersonPaths(prev => [...prev, data.path]);
      }
    }
  };

  const createStudio = async () => {
    const studio: Studio = {
      id: studioId,
      name,
      location,
      primaryColor,
      secondaryColor,
      accentColor,
      backgroundImages: backgroundPaths,
      personImages: personPaths,
      generatedImages: [],
      defaultFont: font,
      createdAt: new Date().toISOString(),
    };
    await fetch('/api/studios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studio),
    });

    // Save custom prompts if changed
    if (copyPrompt !== DEFAULT_PROMPTS['copy-generation']) {
      await fetch('/api/studios/' + studioId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studio),
      });
    }

    router.push(`/studio/${studioId}/creatives`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step > s ? 'bg-[#222] border-2 border-[#4CAF50] text-[#4CAF50]' :
                step === s ? 'bg-[#FF4500] text-white' : 'bg-[#222] text-[#666]'
              }`}>
                {step > s ? '✓' : s}
              </div>
              {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-[#4CAF50]' : 'bg-[#333]'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Grunddaten */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold mb-1">Studio-Grunddaten</h2>
            <p className="text-[#666] text-sm mb-6">Name, Standort und Branding deines Studios</p>

            <div className="space-y-4">
              <div>
                <label className="text-[#aaa] text-xs uppercase tracking-wider">Studioname</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-3 text-white mt-1 outline-none focus:border-[#FF4500]"
                  placeholder="z.B. FitX Power Gym" />
              </div>
              <div>
                <label className="text-[#aaa] text-xs uppercase tracking-wider">Standort</label>
                <input value={location} onChange={e => setLocation(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-3 text-white mt-1 outline-none focus:border-[#FF4500]"
                  placeholder="z.B. Weissenthurm" />
              </div>
              <div>
                <label className="text-[#aaa] text-xs uppercase tracking-wider mb-2 block">Farben</label>
                <div className="flex gap-3">
                  <ColorPicker label="Primär" value={primaryColor} onChange={setPrimaryColor} />
                  <ColorPicker label="Sekundär" value={secondaryColor} onChange={setSecondaryColor} />
                  <ColorPicker label="Akzent" value={accentColor} onChange={setAccentColor} />
                </div>
              </div>
              <div>
                <label className="text-[#aaa] text-xs uppercase tracking-wider">Font</label>
                <select value={font} onChange={e => setFont(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-3 text-white mt-1 outline-none">
                  {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>

            <button onClick={() => setStep(2)} disabled={!name || !location}
              className="w-full bg-[#FF4500] hover:bg-[#e63e00] disabled:opacity-50 text-white font-bold py-3 rounded-lg mt-6 transition-colors">
              Weiter →
            </button>
          </div>
        )}

        {/* Step 2: Assets */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold mb-1">Assets hochladen</h2>
            <p className="text-[#666] text-sm mb-6">Bilder für deine Creatives -- hochladen oder per AI generieren</p>

            <div className="space-y-6">
              <div>
                <label className="text-[#aaa] text-xs uppercase tracking-wider mb-2 block">Hintergrundbilder (Gym-Fotos)</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {backgroundPaths.map((p, i) => (
                    <div key={i} className="w-20 h-20 bg-[#1a1a1a] border border-[#333] rounded-lg overflow-hidden">
                      <div className="w-full h-full bg-[#2a2a2a]" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <FileUpload onFiles={files => uploadFiles(files, 'background')} label="+ Hochladen" />
                  </div>
                </div>
                <div className="mt-2">
                  <ImageGenerator studioId={studioId} assetType="background" onGenerated={p => setBackgroundPaths(prev => [...prev, p])} />
                </div>
              </div>

              <div>
                <label className="text-[#aaa] text-xs uppercase tracking-wider mb-1 block">Personen-Bilder</label>
                <p className="text-[#555] text-xs mb-2">Transparenter Hintergrund empfohlen</p>
                <div className="flex gap-2 flex-wrap mb-2">
                  {personPaths.map((p, i) => (
                    <div key={i} className="w-20 h-20 bg-[#1a1a1a] border border-[#333] rounded-lg" />
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <FileUpload onFiles={files => uploadFiles(files, 'person')} accept="image/png" label="+ Hochladen (PNG)" />
                  </div>
                </div>
                <div className="mt-2">
                  <ImageGenerator studioId={studioId} assetType="person" onGenerated={p => setPersonPaths(prev => [...prev, p])} />
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setStep(1)} className="bg-[#222] border border-[#333] text-[#aaa] rounded-lg px-6 py-3 transition-colors">
                ← Zurück
              </button>
              <button onClick={() => setStep(3)} className="flex-1 bg-[#FF4500] hover:bg-[#e63e00] text-white font-bold py-3 rounded-lg transition-colors">
                Weiter →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Stil */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-bold mb-1">Stil prüfen</h2>
            <p className="text-[#666] text-sm mb-6">Passe die AI-Prompts an den Stil deines Studios an</p>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[#aaa] text-xs uppercase tracking-wider">Headline-Stil</label>
                  <button onClick={() => setCopyPrompt(DEFAULT_PROMPTS['copy-generation'])}
                    className="text-[#666] text-xs border border-[#333] rounded px-2 py-0.5 hover:text-white">Standard</button>
                </div>
                <p className="text-[#555] text-xs mb-2">Steuert wie die AI Headlines und CTAs für dein Studio generiert</p>
                <textarea value={copyPrompt} onChange={e => setCopyPrompt(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-lg p-3 text-[#aaa] text-xs h-24 resize-none outline-none focus:border-[#FF4500]" />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[#aaa] text-xs uppercase tracking-wider">Template-Stil</label>
                  <button onClick={() => setTemplatePrompt(DEFAULT_PROMPTS['template-generation'])}
                    className="text-[#666] text-xs border border-[#333] rounded px-2 py-0.5 hover:text-white">Standard</button>
                </div>
                <p className="text-[#555] text-xs mb-2">Steuert wie die AI neue Templates für dein Studio designt</p>
                <textarea value={templatePrompt} onChange={e => setTemplatePrompt(e.target.value)}
                  className="w-full bg-[#111] border border-[#333] rounded-lg p-3 text-[#aaa] text-xs h-24 resize-none outline-none focus:border-[#FF4500]" />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={() => setStep(2)} className="bg-[#222] border border-[#333] text-[#aaa] rounded-lg px-6 py-3">
                ← Zurück
              </button>
              <button onClick={createStudio} className="flex-1 bg-[#4CAF50] hover:bg-[#45a049] text-white font-bold py-3 rounded-lg transition-colors">
                Studio erstellen ✓
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify onboarding renders**

Run `npm run dev:next`, navigate to http://localhost:3000, click "Neues Studio", verify 3-step wizard renders and navigation between steps works.

- [ ] **Step 6: Commit**

```bash
git add app/onboarding/ components/file-upload.tsx components/color-picker.tsx components/image-generator.tsx
git commit -m "feat: add 3-step onboarding flow with file upload and AI image generation"
```

---

## Task 13: Studio Layout + Sidebar

**Files:**
- Create: `app/studio/[id]/layout.tsx`
- Create: `components/sidebar.tsx`

- [ ] **Step 1: Create Sidebar component**

```tsx
// components/sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { icon: '✏️', label: 'Creatives', path: 'creatives' },
  { icon: '🎨', label: 'Templates', path: 'templates' },
  { icon: '📷', label: 'Assets', path: 'assets' },
  { icon: '⚙️', label: 'Einstellungen', path: 'settings' },
];

export function Sidebar({ studioId, studioName }: { studioId: string; studioName?: string }) {
  const pathname = usePathname();

  return (
    <div className="w-[52px] hover:w-[200px] bg-[#111] border-r border-[#222] flex flex-col py-4 transition-all duration-200 overflow-hidden group flex-shrink-0">
      {/* Studio name / home link */}
      <Link href="/" className="px-[10px] mb-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-[#FF4500] rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {studioName?.[0] || 'S'}
        </div>
        <span className="text-white text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          {studioName || 'Studio'}
        </span>
      </Link>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 px-[10px]">
        {NAV_ITEMS.map(item => {
          const href = `/studio/${studioId}/${item.path}`;
          const isActive = pathname === href;
          return (
            <Link key={item.path} href={href}
              className={`flex items-center gap-3 rounded-lg px-2 py-2 transition-colors ${
                isActive ? 'bg-[#FF4500]' : 'hover:bg-[#1a1a1a]'
              }`}>
              <span className="text-base flex-shrink-0 w-8 text-center">{item.icon}</span>
              <span className="text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
```

- [ ] **Step 2: Create Studio layout**

```tsx
// app/studio/[id]/layout.tsx
import { Sidebar } from '@/components/sidebar';
import { getStorage } from '@/lib/storage';

export default async function StudioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storage = getStorage();
  await storage.init();
  const studio = await storage.getStudio(id);

  return (
    <div className="flex h-screen">
      <Sidebar studioId={id} studioName={studio?.name} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Create placeholder pages for all studio routes**

```tsx
// app/studio/[id]/creatives/page.tsx
export default function CreativesPage() {
  return <div className="p-6"><h1 className="text-xl font-bold">Creative Generator</h1><p className="text-[#666] mt-2">Wird als nächstes gebaut...</p></div>;
}
```

```tsx
// app/studio/[id]/templates/page.tsx
export default function TemplatesPage() {
  return <div className="p-6"><h1 className="text-xl font-bold">Templates</h1><p className="text-[#666] mt-2">Wird als nächstes gebaut...</p></div>;
}
```

```tsx
// app/studio/[id]/assets/page.tsx
export default function AssetsPage() {
  return <div className="p-6"><h1 className="text-xl font-bold">Asset Library</h1><p className="text-[#666] mt-2">Wird als nächstes gebaut...</p></div>;
}
```

```tsx
// app/studio/[id]/settings/page.tsx
export default function SettingsPage() {
  return <div className="p-6"><h1 className="text-xl font-bold">Einstellungen</h1><p className="text-[#666] mt-2">Wird als nächstes gebaut...</p></div>;
}
```

- [ ] **Step 4: Verify studio layout and sidebar**

Navigate to http://localhost:3000, create a studio via onboarding, verify the sidebar appears with 4 icons and expands on hover.

- [ ] **Step 5: Commit**

```bash
git add app/studio/ components/sidebar.tsx
git commit -m "feat: add studio layout with collapsible icon sidebar"
```

---

## Task 14: Asset Library Page

**Files:**
- Modify: `app/studio/[id]/assets/page.tsx`
- Create: `components/asset-grid.tsx`

- [ ] **Step 1: Create AssetGrid component**

```tsx
// components/asset-grid.tsx
'use client';

interface AssetGridProps {
  assets: string[];
  selected?: string;
  onSelect?: (path: string) => void;
  onDelete?: (path: string) => void;
  size?: 'sm' | 'md';
}

export function AssetGrid({ assets, selected, onSelect, onDelete, size = 'md' }: AssetGridProps) {
  const sizeClass = size === 'sm' ? 'w-12 h-12' : 'w-20 h-20';

  return (
    <div className="flex gap-2 flex-wrap">
      {assets.map((path, i) => {
        // Convert filesystem path to a serveable URL
        const url = path.includes('data/assets/')
          ? `/api/assets/serve?path=${encodeURIComponent(path)}`
          : path;

        return (
          <div
            key={i}
            onClick={() => onSelect?.(path)}
            className={`${sizeClass} relative rounded-lg overflow-hidden border-2 cursor-pointer transition-colors ${
              selected === path ? 'border-[#FF4500]' : 'border-[#333] hover:border-[#555]'
            }`}
          >
            <img src={url} alt="" className="w-full h-full object-cover" />
            {onDelete && (
              <button
                onClick={e => { e.stopPropagation(); onDelete(path); }}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 rounded text-white text-xs flex items-center justify-center hover:bg-red-600"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create asset serve API route**

```typescript
// app/api/assets/serve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest) {
  const assetPath = req.nextUrl.searchParams.get('path');
  if (!assetPath) return NextResponse.json({ error: 'path required' }, { status: 400 });

  try {
    const buffer = await fs.readFile(assetPath);
    const ext = path.extname(assetPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    };
    return new NextResponse(buffer, {
      headers: { 'Content-Type': mimeTypes[ext] || 'image/png' },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
```

- [ ] **Step 3: Implement Asset Library page**

```tsx
// app/studio/[id]/assets/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileUpload } from '@/components/file-upload';
import { AssetGrid } from '@/components/asset-grid';
import { ImageGenerator } from '@/components/image-generator';
import type { AssetType } from '@/lib/types';

const ASSET_SECTIONS: { type: AssetType; label: string; description: string }[] = [
  { type: 'background', label: 'Hintergrundbilder', description: 'Gym-Fotos für den Hintergrund deiner Creatives' },
  { type: 'person', label: 'Personen', description: 'Freigestellte Personen (PNG mit Transparenz)' },
  { type: 'logo', label: 'Logos', description: 'Studio-Logos' },
  { type: 'generated', label: 'AI-generiert', description: 'Per Imagen 4 generierte Bilder' },
];

export default function AssetsPage() {
  const { id: studioId } = useParams<{ id: string }>();
  const [assets, setAssets] = useState<Record<string, string[]>>({});
  const [showGenerator, setShowGenerator] = useState(false);

  const loadAssets = async () => {
    const res = await fetch(`/api/assets/${studioId}`);
    const allPaths: string[] = await res.json();

    // Group by type based on path
    const grouped: Record<string, string[]> = { background: [], person: [], logo: [], generated: [] };
    for (const p of allPaths) {
      for (const type of ['background', 'person', 'logo', 'generated']) {
        if (p.includes(`/${type}/`) || p.includes(`\\${type}\\`)) {
          grouped[type].push(p);
          break;
        }
      }
    }
    setAssets(grouped);
  };

  useEffect(() => { loadAssets(); }, [studioId]);

  const uploadFiles = async (files: File[], type: AssetType) => {
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('studioId', studioId);
      formData.append('type', type);
      await fetch('/api/assets/upload', { method: 'POST', body: formData });
    }
    loadAssets();
  };

  const deleteAsset = async (path: string) => {
    await fetch(`/api/assets/${studioId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    loadAssets();
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold">Asset Library</h1>
          <p className="text-[#666] text-sm mt-1">Verwalte alle Bilder für deine Creatives</p>
        </div>
        <button
          onClick={() => setShowGenerator(!showGenerator)}
          className="bg-[#FF4500] hover:bg-[#e63e00] text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
        >
          {showGenerator ? 'Schließen' : 'AI Bild generieren ✨'}
        </button>
      </div>

      {showGenerator && (
        <div className="mb-6">
          <ImageGenerator studioId={studioId} assetType="generated" onGenerated={() => loadAssets()} />
        </div>
      )}

      <div className="space-y-8">
        {ASSET_SECTIONS.map(section => (
          <div key={section.type}>
            <h2 className="text-sm font-semibold text-[#aaa] uppercase tracking-wider mb-1">{section.label}</h2>
            <p className="text-[#555] text-xs mb-3">{section.description}</p>
            <AssetGrid
              assets={assets[section.type] || []}
              onDelete={deleteAsset}
            />
            <div className="mt-2">
              <FileUpload
                onFiles={files => uploadFiles(files, section.type)}
                accept={section.type === 'person' ? 'image/png' : 'image/*'}
                label={`+ ${section.label} hochladen`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add app/studio/*/assets/ components/asset-grid.tsx app/api/assets/serve/
git commit -m "feat: add asset library page with upload, AI generation, and grid view"
```

---

## Task 15: Template Management Page

**Files:**
- Modify: `app/studio/[id]/templates/page.tsx`
- Create: `components/template-card.tsx`
- Create: `components/css-var-slider.tsx`
- Create: `components/live-preview.tsx`

- [ ] **Step 1: Create LivePreview component**

```tsx
// components/live-preview.tsx
'use client';

import { useEffect, useRef } from 'react';

interface LivePreviewProps {
  html: string;
  width: number;
  height: number;
  fieldValues: Record<string, string>;
}

export function LivePreview({ html, width, height, fieldValues }: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!iframeRef.current || !html) return;

    // Replace placeholders
    let rendered = html;
    const allValues = { ...fieldValues, width: String(width), height: String(height) };
    for (const [key, value] of Object.entries(allValues)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    iframeRef.current.srcdoc = rendered;
  }, [html, width, height, fieldValues]);

  // Scale to fit container
  const maxDisplayWidth = 400;
  const scale = Math.min(1, maxDisplayWidth / width);

  return (
    <div className="flex flex-col items-center">
      <div className="text-[#444] text-xs mb-2">
        VORSCHAU · {width}×{height}
      </div>
      <div
        style={{
          width: width * scale,
          height: height * scale,
          overflow: 'hidden',
          borderRadius: '4px',
          border: '1px solid #222',
        }}
      >
        <iframe
          ref={iframeRef}
          style={{
            width,
            height,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            border: 'none',
          }}
          sandbox="allow-same-origin"
          title="Creative Preview"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create CssVarSlider component**

```tsx
// components/css-var-slider.tsx
'use client';

interface CssVarSliderProps {
  variables: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

const SLIDER_CONFIG: Record<string, { min: number; max: number; step: number; unit: string }> = {
  '--bg-blur': { min: 0, max: 20, step: 1, unit: 'px' },
  '--bg-brightness': { min: 0, max: 1, step: 0.05, unit: '' },
  '--headline-size': { min: 24, max: 120, step: 2, unit: 'px' },
  '--price-size': { min: 32, max: 160, step: 2, unit: 'px' },
  '--person-scale': { min: 0.3, max: 1.5, step: 0.05, unit: '' },
  '--person-position-y': { min: -20, max: 30, step: 1, unit: '%' },
  '--location-size': { min: 14, max: 48, step: 1, unit: 'px' },
  '--strikethrough-size': { min: 14, max: 48, step: 1, unit: 'px' },
};

function parseNumericValue(val: string): number {
  return parseFloat(val) || 0;
}

function varLabel(key: string): string {
  return key.replace(/^--/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function CssVarSlider({ variables, onChange }: CssVarSliderProps) {
  return (
    <div className="space-y-3">
      {Object.entries(variables).map(([key, value]) => {
        const config = SLIDER_CONFIG[key];
        if (!config) return null;

        const numValue = parseNumericValue(value);

        return (
          <div key={key}>
            <div className="flex justify-between text-xs text-[#aaa] mb-1">
              <span>{varLabel(key)}</span>
              <span>{numValue}{config.unit}</span>
            </div>
            <input
              type="range"
              min={config.min}
              max={config.max}
              step={config.step}
              value={numValue}
              onChange={e => onChange(key, `${e.target.value}${config.unit}`)}
              className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer accent-[#FF4500]"
            />
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create TemplateCard component**

```tsx
// components/template-card.tsx
'use client';

import type { SavedTemplate } from '@/lib/types';

interface TemplateCardProps {
  template: SavedTemplate;
  onUse: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function TemplateCard({ template, onUse, onEdit, onDuplicate, onDelete }: TemplateCardProps) {
  return (
    <div className="bg-[#111] border border-[#333] rounded-xl overflow-hidden">
      <div className="h-36 bg-[#1a1a1a] flex items-center justify-center text-[#444] text-sm">
        {template.thumbnail ? (
          <img src={template.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <span>Vorschau</span>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-white font-semibold text-sm">{template.name}</h3>
        <p className="text-[#666] text-xs mt-0.5">{template.type} · v{template.version}</p>
        <div className="flex gap-1.5 mt-3">
          <button onClick={onUse} className="flex-1 bg-[#FF4500] text-white text-xs py-1.5 rounded-md font-semibold">
            Verwenden
          </button>
          <button onClick={onEdit} className="flex-1 bg-[#222] border border-[#333] text-[#ccc] text-xs py-1.5 rounded-md">
            Editieren
          </button>
          <div className="relative group">
            <button className="bg-[#222] border border-[#333] text-[#666] text-xs py-1.5 px-2 rounded-md">⋯</button>
            <div className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg py-1 hidden group-hover:block z-10 min-w-[120px]">
              <button onClick={onDuplicate} className="w-full text-left px-3 py-1.5 text-xs text-[#ccc] hover:bg-[#222]">Duplizieren</button>
              <button onClick={onDelete} className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-[#222]">Löschen</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement Templates page with list + editor**

```tsx
// app/studio/[id]/templates/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { TemplateCard } from '@/components/template-card';
import { LivePreview } from '@/components/live-preview';
import { CssVarSlider } from '@/components/css-var-slider';
import { extractPlaceholders, extractCssVariables, placeholdersToDynamicFields } from '@/lib/template-utils';
import { FORMAT_DIMENSIONS } from '@/lib/formats';
import type { SavedTemplate, CreativeFormat } from '@/lib/types';

export default function TemplatesPage() {
  const { id: studioId } = useParams<{ id: string }>();
  const router = useRouter();
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [editing, setEditing] = useState<SavedTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState<CreativeFormat>('instagram-post');
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [cssVars, setCssVars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const loadTemplates = async () => {
    const res = await fetch(`/api/templates?studioId=${studioId}`);
    // Also load global templates
    const res2 = await fetch('/api/templates');
    const studioTemplates = await res.json();
    const allTemplates: SavedTemplate[] = await res2.json();
    // Merge: studio-specific + global (without duplicates)
    const ids = new Set(studioTemplates.map((t: SavedTemplate) => t.id));
    const globals = allTemplates.filter(t => !t.studioId && !ids.has(t.id));
    setTemplates([...studioTemplates, ...globals]);
  };

  useEffect(() => { loadTemplates(); }, [studioId]);

  const generateTemplate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/generate-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          format,
          studioId,
          baseTemplate: editing?.htmlContent || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGeneratedHtml(data.html);
      setCssVars(data.cssVariables || {});
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  const handleCssVarChange = (key: string, value: string) => {
    setCssVars(prev => ({ ...prev, [key]: value }));
    // Update the HTML with the new CSS variable value
    setGeneratedHtml(prev => {
      return prev.replace(
        new RegExp(`(${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*)([^;]+)`),
        `$1${value}`,
      );
    });
  };

  const saveTemplate = async () => {
    const placeholders = extractPlaceholders(generatedHtml);
    const fields = placeholdersToDynamicFields(placeholders);

    const template: SavedTemplate = {
      id: editing?.id || uuidv4(),
      name: templateName || `Template ${new Date().toLocaleDateString('de')}`,
      studioId,
      type: 'custom',
      htmlContent: generatedHtml,
      cssVariables: cssVars,
      dynamicFields: fields,
      version: editing ? editing.version + 1 : 1,
      createdAt: editing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await fetch(editing ? `/api/templates/${template.id}` : '/api/templates', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    });

    setEditing(null);
    setCreating(false);
    setGeneratedHtml('');
    setPrompt('');
    setTemplateName('');
    loadTemplates();
  };

  const deleteTemplate = async (id: string) => {
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    loadTemplates();
  };

  const duplicateTemplate = async (template: SavedTemplate) => {
    const dup: SavedTemplate = {
      ...template,
      id: uuidv4(),
      name: `${template.name} (Kopie)`,
      studioId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dup),
    });
    loadTemplates();
  };

  const dims = FORMAT_DIMENSIONS[format];

  // Editor view
  if (creating || editing) {
    return (
      <div className="flex h-full">
        {/* Left: Prompt + CSS vars */}
        <div className="w-80 bg-[#111] border-r border-[#222] p-4 overflow-y-auto flex-shrink-0">
          <button onClick={() => { setCreating(false); setEditing(null); setGeneratedHtml(''); }}
            className="text-[#666] text-sm mb-4 hover:text-white">← Zurück</button>

          <h2 className="text-white font-bold mb-4">{editing ? 'Template editieren' : 'Neues Template'}</h2>

          <div className="mb-4">
            <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Name</label>
            <input value={templateName} onChange={e => setTemplateName(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm outline-none"
              placeholder="Template-Name" />
          </div>

          <div className="mb-4">
            <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Format</label>
            <select value={format} onChange={e => setFormat(e.target.value as CreativeFormat)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm outline-none">
              {Object.entries(FORMAT_DIMENSIONS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>

          <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">AI-Anpassung</label>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm resize-none h-24 outline-none mb-2"
            placeholder={editing
              ? 'z.B. Mach den Preis größer und füge einen Neon-Glow hinzu...'
              : 'Beschreibe das Template das du brauchst...'} />
          <button onClick={generateTemplate} disabled={loading || !prompt}
            className="w-full bg-[#FF4500] hover:bg-[#e63e00] disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm mb-4">
            {loading ? 'Generiere...' : editing ? 'Anpassen mit AI ✨' : 'Generieren ✨'}
          </button>

          {Object.keys(cssVars).length > 0 && (
            <>
              <label className="text-[#888] text-xs uppercase tracking-wider mb-2 block">CSS-Variablen</label>
              <CssVarSlider variables={cssVars} onChange={handleCssVarChange} />
            </>
          )}

          {generatedHtml && (
            <div className="flex gap-2 mt-6">
              <button onClick={saveTemplate}
                className="flex-1 bg-[#FF4500] text-white font-bold py-2.5 rounded-lg text-sm">
                Speichern
              </button>
            </div>
          )}
        </div>

        {/* Right: Preview */}
        <div className="flex-1 flex items-center justify-center bg-[#0a0a0a] p-6">
          {generatedHtml ? (
            <LivePreview html={generatedHtml} width={dims.width} height={dims.height} fieldValues={{}} />
          ) : (
            <div className="text-[#444] text-sm">Generiere ein Template um die Vorschau zu sehen</div>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold">Templates</h1>
          <p className="text-[#666] text-sm mt-1">{templates.length} Templates</p>
        </div>
        <button onClick={() => setCreating(true)}
          className="bg-[#FF4500] hover:bg-[#e63e00] text-white font-bold py-2 px-4 rounded-lg text-sm">
          + Neues Template per AI
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(t => (
          <TemplateCard
            key={t.id}
            template={t}
            onUse={() => router.push(`/studio/${studioId}/creatives?templateId=${t.id}`)}
            onEdit={() => {
              setEditing(t);
              setGeneratedHtml(t.htmlContent);
              setCssVars(t.cssVariables);
              setTemplateName(t.name);
            }}
            onDuplicate={() => duplicateTemplate(t)}
            onDelete={() => deleteTemplate(t.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add app/studio/*/templates/ components/template-card.tsx components/css-var-slider.tsx components/live-preview.tsx
git commit -m "feat: add template management with AI generation, CSS sliders, and live preview"
```

---

## Task 16: Creative Generator Dashboard

**Files:**
- Modify: `app/studio/[id]/creatives/page.tsx`
- Create: `components/format-selector.tsx`
- Create: `components/headline-suggestions.tsx`
- Create: `components/batch-panel.tsx`

- [ ] **Step 1: Create FormatSelector component**

```tsx
// components/format-selector.tsx
'use client';

import { FORMAT_DIMENSIONS } from '@/lib/formats';
import type { CreativeFormat } from '@/lib/types';

interface FormatSelectorProps {
  selected: CreativeFormat;
  onChange: (format: CreativeFormat) => void;
}

export function FormatSelector({ selected, onChange }: FormatSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {Object.entries(FORMAT_DIMENSIONS).map(([key, val]) => (
        <button
          key={key}
          onClick={() => onChange(key as CreativeFormat)}
          className={`text-xs py-1.5 px-2 rounded-md font-medium transition-colors ${
            selected === key
              ? 'bg-[#FF4500] text-white'
              : 'bg-[#1a1a1a] border border-[#333] text-[#888] hover:text-white'
          }`}
        >
          {val.width}×{val.height}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create HeadlineSuggestions component**

```tsx
// components/headline-suggestions.tsx
'use client';

import { useState } from 'react';

interface HeadlineSuggestionsProps {
  studioId: string;
  price?: string;
  originalPrice?: string;
  onSelect: (headline: string) => void;
}

export function HeadlineSuggestions({ studioId, price, originalPrice, onSelect }: HeadlineSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<{ headline: string; subline?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const generate = async () => {
    setLoading(true);
    setOpen(true);
    try {
      const res = await fetch('/api/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioId, price, originalPrice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuggestions(data.variants || []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button onClick={generate}
        className="bg-[#FF4500] hover:bg-[#e63e00] rounded-lg px-3 py-2.5 text-white text-xs whitespace-nowrap font-semibold">
        {loading ? '...' : 'Vorschläge ✨'}
      </button>

      {open && suggestions.length > 0 && (
        <div className="absolute top-full right-0 mt-1 bg-[#1a1a1a] border border-[#333] rounded-lg py-1 z-20 min-w-[250px] shadow-xl">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => { onSelect(s.headline); setOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-[#222] transition-colors">
              <div className="text-white text-sm font-semibold">{s.headline}</div>
              {s.subline && <div className="text-[#666] text-xs">{s.subline}</div>}
            </button>
          ))}
          <button onClick={() => setOpen(false)} className="w-full text-center text-[#555] text-xs py-1.5 hover:text-white">
            Schließen
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create BatchPanel component**

```tsx
// components/batch-panel.tsx
'use client';

import { useState } from 'react';
import type { CreativeOutput } from '@/lib/types';

interface BatchPanelProps {
  outputs: CreativeOutput[];
  onDownload: (outputPath: string) => void;
  onDownloadAll: () => void;
}

export function BatchPanel({ outputs, onDownload, onDownloadAll }: BatchPanelProps) {
  return (
    <div>
      <div className="text-[#888] text-xs uppercase tracking-wider mb-3">Generierte Creatives</div>

      {outputs.length === 0 ? (
        <div className="text-[#444] text-xs text-center py-8">
          Noch keine Creatives gerendert
        </div>
      ) : (
        <div className="space-y-2">
          {outputs.map((output, i) => (
            <div key={i} className="bg-[#1a1a1a] border border-[#333] rounded-lg p-2">
              {output.outputPath && output.status === 'done' && (
                <img src={`/output/${output.outputPath.split('/output/').pop()}`} alt=""
                  className="w-full h-20 object-cover rounded mb-1.5" />
              )}
              <div className="flex justify-between items-center">
                <span className="text-[#888] text-xs">{output.format}</span>
                <span className={`text-xs ${
                  output.status === 'done' ? 'text-[#4CAF50]' :
                  output.status === 'rendering' ? 'text-[#FF4500]' :
                  output.status === 'error' ? 'text-red-400' : 'text-[#666]'
                }`}>
                  {output.status === 'done' ? '✓ Fertig' :
                   output.status === 'rendering' ? 'Rendering...' :
                   output.status === 'error' ? 'Fehler' : 'Warten...'}
                </span>
              </div>
              {output.status === 'done' && output.outputPath && (
                <button onClick={() => onDownload(output.outputPath!)}
                  className="w-full mt-1.5 bg-[#222] border border-[#333] text-[#ccc] rounded py-1 text-xs hover:bg-[#333]">
                  ↓ Download PNG
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {outputs.some(o => o.status === 'done') && (
        <button onClick={onDownloadAll}
          className="w-full mt-4 bg-[#222] border border-[#444] text-[#ccc] rounded-lg py-2.5 text-sm hover:bg-[#333]">
          📦 Alle als ZIP
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement Creative Generator Dashboard**

```tsx
// app/studio/[id]/creatives/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { FormatSelector } from '@/components/format-selector';
import { HeadlineSuggestions } from '@/components/headline-suggestions';
import { AssetGrid } from '@/components/asset-grid';
import { LivePreview } from '@/components/live-preview';
import { BatchPanel } from '@/components/batch-panel';
import { replacePlaceholders } from '@/lib/template-utils';
import { FORMAT_DIMENSIONS, ALL_FORMATS } from '@/lib/formats';
import type { Studio, SavedTemplate, CreativeFormat, CreativeOutput } from '@/lib/types';

export default function CreativesPage() {
  const { id: studioId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const preselectedTemplateId = searchParams.get('templateId');

  const [studio, setStudio] = useState<Studio | null>(null);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SavedTemplate | null>(null);
  const [format, setFormat] = useState<CreativeFormat>('instagram-post');

  // Field values
  const [headline, setHeadline] = useState('MONATLICH KÜNDBAR');
  const [price, setPrice] = useState('39,90€');
  const [originalPrice, setOriginalPrice] = useState('89,90€');
  const [selectedPerson, setSelectedPerson] = useState('');
  const [selectedBg, setSelectedBg] = useState('');

  // Render state
  const [outputs, setOutputs] = useState<CreativeOutput[]>([]);
  const [rendering, setRendering] = useState(false);

  // Asset lists
  const [personAssets, setPersonAssets] = useState<string[]>([]);
  const [bgAssets, setBgAssets] = useState<string[]>([]);

  useEffect(() => {
    // Load studio, templates, assets
    Promise.all([
      fetch(`/api/studios/${studioId}`).then(r => r.json()),
      fetch(`/api/templates?studioId=${studioId}`).then(r => r.json()),
      fetch(`/api/templates`).then(r => r.json()),
      fetch(`/api/assets/${studioId}?type=person`).then(r => r.json()),
      fetch(`/api/assets/${studioId}?type=background`).then(r => r.json()),
    ]).then(([studioData, studioTemplates, allTemplates, persons, bgs]) => {
      setStudio(studioData);
      // Merge templates
      const ids = new Set(studioTemplates.map((t: SavedTemplate) => t.id));
      const globals = allTemplates.filter((t: SavedTemplate) => !t.studioId && !ids.has(t.id));
      const merged = [...studioTemplates, ...globals];
      setTemplates(merged);

      // Preselect template
      if (preselectedTemplateId) {
        const t = merged.find((t: SavedTemplate) => t.id === preselectedTemplateId);
        if (t) setSelectedTemplate(t);
      } else if (merged.length > 0) {
        setSelectedTemplate(merged[0]);
      }

      setPersonAssets(persons);
      setBgAssets(bgs);
    });
  }, [studioId, preselectedTemplateId]);

  const buildFieldValues = (): Record<string, string> => ({
    headline,
    price,
    originalPrice,
    location: studio?.location || '',
    primaryColor: studio?.primaryColor || '#FF4500',
    accentColor: studio?.accentColor || '#FF6B00',
    backgroundImage: selectedBg ? `/api/assets/serve?path=${encodeURIComponent(selectedBg)}` : '',
    personImage: selectedPerson ? `/api/assets/serve?path=${encodeURIComponent(selectedPerson)}` : '',
    logo: studio?.logo || '',
  });

  const dims = FORMAT_DIMENSIONS[format];

  const renderSingle = async () => {
    if (!selectedTemplate) return;
    setRendering(true);

    const values = { ...buildFieldValues(), width: String(dims.width), height: String(dims.height) };
    const html = replacePlaceholders(selectedTemplate.htmlContent, values);

    const newOutput: CreativeOutput = { format, status: 'rendering' };
    setOutputs(prev => [...prev, newOutput]);

    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, width: dims.width, height: dims.height }),
      });

      if (!res.ok) throw new Error('Render failed');

      const blob = await res.blob();
      const filename = `creative-${format}-${Date.now()}.png`;

      // Save the PNG to public/output via a data URL download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      // Don't auto-download, just store the URL

      setOutputs(prev => prev.map(o =>
        o === newOutput ? { ...o, status: 'done', outputPath: url } : o
      ));
    } catch (err) {
      setOutputs(prev => prev.map(o =>
        o === newOutput ? { ...o, status: 'error', error: 'Render fehlgeschlagen' } : o
      ));
    } finally {
      setRendering(false);
    }
  };

  const renderAllFormats = async () => {
    if (!selectedTemplate) return;
    setRendering(true);

    const newOutputs: CreativeOutput[] = ALL_FORMATS.map(f => ({ format: f, status: 'rendering' as const }));
    setOutputs(prev => [...prev, ...newOutputs]);

    await Promise.all(ALL_FORMATS.map(async (fmt, idx) => {
      const d = FORMAT_DIMENSIONS[fmt];
      const values = { ...buildFieldValues(), width: String(d.width), height: String(d.height) };
      const html = replacePlaceholders(selectedTemplate.htmlContent, values);

      try {
        const res = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html, width: d.width, height: d.height }),
        });
        if (!res.ok) throw new Error('Render failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        setOutputs(prev => prev.map((o, i) =>
          i === prev.length - ALL_FORMATS.length + idx ? { ...o, status: 'done', outputPath: url } : o
        ));
      } catch {
        setOutputs(prev => prev.map((o, i) =>
          i === prev.length - ALL_FORMATS.length + idx ? { ...o, status: 'error', error: 'Render failed' } : o
        ));
      }
    }));

    setRendering(false);
  };

  const downloadFile = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `creative-${Date.now()}.png`;
    a.click();
  };

  const downloadAllAsZip = async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const output of outputs.filter(o => o.status === 'done' && o.outputPath)) {
      const blob = await fetch(output.outputPath!).then(r => r.blob());
      zip.file(`creative-${output.format}-${Date.now()}.png`, blob);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `creatives-${studioId}-${Date.now()}.zip`;
    a.click();
  };

  return (
    <div className="flex h-full">
      {/* Left: Settings Panel */}
      <div className="w-[280px] bg-[#111] border-r border-[#222] overflow-y-auto flex-shrink-0 p-4 space-y-4">
        {/* Template */}
        <div>
          <label className="text-[#888] text-xs uppercase tracking-wider">Template</label>
          <select
            value={selectedTemplate?.id || ''}
            onChange={e => setSelectedTemplate(templates.find(t => t.id === e.target.value) || null)}
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm mt-1 outline-none"
          >
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* Format */}
        <div>
          <label className="text-[#888] text-xs uppercase tracking-wider mb-1.5 block">Format</label>
          <FormatSelector selected={format} onChange={setFormat} />
        </div>

        {/* Headline */}
        <div>
          <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Headline</label>
          <div className="flex gap-1.5">
            <input value={headline} onChange={e => setHeadline(e.target.value)}
              className="flex-1 bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm outline-none" />
            <HeadlineSuggestions studioId={studioId} price={price} originalPrice={originalPrice}
              onSelect={setHeadline} />
          </div>
        </div>

        {/* Price */}
        <div>
          <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Preis</label>
          <input value={price} onChange={e => setPrice(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-[#FF4500] text-sm font-bold outline-none" />
        </div>
        <div>
          <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Streichpreis</label>
          <input value={originalPrice} onChange={e => setOriginalPrice(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2.5 text-[#888] text-sm outline-none" />
        </div>

        {/* Person */}
        <div>
          <label className="text-[#888] text-xs uppercase tracking-wider mb-1.5 block">Person</label>
          <AssetGrid assets={personAssets} selected={selectedPerson} onSelect={setSelectedPerson} size="sm" />
        </div>

        {/* Background */}
        <div>
          <label className="text-[#888] text-xs uppercase tracking-wider mb-1.5 block">Hintergrund</label>
          <AssetGrid assets={bgAssets} selected={selectedBg} onSelect={setSelectedBg} size="sm" />
        </div>

        {/* Render buttons */}
        <button onClick={renderSingle} disabled={rendering || !selectedTemplate}
          className="w-full bg-[#FF4500] hover:bg-[#e63e00] disabled:opacity-50 text-white font-bold py-3 rounded-lg text-sm transition-colors">
          {rendering ? 'Rendert...' : 'Creative rendern →'}
        </button>
        <button onClick={renderAllFormats} disabled={rendering || !selectedTemplate}
          className="w-full bg-transparent border border-[#FF4500] text-[#FF4500] font-semibold py-2.5 rounded-lg text-xs hover:bg-[#FF4500]/10 transition-colors">
          Alle Formate rendern (4×)
        </button>
      </div>

      {/* Center: Preview */}
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0a] p-6">
        {selectedTemplate ? (
          <LivePreview
            html={selectedTemplate.htmlContent}
            width={dims.width}
            height={dims.height}
            fieldValues={buildFieldValues()}
          />
        ) : (
          <div className="text-[#444] text-sm">Wähle ein Template um die Vorschau zu sehen</div>
        )}
      </div>

      {/* Right: Output/Batch */}
      <div className="w-[220px] bg-[#111] border-l border-[#222] p-4 overflow-y-auto flex-shrink-0">
        <BatchPanel
          outputs={outputs}
          onDownload={downloadFile}
          onDownloadAll={downloadAllAsZip}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Install JSZip**

```bash
npm install jszip
```

- [ ] **Step 6: Commit**

```bash
git add app/studio/*/creatives/ components/format-selector.tsx components/headline-suggestions.tsx components/batch-panel.tsx
git commit -m "feat: add creative generator dashboard with live preview, AI headlines, and batch rendering"
```

---

## Task 17: Settings Page

**Files:**
- Modify: `app/studio/[id]/settings/page.tsx`

- [ ] **Step 1: Implement Settings page**

```tsx
// app/studio/[id]/settings/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ColorPicker } from '@/components/color-picker';
import { DEFAULT_PROMPTS } from '@/lib/prompts';
import type { Studio, PromptType } from '@/lib/types';

const PROMPT_SECTIONS: { type: PromptType; label: string; description: string }[] = [
  { type: 'copy-generation', label: 'Headline-Stil', description: 'Steuert wie die AI Headlines und CTAs für dein Studio generiert' },
  { type: 'template-generation', label: 'Template-Erstellung', description: 'Steuert wie die AI neue Templates für dein Studio designt' },
  { type: 'template-editing', label: 'Template-Anpassung', description: 'Steuert wie die AI bestehende Templates auf Anweisung ändert' },
];

const FONTS = ['Montserrat', 'Oswald', 'Bebas Neue', 'Roboto Condensed', 'Anton', 'Teko'];

export default function SettingsPage() {
  const { id: studioId } = useParams<{ id: string }>();
  const [studio, setStudio] = useState<Studio | null>(null);
  const [prompts, setPrompts] = useState<Record<PromptType, string>>({
    'copy-generation': '',
    'template-generation': '',
    'template-editing': '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/studios/${studioId}`).then(r => r.json()).then(setStudio);

    fetch(`/api/prompts/${studioId}`).then(r => r.json()).then(setPrompts);
  }, [studioId]);

  const saveStudio = async () => {
    if (!studio) return;
    setSaving(true);
    await fetch(`/api/studios/${studioId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studio),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!studio) return <div className="p-6 text-[#666]">Lade...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold mb-6">Einstellungen</h1>

      {/* Studio Data */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-[#aaa] uppercase tracking-wider mb-4">Studio-Daten</h2>
        <div className="space-y-3">
          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider">Name</label>
            <input value={studio.name} onChange={e => setStudio({ ...studio, name: e.target.value })}
              className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm mt-1 outline-none" />
          </div>
          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider">Standort</label>
            <input value={studio.location} onChange={e => setStudio({ ...studio, location: e.target.value })}
              className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm mt-1 outline-none" />
          </div>
          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider mb-2 block">Farben</label>
            <div className="flex gap-3">
              <ColorPicker label="Primär" value={studio.primaryColor} onChange={v => setStudio({ ...studio, primaryColor: v })} />
              <ColorPicker label="Sekundär" value={studio.secondaryColor} onChange={v => setStudio({ ...studio, secondaryColor: v })} />
              <ColorPicker label="Akzent" value={studio.accentColor} onChange={v => setStudio({ ...studio, accentColor: v })} />
            </div>
          </div>
          <div>
            <label className="text-[#888] text-xs uppercase tracking-wider">Font</label>
            <select value={studio.defaultFont} onChange={e => setStudio({ ...studio, defaultFont: e.target.value })}
              className="w-full bg-[#111] border border-[#333] rounded-lg px-3 py-2.5 text-white text-sm mt-1 outline-none">
              {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <button onClick={saveStudio} disabled={saving}
            className="bg-[#FF4500] hover:bg-[#e63e00] disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors">
            {saving ? 'Speichert...' : saved ? 'Gespeichert ✓' : 'Speichern'}
          </button>
        </div>
      </section>

      {/* System Prompts */}
      <section>
        <h2 className="text-sm font-semibold text-[#aaa] uppercase tracking-wider mb-4">AI-Prompts</h2>
        <div className="space-y-6">
          {PROMPT_SECTIONS.map(section => (
            <div key={section.type}>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[#aaa] text-xs uppercase tracking-wider">{section.label}</label>
                <button onClick={() => setPrompts(p => ({ ...p, [section.type]: DEFAULT_PROMPTS[section.type] }))}
                  className="text-[#666] text-xs border border-[#333] rounded px-2 py-0.5 hover:text-white">
                  Standard
                </button>
              </div>
              <p className="text-[#555] text-xs mb-2">{section.description}</p>
              <textarea
                value={prompts[section.type]}
                onChange={e => setPrompts(p => ({ ...p, [section.type]: e.target.value }))}
                className="w-full bg-[#111] border border-[#333] rounded-lg p-3 text-[#aaa] text-xs h-32 resize-none outline-none focus:border-[#FF4500]"
              />
            </div>
          ))}
          <button
            onClick={async () => {
              setSaving(true);
              await fetch(`/api/prompts/${studioId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(prompts),
              });
              setSaving(false);
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
            className="bg-[#FF4500] hover:bg-[#e63e00] disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors"
          >
            Prompts speichern
          </button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Add prompt save/load API route**

```typescript
// app/api/prompts/[studioId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { DEFAULT_PROMPTS } from '@/lib/prompts';
import type { PromptType } from '@/lib/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ studioId: string }> }) {
  const { studioId } = await params;
  const storage = getStorage();
  await storage.init();

  const result: Record<string, string> = {};
  for (const type of ['copy-generation', 'template-generation', 'template-editing'] as PromptType[]) {
    const custom = await storage.getSystemPrompt(studioId, type);
    result[type] = custom || DEFAULT_PROMPTS[type];
  }
  return NextResponse.json(result);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ studioId: string }> }) {
  const { studioId } = await params;
  const prompts = await req.json();
  const storage = getStorage();
  await storage.init();

  for (const [type, prompt] of Object.entries(prompts)) {
    await storage.saveSystemPrompt(studioId, type as PromptType, prompt as string);
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/studio/*/settings/ app/api/prompts/
git commit -m "feat: add settings page with studio data editing and system prompt editor"
```

---

## Task 18: End-to-End Smoke Test

**Files:** none created — this is a verification task

- [ ] **Step 1: Start both servers**

```bash
npm run dev
```

Verify both processes start:
- `next` on http://localhost:3000
- `render` on http://localhost:3001

- [ ] **Step 2: Verify home page**

Navigate to http://localhost:3000. Expect dark UI, "Creative Generator" header, empty state.

- [ ] **Step 3: Create a studio via onboarding**

Click "Studio anlegen" → fill in:
- Name: "FitX Power Gym"
- Standort: "Weissenthurm"
- Colors: keep defaults
- Font: Montserrat

Click "Weiter" → upload a background image and person PNG (or skip), click "Weiter" → review prompts → "Studio erstellen".

Verify: redirected to `/studio/[id]/creatives`, sidebar visible.

- [ ] **Step 4: Verify template is available**

Navigate to Templates tab. Verify "Preis-Angebot (Referenz-Stil)" template appears (seeded in Task 6).

- [ ] **Step 5: Generate a creative**

Go to Creatives tab:
- Select the reference template
- Select format (1080×1080)
- Type a headline: "MONATLICH KÜNDBAR"
- Enter price: "39,90€"
- Enter Streichpreis: "89,90€"
- Verify live preview updates

Click "Creative rendern" → verify PNG appears in the output panel.

Click "Alle Formate rendern (4×)" → verify 4 renders complete.

- [ ] **Step 6: Test AI template generation**

Go to Templates → "Neues Template per AI":
- Enter prompt: "Aggressives Preis-Angebot mit Neon-Glow Effekt"
- Select format
- Click "Generieren"
- Verify HTML appears in preview
- Save the template

- [ ] **Step 7: Test rendering server health**

```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "chore: complete MVP smoke test — all flows working"
```

---

## Summary

| Task | What it builds | Key files |
|------|---------------|-----------|
| 1 | Project scaffolding | package.json, rendering-server/, vitest.config.ts |
| 2 | TypeScript types | lib/types.ts, lib/formats.ts |
| 3 | Storage layer (TDD) | lib/storage.ts, tests/ |
| 4 | Template utilities (TDD) | lib/template-utils.ts, tests/ |
| 5 | Default system prompts | lib/prompts.ts |
| 6 | Reference template | public/templates/, scripts/ |
| 7 | Rendering server | rendering-server/src/ |
| 8 | Preview + render routes | app/api/preview/, app/api/render/ |
| 9 | CRUD API routes | app/api/studios/, templates/, assets/, creatives/ |
| 10 | AI API routes | app/api/generate-copy/, generate-template/, generate-image/ |
| 11 | Root layout + home | app/layout.tsx, app/page.tsx |
| 12 | Onboarding (3 steps) | app/onboarding/ |
| 13 | Studio layout + sidebar | app/studio/[id]/layout.tsx, components/sidebar.tsx |
| 14 | Asset library | app/studio/[id]/assets/ |
| 15 | Template management | app/studio/[id]/templates/ |
| 16 | Creative generator | app/studio/[id]/creatives/ |
| 17 | Settings page | app/studio/[id]/settings/ |
| 18 | End-to-end smoke test | — |
