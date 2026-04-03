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
