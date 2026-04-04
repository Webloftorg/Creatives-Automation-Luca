// app/api/feedback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import type { CreativeFeedback } from '@/lib/types';

export async function POST(req: NextRequest) {
  const body = await req.json() as CreativeFeedback;
  if (!body.studioId || !body.variantId || !body.rating) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const storage = getStorage();
  await storage.init();
  await storage.saveFeedback(body);
  return NextResponse.json({ success: true });
}
