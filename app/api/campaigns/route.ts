import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET(req: NextRequest) {
  const studioId = req.nextUrl.searchParams.get('studioId');
  if (!studioId) return NextResponse.json({ error: 'studioId required' }, { status: 400 });
  const storage = getStorage();
  await storage.init();
  const campaigns = await storage.listCampaigns(studioId);
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  const campaign = await req.json();
  const storage = getStorage();
  await storage.init();
  await storage.saveCampaign(campaign);
  return NextResponse.json(campaign, { status: 201 });
}
