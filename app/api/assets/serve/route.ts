import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const ALLOWED_BASE = path.resolve(process.cwd(), 'data', 'assets');
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

export async function GET(req: NextRequest) {
  const assetPath = req.nextUrl.searchParams.get('path');
  if (!assetPath) return NextResponse.json({ error: 'path required' }, { status: 400 });

  // Resolve and validate path is within allowed directory
  const resolved = path.resolve(assetPath);
  if (!resolved.startsWith(ALLOWED_BASE)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const ext = path.extname(resolved).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 403 });
  }

  try {
    const buffer = await fs.readFile(resolved);
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.webp': 'image/webp', '.gif': 'image/gif',
    };
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeTypes[ext] || 'image/png',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
