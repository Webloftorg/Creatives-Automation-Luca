-- Global Prompt Evolution Table
-- Tracks evolved prompts that improve over time from ALL feedback
-- Run this in Supabase SQL Editor

create table global_prompts (
  prompt_type text primary key check (prompt_type in ('copy-generation', 'parameter-variation', 'template-editing')),
  prompt text not null,
  version int not null default 1,
  feedback_count int not null default 0,
  last_evolved_at timestamptz not null default now(),
  evolution_log jsonb not null default '[]'::jsonb
);
