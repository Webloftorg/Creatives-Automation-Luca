import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';
import { replacePlaceholders } from '@/lib/template-utils';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { templateId, html: rawHtml, fieldValues = {}, width = 1080, height = 1080 } = body;

  let html: string;
  if (templateId) {
    const storage = getStorage();
    await storage.init();
    const template = await storage.getTemplate(templateId);
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    html = template.htmlContent;
  } else if (rawHtml) {
    html = rawHtml;
  } else {
    return NextResponse.json({ error: 'Provide templateId or html' }, { status: 400 });
  }

  const values = { ...fieldValues, width: String(width), height: String(height) };
  const rendered = replacePlaceholders(html, values);
  return new NextResponse(rendered, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
