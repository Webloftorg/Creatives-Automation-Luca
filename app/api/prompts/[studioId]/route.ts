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
