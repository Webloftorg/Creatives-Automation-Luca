import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET() {
  const storage = getStorage();
  await storage.init();
  const studios = await storage.listStudios();
  return NextResponse.json(studios);
}

export async function POST(req: NextRequest) {
  const storage = getStorage();
  await storage.init();
  const studio = await req.json();
  await storage.saveStudio(studio);
  return NextResponse.json(studio, { status: 201 });
}
