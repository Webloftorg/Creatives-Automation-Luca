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
  const data = await req.json();
  await storage.saveStudio({ ...data, id });
  return NextResponse.json({ ...data, id });
}
