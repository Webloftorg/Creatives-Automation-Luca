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
