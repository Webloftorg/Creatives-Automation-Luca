import { NextRequest, NextResponse } from 'next/server';

const RENDER_SERVER = process.env.RENDER_SERVER_URL || 'http://localhost:3001';

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const response = await fetch(`${RENDER_SERVER}/api/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }
    const png = await response.arrayBuffer();
    return new NextResponse(Buffer.from(png), { headers: { 'Content-Type': 'image/png' } });
  } catch {
    return NextResponse.json({ error: 'Rendering server unreachable. Is it running on port 3001?' }, { status: 502 });
  }
}
