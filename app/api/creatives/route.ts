import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET(req: NextRequest) {
  const studioId = req.nextUrl.searchParams.get('studioId');
  if (!studioId) return NextResponse.json({ error: 'studioId required' }, { status: 400 });
  const storage = getStorage();
  await storage.init();
  const creatives = await storage.listCreatives(studioId);
  return NextResponse.json(creatives);
}

export async function POST(req: NextRequest) {
  const storage = getStorage();
  await storage.init();
  const creative = await req.json();
  await storage.saveCreative(creative);
  return NextResponse.json(creative, { status: 201 });
}
