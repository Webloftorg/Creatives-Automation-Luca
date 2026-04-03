import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storage = getStorage();
  await storage.init();
  const template = await storage.getTemplate(id);
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(template);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storage = getStorage();
  await storage.init();
  const data = await req.json();
  await storage.saveTemplate({ ...data, id });
  return NextResponse.json({ ...data, id });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storage = getStorage();
  await storage.init();
  await storage.deleteTemplate(id);
  return NextResponse.json({ ok: true });
}
