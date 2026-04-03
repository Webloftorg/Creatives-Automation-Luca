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
