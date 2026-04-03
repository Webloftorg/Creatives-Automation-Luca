import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest) {
  const assetPath = req.nextUrl.searchParams.get('path');
  if (!assetPath) return NextResponse.json({ error: 'path required' }, { status: 400 });
  try {
    const buffer = await fs.readFile(assetPath);
    const ext = path.extname(assetPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.webp': 'image/webp', '.gif': 'image/gif',
    };
    return new NextResponse(buffer, { headers: { 'Content-Type': mimeTypes[ext] || 'image/png' } });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
