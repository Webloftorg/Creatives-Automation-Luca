'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { TemplateCard } from '@/components/template-card';
import type { SavedTemplate } from '@/lib/types';

export default function TemplatesPage() {
  const { id: studioId } = useParams<{ id: string }>();
  const router = useRouter();
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);

  const loadTemplates = async () => {
    const res = await fetch(`/api/templates?studioId=${studioId}`);
    const res2 = await fetch('/api/templates');
    const studioTemplates = await res.json();
    const allTemplates: SavedTemplate[] = await res2.json();
    const ids = new Set(studioTemplates.map((t: SavedTemplate) => t.id));
    const globals = allTemplates.filter(t => !t.studioId && !ids.has(t.id));
    setTemplates([...studioTemplates, ...globals]);
  };

  useEffect(() => { loadTemplates(); }, [studioId]);

  const deleteTemplate = async (id: string) => {
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    loadTemplates();
  };

  const duplicateTemplate = async (template: SavedTemplate) => {
    const dup: SavedTemplate = {
      ...template,
      id: uuidv4(),
      name: `${template.name} (Kopie)`,
      studioId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dup),
    });
    loadTemplates();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold font-[family-name:var(--font-heading)]">Templates</h1>
          <p className="text-[#6b7280] text-sm mt-1">{templates.length} Templates</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(t => (
          <TemplateCard
            key={t.id}
            template={t}
            onUse={() => router.push(`/studio/${studioId}/creatives?templateId=${t.id}`)}
            onEdit={() => router.push(`/studio/${studioId}/creatives?templateId=${t.id}`)}
            onDuplicate={() => duplicateTemplate(t)}
            onDelete={() => deleteTemplate(t.id)}
          />
        ))}
      </div>
    </div>
  );
}
