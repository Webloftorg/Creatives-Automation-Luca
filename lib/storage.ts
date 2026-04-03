import fs from 'fs/promises';
import path from 'path';
import type { Studio, SavedTemplate, Creative, Campaign, StorageAdapter, PromptType, AssetType } from './types';

export class FilesystemStorage implements StorageAdapter {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || path.join(process.cwd(), 'data');
  }

  async init(): Promise<void> {
    const dirs = ['studios', 'templates', 'creatives', 'prompts', 'assets', 'campaigns'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.basePath, dir), { recursive: true });
    }
  }

  async getStudio(id: string): Promise<Studio | null> {
    try {
      const data = await fs.readFile(path.join(this.basePath, 'studios', `${id}.json`), 'utf-8');
      return JSON.parse(data);
    } catch { return null; }
  }

  async saveStudio(studio: Studio): Promise<void> {
    await fs.writeFile(path.join(this.basePath, 'studios', `${studio.id}.json`), JSON.stringify(studio, null, 2));
  }

  async listStudios(): Promise<Studio[]> {
    const files = await this.listJsonFiles('studios');
    return Promise.all(files.map(f => this.readJson<Studio>(f)));
  }

  async getTemplate(id: string): Promise<SavedTemplate | null> {
    try {
      const data = await fs.readFile(path.join(this.basePath, 'templates', `${id}.json`), 'utf-8');
      return JSON.parse(data);
    } catch { return null; }
  }

  async saveTemplate(template: SavedTemplate): Promise<void> {
    await fs.writeFile(path.join(this.basePath, 'templates', `${template.id}.json`), JSON.stringify(template, null, 2));
  }

  async listTemplates(studioId?: string): Promise<SavedTemplate[]> {
    const all = await this.listJsonFiles('templates');
    const templates = await Promise.all(all.map(f => this.readJson<SavedTemplate>(f)));
    if (studioId) return templates.filter(t => t.studioId === studioId);
    return templates;
  }

  async deleteTemplate(id: string): Promise<void> {
    try { await fs.unlink(path.join(this.basePath, 'templates', `${id}.json`)); } catch {}
  }

  async saveCreative(creative: Creative): Promise<void> {
    await fs.writeFile(path.join(this.basePath, 'creatives', `${creative.id}.json`), JSON.stringify(creative, null, 2));
  }

  async listCreatives(studioId: string): Promise<Creative[]> {
    const all = await this.listJsonFiles('creatives');
    const creatives = await Promise.all(all.map(f => this.readJson<Creative>(f)));
    return creatives.filter(c => c.studioId === studioId);
  }

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
      } catch {}
    }
    return results;
  }

  async deleteAsset(assetPath: string): Promise<void> {
    try { await fs.unlink(assetPath); } catch {}
  }

  async getSystemPrompt(studioId: string, type: PromptType): Promise<string> {
    try {
      return await fs.readFile(path.join(this.basePath, 'prompts', `${studioId}-${type}.txt`), 'utf-8');
    } catch { return ''; }
  }

  async saveSystemPrompt(studioId: string, type: PromptType, prompt: string): Promise<void> {
    await fs.writeFile(path.join(this.basePath, 'prompts', `${studioId}-${type}.txt`), prompt);
  }

  private async listJsonFiles(subdir: string): Promise<string[]> {
    const dir = path.join(this.basePath, subdir);
    try {
      const files = await fs.readdir(dir);
      return files.filter(f => f.endsWith('.json')).map(f => path.join(dir, f));
    } catch { return []; }
  }

  private async readJson<T>(filePath: string): Promise<T> {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  }
}

let storageInstance: FilesystemStorage | null = null;

export function getStorage(): FilesystemStorage {
  if (!storageInstance) {
    storageInstance = new FilesystemStorage();
  }
  return storageInstance;
}
