// app/api/feedback/[studioId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ studioId: string }> }) {
  const { studioId } = await params;
  const storage = getStorage();
  await storage.init();
  const feedback = await storage.listFeedback(studioId);
  return NextResponse.json(feedback);
}
