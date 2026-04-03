import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import type { AssetType } from '@/lib/types';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const studioId = formData.get('studioId') as string;
  const type = formData.get('type') as AssetType;

  if (!file || !studioId || !type) {
    return NextResponse.json({ error: 'Missing file, studioId, or type' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getStorage();
  await storage.init();
  const assetPath = await storage.uploadAsset(buffer, file.name, studioId, type);
  return NextResponse.json({ path: assetPath }, { status: 201 });
}
