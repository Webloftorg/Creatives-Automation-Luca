import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import type { AssetType } from '@/lib/types';

export async function POST(req: NextRequest) {
  const { prompt, studioId, assetType = 'generated' } = await req.json() as {
    prompt: string;
    studioId: string;
    assetType?: AssetType;
  };

  if (!prompt || !studioId) {
    return NextResponse.json({ error: 'prompt and studioId required' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_API_KEY not configured' }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: 1, aspectRatio: '1:1' },
        }),
      },
    );

    if (!response.ok) {
      const errBody = await response.text();
      return NextResponse.json({ error: `Imagen API error: ${errBody}` }, { status: 502 });
    }

    const data = await response.json();
    const base64Image = data.predictions?.[0]?.bytesBase64Encoded;

    if (!base64Image) {
      return NextResponse.json({ error: 'No image returned from Imagen' }, { status: 502 });
    }

    const buffer = Buffer.from(base64Image, 'base64');
    const storage = getStorage();
    await storage.init();
    const assetPath = await storage.uploadAsset(buffer, 'generated.png', studioId, assetType);

    return NextResponse.json({ path: assetPath, base64: `data:image/png;base64,${base64Image}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Image generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
