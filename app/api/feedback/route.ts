// app/api/feedback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import type { CreativeFeedback } from '@/lib/types';

// Trigger prompt evolution every N feedbacks
const EVOLUTION_INTERVAL = 5;

export async function POST(req: NextRequest) {
  const body = await req.json() as CreativeFeedback;
  if (!body.studioId || !body.variantId || !body.rating) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const storage = getStorage();
  await storage.init();
  await storage.saveFeedback(body);

  // Check if we should trigger prompt evolution
  // Count total feedbacks - if divisible by interval, evolve
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const { supabaseAdmin } = await import('@/lib/supabase');
      const { count } = await supabaseAdmin
        .from('feedback')
        .select('*', { count: 'exact', head: true });

      if (count && count >= EVOLUTION_INTERVAL && count % EVOLUTION_INTERVAL === 0) {
        // Fire and forget - don't block the feedback response
        const origin = req.nextUrl.origin;
        fetch(`${origin}/api/feedback/evolve`, { method: 'POST' }).catch(() => {});
        console.log(`Triggering prompt evolution at ${count} total feedbacks`);
      }
    }
  } catch {
    // Evolution trigger is best-effort, don't fail the feedback save
  }

  return NextResponse.json({ success: true });
}
