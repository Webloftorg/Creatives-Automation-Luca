'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { TemplateCard } from '@/components/template-card';
import { LivePreview } from '@/components/live-preview';
import { CssVarSlider } from '@/components/css-var-slider';
import { extractPlaceholders, extractCssVariables, placeholdersToDynamicFields } from '@/lib/template-utils';
import { FORMAT_DIMENSIONS } from '@/lib/formats';
import type { SavedTemplate, CreativeFormat } from '@/lib/types';

export default function TemplatesPage() {
  const { id: studioId } = useParams<{ id: string }>();
  const router = useRouter();
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [editing, setEditing] = useState<SavedTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState<CreativeFormat>('instagram-post');
  const [generatedHtml, setGeneratedHtml] = useState('');
  const [cssVars, setCssVars] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [templateName, setTemplateName] = useState('');

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

  const generateTemplate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/generate-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          format,
          studioId,
          baseTemplate: editing?.htmlContent || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGeneratedHtml(data.html);
      setCssVars(data.cssVariables || {});
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  const handleCssVarChange = (key: string, value: string) => {
    setCssVars(prev => ({ ...prev, [key]: value }));
    setGeneratedHtml(prev => {
      return prev.replace(
        new RegExp(`(${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*)([^;]+)`),
        `$1${value}`,
      );
    });
  };

  const saveTemplate = async () => {
    const placeholders = extractPlaceholders(generatedHtml);
    const fields = placeholdersToDynamicFields(placeholders);

    const template: SavedTemplate = {
      id: editing?.id || uuidv4(),
      name: templateName || `Template ${new Date().toLocaleDateString('de')}`,
      studioId,
      type: 'custom',
      htmlContent: generatedHtml,
      cssVariables: cssVars,
      dynamicFields: fields,
      version: editing ? editing.version + 1 : 1,
      createdAt: editing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await fetch(editing ? `/api/templates/${template.id}` : '/api/templates', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(template),
    });

    setEditing(null);
    setCreating(false);
    setGeneratedHtml('');
    setPrompt('');
    setTemplateName('');
    loadTemplates();
  };

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

  const dims = FORMAT_DIMENSIONS[format];

  // Editor view
  if (creating || editing) {
    return (
      <div className="flex h-full">
        <div className="w-80 bg-[#111] border-r border-[#222] p-4 overflow-y-auto flex-shrink-0">
          <button onClick={() => { setCreating(false); setEditing(null); setGeneratedHtml(''); }}
            className="text-[#666] text-sm mb-4 hover:text-white">← Zurück</button>

          <h2 className="text-white font-bold mb-4">{editing ? 'Template editieren' : 'Neues Template'}</h2>

          <div className="mb-4">
            <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Name</label>
            <input value={templateName} onChange={e => setTemplateName(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm outline-none"
              placeholder="Template-Name" />
          </div>

          <div className="mb-4">
            <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">Format</label>
            <select value={format} onChange={e => setFormat(e.target.value as CreativeFormat)}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-3 py-2 text-white text-sm outline-none">
              {Object.entries(FORMAT_DIMENSIONS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>

          <label className="text-[#888] text-xs uppercase tracking-wider mb-1 block">AI-Anpassung</label>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg p-3 text-white text-sm resize-none h-24 outline-none mb-2"
            placeholder={editing
              ? 'z.B. Mach den Preis größer und füge einen Neon-Glow hinzu...'
              : 'Beschreibe das Template das du brauchst...'} />
          <button onClick={generateTemplate} disabled={loading || !prompt}
            className="w-full bg-[#FF4500] hover:bg-[#e63e00] disabled:opacity-50 text-white font-bold py-2.5 rounded-lg text-sm mb-4">
            {loading ? 'Generiere...' : editing ? 'Anpassen mit AI ✨' : 'Generieren ✨'}
          </button>

          {Object.keys(cssVars).length > 0 && (
            <>
              <label className="text-[#888] text-xs uppercase tracking-wider mb-2 block">CSS-Variablen</label>
              <CssVarSlider variables={cssVars} onChange={handleCssVarChange} />
            </>
          )}

          {generatedHtml && (
            <div className="flex gap-2 mt-6">
              <button onClick={saveTemplate}
                className="flex-1 bg-[#FF4500] text-white font-bold py-2.5 rounded-lg text-sm">
                Speichern
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 flex items-center justify-center bg-[#0a0a0a] p-6">
          {generatedHtml ? (
            <LivePreview html={generatedHtml} width={dims.width} height={dims.height} fieldValues={{}} />
          ) : (
            <div className="text-[#444] text-sm">Generiere ein Template um die Vorschau zu sehen</div>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold">Templates</h1>
          <p className="text-[#666] text-sm mt-1">{templates.length} Templates</p>
        </div>
        <button onClick={() => setCreating(true)}
          className="bg-[#FF4500] hover:bg-[#e63e00] text-white font-bold py-2 px-4 rounded-lg text-sm">
          + Neues Template per AI
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(t => (
          <TemplateCard
            key={t.id}
            template={t}
            onUse={() => router.push(`/studio/${studioId}/creatives?templateId=${t.id}`)}
            onEdit={() => {
              setEditing(t);
              setGeneratedHtml(t.htmlContent);
              setCssVars(t.cssVariables);
              setTemplateName(t.name);
            }}
            onDuplicate={() => duplicateTemplate(t)}
            onDelete={() => deleteTemplate(t.id)}
          />
        ))}
      </div>
    </div>
  );
}
