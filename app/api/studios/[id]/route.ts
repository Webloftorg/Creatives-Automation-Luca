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
  const existing = await storage.getStudio(id);
  const raw = await req.json();
  const { __proto__, constructor, prototype, ...data } = raw;
  const merged = { ...existing, ...data, id };
  await storage.saveStudio(merged);
  return NextResponse.json(merged);
}
