import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import path from 'path';
import type { AssetType } from '@/lib/types';

const ALLOWED_BASE = path.resolve(process.cwd(), 'data', 'assets');

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
  if (!assetPath || typeof assetPath !== 'string') {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }

  // Validate path is within allowed directory
  const resolved = path.resolve(assetPath);
  if (!resolved.startsWith(ALLOWED_BASE)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const storage = getStorage();
  await storage.init();
  await storage.deleteAsset(resolved);
  return NextResponse.json({ ok: true });
}
