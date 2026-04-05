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
          instances: [{ prompt: `${prompt}. ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO LOGOS, NO WATERMARKS in the image.` }],
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

    let buffer = Buffer.from(base64Image, 'base64');
    let finalBase64 = base64Image;

    if (assetType === 'person') {
      try {
        const { PNG } = await import('pngjs');
        const png = PNG.sync.read(buffer);
        const { width, height, data: pixels } = png;
        let removedCount = 0;
        const threshold = 220;
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
          if (r > threshold && g > threshold && b > threshold) {
            pixels[i + 3] = 0;
            removedCount++;
          }
        }
        // Edge softening
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
          if (a > 0) {
            const brightness = (r + g + b) / 3;
            if (brightness > 200 && brightness <= threshold) {
              const fade = Math.round(255 * (1 - (brightness - 200) / (threshold - 200)));
              pixels[i + 3] = Math.min(a, fade);
            }
          }
        }
        buffer = Buffer.from(PNG.sync.write(png));
        finalBase64 = buffer.toString('base64');
        console.log(`BG removal: ${removedCount} of ${width * height} pixels made transparent`);
      } catch (err) {
        console.error('BG removal failed:', err instanceof Error ? err.message : err);
      }
    }

    const storage = getStorage();
    await storage.init();
    const assetPath = await storage.uploadAsset(buffer, 'generated.png', studioId, assetType);

    return NextResponse.json({ path: assetPath, base64: `data:image/png;base64,${finalBase64}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Image generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
