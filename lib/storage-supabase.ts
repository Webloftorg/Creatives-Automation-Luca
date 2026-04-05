import { supabaseAdmin, getAssetPublicUrl } from './supabase';
import type {
  Studio, SavedTemplate, Creative, Campaign,
  StorageAdapter, PromptType, AssetType, CreativeFeedback,
} from './types';

// Helper: convert DB row (snake_case) → app type (camelCase)
function rowToStudio(r: Record<string, unknown>): Studio {
  return {
    id: r.id as string,
    name: r.name as string,
    location: r.location as string,
    websiteUrl: r.website_url as string | undefined,
    primaryColor: r.primary_color as string,
    secondaryColor: r.secondary_color as string,
    accentColor: r.accent_color as string,
    logo: r.logo as string | undefined,
    backgroundImages: (r.background_images || []) as string[],
    personImages: (r.person_images || []) as string[],
    generatedImages: (r.generated_images || []) as string[],
    defaultFont: r.default_font as string,
    brandStyle: r.brand_style as string | undefined,
    createdAt: r.created_at as string,
  };
}

function studioToRow(s: Studio) {
  return {
    id: s.id,
    name: s.name,
    location: s.location,
    website_url: s.websiteUrl || null,
    primary_color: s.primaryColor,
    secondary_color: s.secondaryColor,
    accent_color: s.accentColor,
    logo: s.logo || null,
    background_images: s.backgroundImages,
    person_images: s.personImages,
    generated_images: s.generatedImages,
    default_font: s.defaultFont,
    brand_style: s.brandStyle || null,
    created_at: s.createdAt,
  };
}

function rowToTemplate(r: Record<string, unknown>): SavedTemplate {
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string | undefined,
    studioId: r.studio_id as string | undefined,
    type: r.type as SavedTemplate['type'],
    htmlContent: r.html_content as string,
    cssVariables: (r.css_variables || {}) as Record<string, string>,
    dynamicFields: (r.dynamic_fields || []) as SavedTemplate['dynamicFields'],
    defaultFieldValues: r.default_field_values as Record<string, string> | undefined,
    thumbnail: r.thumbnail as string | undefined,
    version: r.version as number,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function templateToRow(t: SavedTemplate) {
  return {
    id: t.id,
    name: t.name,
    description: t.description || null,
    studio_id: t.studioId || null,
    type: t.type,
    html_content: t.htmlContent,
    css_variables: t.cssVariables,
    dynamic_fields: t.dynamicFields,
    default_field_values: t.defaultFieldValues || null,
    thumbnail: t.thumbnail || null,
    version: t.version,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

function rowToCampaign(r: Record<string, unknown>): Campaign {
  return {
    id: r.id as string,
    studioId: r.studio_id as string,
    name: r.name as string,
    baseTemplateId: r.base_template_id as string | undefined,
    designVariantCount: r.design_variant_count as number,
    headlineVariantCount: r.headline_variant_count as number,
    headlines: (r.headlines || []) as string[],
    formats: (r.formats || []) as Campaign['formats'],
    defaultValues: (r.default_values || {}) as Record<string, string>,
    selectedPersons: (r.selected_persons || []) as string[],
    selectedBackgrounds: (r.selected_backgrounds || []) as string[],
    generatePersons: r.generate_persons as boolean,
    generateBackgrounds: r.generate_backgrounds as boolean,
    personPrompt: r.person_prompt as string | undefined,
    backgroundPrompt: r.background_prompt as string | undefined,
    personCount: r.person_count as number | undefined,
    backgroundCount: r.background_count as number | undefined,
    brandStyle: r.brand_style as string | undefined,
    brandColors: r.brand_colors as Campaign['brandColors'],
    cssStrategyOverrides: r.css_strategy_overrides as Record<string, string> | undefined,
    variants: (r.variants || []) as Campaign['variants'],
    status: r.status as Campaign['status'],
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function campaignToRow(c: Campaign) {
  return {
    id: c.id,
    studio_id: c.studioId,
    name: c.name,
    base_template_id: c.baseTemplateId || null,
    design_variant_count: c.designVariantCount,
    headline_variant_count: c.headlineVariantCount,
    headlines: c.headlines || [],
    formats: c.formats,
    default_values: c.defaultValues,
    selected_persons: c.selectedPersons,
    selected_backgrounds: c.selectedBackgrounds,
    generate_persons: c.generatePersons,
    generate_backgrounds: c.generateBackgrounds,
    person_prompt: c.personPrompt || null,
    background_prompt: c.backgroundPrompt || null,
    person_count: c.personCount || null,
    background_count: c.backgroundCount || null,
    brand_style: c.brandStyle || null,
    brand_colors: c.brandColors || null,
    css_strategy_overrides: c.cssStrategyOverrides || null,
    variants: c.variants,
    status: c.status,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

function rowToFeedback(r: Record<string, unknown>): CreativeFeedback {
  return {
    id: r.id as string,
    studioId: r.studio_id as string,
    campaignId: r.campaign_id as string,
    variantId: r.variant_id as string,
    rating: r.rating as 'good' | 'bad',
    comment: r.comment as string | undefined,
    cssVars: (r.css_vars || {}) as Record<string, string>,
    fieldValues: (r.field_values || {}) as Record<string, string>,
    templateId: r.template_id as string,
    timestamp: r.timestamp as string,
  };
}

export class SupabaseStorage implements StorageAdapter {
  async init(): Promise<void> {
    // No-op: tables created via migration
  }

  // ── Studios ──
  async getStudio(id: string): Promise<Studio | null> {
    const { data } = await supabaseAdmin.from('studios').select('*').eq('id', id).single();
    return data ? rowToStudio(data) : null;
  }

  async saveStudio(studio: Studio): Promise<void> {
    await supabaseAdmin.from('studios').upsert(studioToRow(studio));
  }

  async listStudios(): Promise<Studio[]> {
    const { data } = await supabaseAdmin.from('studios').select('*').order('created_at', { ascending: false });
    return (data || []).map(rowToStudio);
  }

  // ── Templates ──
  async getTemplate(id: string): Promise<SavedTemplate | null> {
    const { data } = await supabaseAdmin.from('templates').select('*').eq('id', id).single();
    return data ? rowToTemplate(data) : null;
  }

  async saveTemplate(template: SavedTemplate): Promise<void> {
    await supabaseAdmin.from('templates').upsert(templateToRow(template));
  }

  async listTemplates(studioId?: string): Promise<SavedTemplate[]> {
    let query = supabaseAdmin.from('templates').select('*');
    if (studioId) query = query.eq('studio_id', studioId);
    const { data } = await query.order('created_at', { ascending: false });
    return (data || []).map(rowToTemplate);
  }

  async deleteTemplate(id: string): Promise<void> {
    await supabaseAdmin.from('templates').delete().eq('id', id);
  }

  // ── Creatives ──
  async saveCreative(creative: Creative): Promise<void> {
    await supabaseAdmin.from('creatives').upsert({
      id: creative.id,
      name: creative.name,
      studio_id: creative.studioId,
      template_id: creative.templateId,
      css_vars: creative.cssVars || null,
      field_values: creative.fieldValues,
      outputs: creative.outputs,
      created_at: creative.createdAt,
    });
  }

  async listCreatives(studioId: string): Promise<Creative[]> {
    const { data } = await supabaseAdmin.from('creatives').select('*').eq('studio_id', studioId);
    return (data || []).map(r => ({
      id: r.id,
      name: r.name,
      studioId: r.studio_id,
      templateId: r.template_id,
      cssVars: r.css_vars,
      fieldValues: r.field_values,
      outputs: r.outputs,
      createdAt: r.created_at,
    }));
  }

  // ── Campaigns ──
  async saveCampaign(campaign: Campaign): Promise<void> {
    await supabaseAdmin.from('campaigns').upsert(campaignToRow(campaign));
  }

  async getCampaign(id: string): Promise<Campaign | null> {
    const { data } = await supabaseAdmin.from('campaigns').select('*').eq('id', id).single();
    return data ? rowToCampaign(data) : null;
  }

  async listCampaigns(studioId: string): Promise<Campaign[]> {
    const { data } = await supabaseAdmin.from('campaigns').select('*').eq('studio_id', studioId).order('created_at', { ascending: false });
    return (data || []).map(rowToCampaign);
  }

  async deleteCampaign(id: string): Promise<void> {
    await supabaseAdmin.from('campaigns').delete().eq('id', id);
  }

  // ── Assets (Supabase Storage) ──
  async uploadAsset(file: Buffer, filename: string, studioId: string, type: AssetType): Promise<string> {
    const ext = filename.split('.').pop() || 'png';
    const storagePath = `${studioId}/${type}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabaseAdmin.storage
      .from('assets')
      .upload(storagePath, file, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: false });

    if (error) throw new Error(`Upload failed: ${error.message}`);
    return storagePath;
  }

  async listAssets(studioId: string, type?: AssetType): Promise<string[]> {
    const types: AssetType[] = type ? [type] : ['person', 'background', 'logo', 'generated'];
    const results: string[] = [];

    for (const t of types) {
      const { data } = await supabaseAdmin.storage.from('assets').list(`${studioId}/${t}`);
      if (data) {
        results.push(...data.filter(f => f.name !== '.emptyFolderPlaceholder').map(f => `${studioId}/${t}/${f.name}`));
      }
    }
    return results;
  }

  async deleteAsset(assetPath: string): Promise<void> {
    await supabaseAdmin.storage.from('assets').remove([assetPath]);
  }

  // ── Feedback ──
  async saveFeedback(feedback: CreativeFeedback): Promise<void> {
    await supabaseAdmin.from('feedback').upsert({
      id: feedback.id,
      studio_id: feedback.studioId,
      campaign_id: feedback.campaignId,
      variant_id: feedback.variantId,
      rating: feedback.rating,
      comment: feedback.comment || null,
      css_vars: feedback.cssVars,
      field_values: feedback.fieldValues,
      template_id: feedback.templateId,
      timestamp: feedback.timestamp,
    });
  }

  async listFeedback(studioId: string): Promise<CreativeFeedback[]> {
    const { data } = await supabaseAdmin.from('feedback')
      .select('*')
      .eq('studio_id', studioId)
      .order('timestamp', { ascending: false })
      .limit(100);
    return (data || []).map(rowToFeedback);
  }

  // ── System Prompts ──
  async getSystemPrompt(studioId: string, type: PromptType): Promise<string> {
    const { data } = await supabaseAdmin.from('system_prompts')
      .select('prompt')
      .eq('studio_id', studioId)
      .eq('prompt_type', type)
      .single();
    return data?.prompt || '';
  }

  async saveSystemPrompt(studioId: string, type: PromptType, prompt: string): Promise<void> {
    await supabaseAdmin.from('system_prompts').upsert({
      studio_id: studioId,
      prompt_type: type,
      prompt,
    });
  }
}
