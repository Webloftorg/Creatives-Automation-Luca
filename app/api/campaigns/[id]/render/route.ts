// app/api/campaigns/[id]/render/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { replacePlaceholders } from '@/lib/template-utils';
import { FORMAT_DIMENSIONS } from '@/lib/formats';
import type { CreativeFormat } from '@/lib/types';

const RENDER_SERVER = process.env.RENDER_SERVER_URL || 'http://localhost:3001';

// Vercel Serverless max duration (seconds)
export const maxDuration = 60;

function isSupabaseMode() {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const storage = getStorage();
  await storage.init();

  const campaign = await storage.getCampaign(id);
  if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });

  campaign.status = 'rendering';
  campaign.updatedAt = new Date().toISOString();
  await storage.saveCampaign(campaign);

  const origin = _req.nextUrl.origin;
  const approvedVariants = campaign.variants.filter(v => v.approved);

  // Initialize outputs for each variant
  for (const variant of approvedVariants) {
    variant.outputs = campaign.formats.map(f => ({ format: f, status: 'pending' as const }));
  }

  // Build render tasks
  const renderTasks: { variantIdx: number; formatIdx: number; format: CreativeFormat }[] = [];
  for (let vi = 0; vi < approvedVariants.length; vi++) {
    for (let fi = 0; fi < campaign.formats.length; fi++) {
      renderTasks.push({ variantIdx: vi, formatIdx: fi, format: campaign.formats[fi] });
    }
  }

  // Prepare filesystem or Supabase storage for outputs
  let outputDir = '';
  if (!isSupabaseMode()) {
    const fs = (await import('fs/promises')).default;
    const path = (await import('path')).default;
    outputDir = path.join(process.cwd(), 'public', 'output', 'campaigns', id);
    await fs.mkdir(outputDir, { recursive: true });
  }

  // Process with concurrency limit of 3
  const CONCURRENCY = 3;
  for (let i = 0; i < renderTasks.length; i += CONCURRENCY) {
    const batch = renderTasks.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (task) => {
      const variant = approvedVariants[task.variantIdx];
      const dims = FORMAT_DIMENSIONS[task.format];
      const values = { ...variant.fieldValues, width: String(dims.width), height: String(dims.height) };
      const html = replacePlaceholders(variant.templateHtml, values);

      // Inject <base> so the render server can resolve asset URLs
      const baseTag = `<base href="${origin}/">`;
      const finalHtml = html.includes('<head>')
        ? html.replace('<head>', `<head>${baseTag}`)
        : `${baseTag}${html}`;

      try {
        const res = await fetch(`${RENDER_SERVER}/api/render`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: finalHtml, width: dims.width, height: dims.height }),
        });

        if (!res.ok) throw new Error('Render failed');

        const buffer = Buffer.from(await res.arrayBuffer());
        const filename = `variant-${variant.id}-${task.format}.jpg`;

        let outputPath: string;
        if (isSupabaseMode()) {
          // Upload to Supabase Storage
          const { supabaseAdmin } = await import('@/lib/supabase');
          const storagePath = `renders/${id}/${filename}`;
          await supabaseAdmin.storage.from('assets').upload(storagePath, buffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });
          const { data } = supabaseAdmin.storage.from('assets').getPublicUrl(storagePath);
          outputPath = data.publicUrl;
        } else {
          // Write to local filesystem
          const fs = (await import('fs/promises')).default;
          const path = (await import('path')).default;
          await fs.writeFile(path.join(outputDir, filename), buffer);
          outputPath = `/output/campaigns/${id}/${filename}`;
        }

        variant.outputs[task.formatIdx] = {
          format: task.format,
          status: 'done',
          outputPath,
        };
      } catch (err) {
        variant.outputs[task.formatIdx] = {
          format: task.format,
          status: 'error',
          error: err instanceof Error ? err.message : 'Render failed',
        };
      }

      // Save progress after each render
      campaign.updatedAt = new Date().toISOString();
      await storage.saveCampaign(campaign);
    }));
  }

  campaign.status = 'done';
  campaign.updatedAt = new Date().toISOString();
  await storage.saveCampaign(campaign);

  return NextResponse.json(campaign);
}
