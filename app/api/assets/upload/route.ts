import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import path from 'path';
import type { AssetType } from '@/lib/types';

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const VALID_ASSET_TYPES = new Set(['person', 'background', 'logo', 'generated']);

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const studioId = formData.get('studioId') as string;
  const type = formData.get('type') as AssetType;

  if (!file || !studioId || !type) {
    return NextResponse.json({ error: 'Missing file, studioId, or type' }, { status: 400 });
  }

  // Validate asset type
  if (!VALID_ASSET_TYPES.has(type)) {
    return NextResponse.json({ error: 'Invalid asset type' }, { status: 400 });
  }

  // Validate file extension
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: 'File type not allowed. Use PNG, JPG, WEBP, or GIF.' }, { status: 400 });
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 });
  }

  // Sanitize filename
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

  const buffer = Buffer.from(await file.arrayBuffer());
  const storage = getStorage();
  await storage.init();
  const assetPath = await storage.uploadAsset(buffer, safeName, studioId, type);
  return NextResponse.json({ path: assetPath }, { status: 201 });
}
