// app/api/feedback/[studioId]/summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { buildFeedbackSummary } from '@/lib/feedback-utils';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ studioId: string }> }) {
  const { studioId } = await params;
  const storage = getStorage();
  await storage.init();
  const feedback = await storage.listFeedback(studioId);
  const result = buildFeedbackSummary(feedback);
  return NextResponse.json(result);
}
