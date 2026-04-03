import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import type { AssetType } from '@/lib/types';

export async function GET(req: NextRequest, { params }: { params: Promise<{ studioId: string }> }) {
  const { studioId } = await params;
  const type = req.nextUrl.searchParams.get('type') as AssetType | null;
  const storage = getStorage();
  await storage.init();
  const assets = await storage.listAssets(studioId, type || undefined);
  return NextResponse.json(assets);
}

export async function DELETE(req: NextRequest) {
  const { path: assetPath } = await req.json();
  const storage = getStorage();
  await storage.init();
  await storage.deleteAsset(assetPath);
  return NextResponse.json({ ok: true });
}
