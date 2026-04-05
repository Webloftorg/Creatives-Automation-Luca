-- ============================================
-- Supabase Schema for Creatives Automation
-- Run this in the Supabase SQL Editor
-- ============================================

-- 1. Studios
create table studios (
  id uuid primary key,
  name text not null,
  location text not null default '',
  website_url text,
  primary_color text not null default '#00D4FF',
  secondary_color text not null default '#15151e',
  accent_color text not null default '#0090cc',
  logo text,
  background_images jsonb not null default '[]'::jsonb,
  person_images jsonb not null default '[]'::jsonb,
  generated_images jsonb not null default '[]'::jsonb,
  default_font text not null default 'Montserrat',
  brand_style text,
  created_at timestamptz not null default now()
);

-- 2. Templates
create table templates (
  id text primary key,
  name text not null,
  description text,
  studio_id uuid references studios(id) on delete set null,
  type text not null default 'price-offer',
  html_content text not null,
  css_variables jsonb not null default '{}'::jsonb,
  dynamic_fields jsonb not null default '[]'::jsonb,
  default_field_values jsonb,
  thumbnail text,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Creatives (standalone editor saves)
create table creatives (
  id uuid primary key,
  name text not null,
  studio_id uuid not null references studios(id) on delete cascade,
  template_id text not null,
  css_vars jsonb,
  field_values jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- 4. Campaigns
create table campaigns (
  id uuid primary key,
  studio_id uuid not null references studios(id) on delete cascade,
  name text not null,
  base_template_id text,
  design_variant_count int not null default 0,
  headline_variant_count int not null default 0,
  headlines jsonb default '[]'::jsonb,
  formats jsonb not null default '[]'::jsonb,
  default_values jsonb not null default '{}'::jsonb,
  selected_persons jsonb not null default '[]'::jsonb,
  selected_backgrounds jsonb not null default '[]'::jsonb,
  generate_persons boolean not null default false,
  generate_backgrounds boolean not null default false,
  person_prompt text,
  background_prompt text,
  person_count int,
  background_count int,
  brand_style text,
  brand_colors jsonb,
  css_strategy_overrides jsonb,
  variants jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Feedback
create table feedback (
  id uuid primary key,
  studio_id uuid not null references studios(id) on delete cascade,
  campaign_id uuid not null,
  variant_id text not null,
  rating text not null check (rating in ('good', 'bad')),
  comment text,
  css_vars jsonb not null default '{}'::jsonb,
  field_values jsonb not null default '{}'::jsonb,
  template_id text not null,
  timestamp timestamptz not null default now()
);

-- 6. System Prompts
create table system_prompts (
  studio_id uuid not null references studios(id) on delete cascade,
  prompt_type text not null check (prompt_type in ('copy-generation', 'parameter-variation', 'template-editing')),
  prompt text not null default '',
  primary key (studio_id, prompt_type)
);

-- Indexes for common queries
create index idx_templates_studio on templates(studio_id);
create index idx_creatives_studio on creatives(studio_id);
create index idx_campaigns_studio on campaigns(studio_id);
create index idx_feedback_studio on feedback(studio_id);
create index idx_feedback_timestamp on feedback(timestamp desc);

-- ============================================
-- Supabase Storage Bucket for Assets
-- Run these in the SQL Editor too
-- ============================================

-- Create the assets bucket (public readable)
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

-- Allow authenticated & anon uploads (app has no auth yet)
create policy "Allow public read" on storage.objects
  for select using (bucket_id = 'assets');

create policy "Allow public insert" on storage.objects
  for insert with check (bucket_id = 'assets');

create policy "Allow public delete" on storage.objects
  for delete using (bucket_id = 'assets');
