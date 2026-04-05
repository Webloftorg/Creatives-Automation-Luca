// lib/types.ts

export interface Studio {
  id: string;
  name: string;
  location: string;
  websiteUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logo?: string;
  backgroundImages: string[];
  personImages: string[];
  generatedImages: string[];
  defaultFont: string;
  brandStyle?: string; // AI-generated brand description
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
  defaultFieldValues?: Record<string, string>;
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
  name: string;
  studioId: string;
  templateId: string;
  cssVars?: Record<string, string>;
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
  headlines?: string[];
  formats: CreativeFormat[];
  defaultValues: Record<string, string>;
  selectedPersons: string[];
  selectedBackgrounds: string[];
  generatePersons: boolean;
  generateBackgrounds: boolean;
  personPrompt?: string;
  backgroundPrompt?: string;
  personCount?: number;
  backgroundCount?: number;
  brandStyle?: string;
  brandColors?: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };
  cssStrategyOverrides?: Record<string, string>;
  variants: CampaignVariant[];
  status: 'draft' | 'reviewing' | 'rendering' | 'done';
  createdAt: string;
  updatedAt: string;
}

export interface CampaignStrategy {
  templateId: string;
  templateReason: string;
  imageStyle?: 'person-scene' | 'environment-only' | 'abstract-brand';
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
  | 'parameter-variation'
  | 'template-editing';

export type AssetType = 'person' | 'background' | 'logo' | 'generated';

export interface StorageAdapter {
  init(): Promise<void>;

  getStudio(id: string): Promise<Studio | null>;
  saveStudio(studio: Studio): Promise<void>;
  listStudios(): Promise<Studio[]>;

  getTemplate(id: string): Promise<SavedTemplate | null>;
  saveTemplate(template: SavedTemplate): Promise<void>;
  listTemplates(studioId?: string): Promise<SavedTemplate[]>;
  deleteTemplate(id: string): Promise<void>;

  saveCreative(creative: Creative): Promise<void>;
  listCreatives(studioId: string): Promise<Creative[]>;

  saveCampaign(campaign: Campaign): Promise<void>;
  getCampaign(id: string): Promise<Campaign | null>;
  listCampaigns(studioId: string): Promise<Campaign[]>;
  deleteCampaign(id: string): Promise<void>;

  uploadAsset(file: Buffer, filename: string, studioId: string, type: AssetType): Promise<string>;
  listAssets(studioId: string, type?: AssetType): Promise<string[]>;
  deleteAsset(path: string): Promise<void>;

  saveFeedback(feedback: CreativeFeedback): Promise<void>;
  listFeedback(studioId: string): Promise<CreativeFeedback[]>;

  getSystemPrompt(studioId: string, type: PromptType): Promise<string>;
  saveSystemPrompt(studioId: string, type: PromptType, prompt: string): Promise<void>;
}
