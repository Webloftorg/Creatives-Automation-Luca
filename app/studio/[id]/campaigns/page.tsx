// app/studio/[id]/campaigns/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { CampaignSetup } from '@/components/campaign-setup';
import { VariantGrid } from '@/components/variant-grid';
import { CreativeEditorModal } from '@/components/creative-editor-modal';
import { RenderProgress } from '@/components/render-progress';
import type { Campaign, CampaignVariant, CreativeFormat } from '@/lib/types';

type View = 'list' | 'setup' | 'review' | 'rendering';

export default function CampaignsPage() {
  const { id: studioId } = useParams<{ id: string }>();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [view, setView] = useState<View>('list');
  const [generating, setGenerating] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [editingVariant, setEditingVariant] = useState<CampaignVariant | null>(null);
  const [regenerateVariant, setRegenerateVariant] = useState<CampaignVariant | null>(null);
  const [regeneratePrompt, setRegeneratePrompt] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [personAssets, setPersonAssets] = useState<string[]>([]);
  const [bgAssets, setBgAssets] = useState<string[]>([]);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'good' | 'bad'>>({});

  const loadCampaigns = async () => {
    const res = await fetch(`/api/campaigns?studioId=${studioId}`);
    setCampaigns(await res.json());
  };

  const loadAssets = async () => {
    const [persons, bgs] = await Promise.all([
      fetch(`/api/assets/${studioId}?type=person`).then(r => r.json()),
      fetch(`/api/assets/${studioId}?type=background`).then(r => r.json()),
    ]);
    setPersonAssets(persons);
    setBgAssets(bgs);
  };

  useEffect(() => {
    loadCampaigns();
    loadAssets();
  }, [studioId]);

  const openCampaign = (campaign: Campaign) => {
    setActiveCampaign(campaign);
    if (campaign.status === 'done' || campaign.status === 'rendering') {
      setView('rendering');
    } else if (campaign.status === 'reviewing') {
      setView('review');
    } else {
      setView('setup');
    }
  };

  const handleGenerate = async (config: {
    name: string;
    baseTemplateId: string;
    headlines: string[];
    formats: CreativeFormat[];
    defaultValues: Record<string, string>;
    selectedPersons: string[];
    selectedBackgrounds: string[];
    generatePersons: boolean;
    generateBackgrounds: boolean;
    personPrompt: string;
    backgroundPrompt: string;
    personCount: number;
    backgroundCount: number;
    brandColors?: { primaryColor: string; secondaryColor: string; accentColor: string };
    brandStyle?: string;
    cssStrategyOverrides?: Record<string, string>;
  }) => {
    setGenerating(true);

    const { headlines, ...restConfig } = config;
    const campaign: Campaign = {
      id: uuidv4(),
      studioId,
      ...restConfig,
      headlines,
      headlineVariantCount: headlines.length,
      designVariantCount: 1,
      variants: [],
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaign),
    });

    const res = await fetch(`/api/campaigns/${campaign.id}/generate`, { method: 'POST' });
    const updated = await res.json();

    if (res.ok) {
      setActiveCampaign(updated);
      setView('review');
    } else {
      alert(updated.error || 'Generierung fehlgeschlagen');
    }

    setGenerating(false);
    loadCampaigns();
  };

  const handleToggleApproved = async (variantId: string) => {
    if (!activeCampaign) return;
    const updated = {
      ...activeCampaign,
      variants: activeCampaign.variants.map(v =>
        v.id === variantId ? { ...v, approved: !v.approved } : v
      ),
    };
    setActiveCampaign(updated);
    await fetch(`/api/campaigns/${activeCampaign.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  };

  const handleFeedback = async (variantId: string, rating: 'good' | 'bad', comment?: string) => {
    if (!activeCampaign) return;
    const variant = activeCampaign.variants.find(v => v.id === variantId);
    if (!variant) return;

    if (feedbackMap[variantId] === rating && !comment) {
      setFeedbackMap(prev => { const next = { ...prev }; delete next[variantId]; return next; });
      return;
    }

    setFeedbackMap(prev => ({ ...prev, [variantId]: rating }));

    const { extractCssVariables } = await import('@/lib/template-utils');

    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: uuidv4(),
        studioId,
        campaignId: activeCampaign.id,
        variantId,
        rating,
        comment,
        cssVars: extractCssVariables(variant.templateHtml),
        fieldValues: variant.fieldValues,
        templateId: activeCampaign.baseTemplateId || '',
        timestamp: new Date().toISOString(),
      }),
    });
  };

  const handleEditorSave = async (updatedVariant: CampaignVariant) => {
    if (!activeCampaign || !editingVariant) return;
    const updated = {
      ...activeCampaign,
      variants: activeCampaign.variants.map(v =>
        v.id === editingVariant.id ? updatedVariant : v
      ),
    };
    setActiveCampaign(updated);
    setEditingVariant(null);
    await fetch(`/api/campaigns/${activeCampaign.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  };

  const handleRender = async () => {
    if (!activeCampaign) return;
    setRendering(true);
    setView('rendering');

    try {
      // Fire the render request
      const res = await fetch(`/api/campaigns/${activeCampaign.id}/render`, { method: 'POST' });

      if (res.ok) {
        try {
          const updated = await res.json();
          setActiveCampaign(updated);
        } catch {
          // JSON parse failed - poll for status instead
        }
      }

      // Poll for updates until done
      let attempts = 0;
      const maxAttempts = 60;
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000));
        const pollRes = await fetch(`/api/campaigns/${activeCampaign.id}`);
        if (pollRes.ok) {
          const latest = await pollRes.json();
          setActiveCampaign(latest);
          if (latest.status === 'done' || latest.status === 'reviewing') break;
        }
        attempts++;
      }
    } catch (err) {
      console.error('Render failed:', err);
    }

    setRendering(false);
    loadCampaigns();
  };

  const handleRegenerate = async () => {
    if (!activeCampaign || !regenerateVariant) return;
    setRegenerating(true);
    try {
      const res = await fetch(`/api/campaigns/${activeCampaign.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: regenerateVariant.id,
          prompt: regeneratePrompt,
          count: 3,
        }),
      });
      if (res.ok) {
        const { campaign } = await res.json();
        setActiveCampaign(campaign);
      }
    } catch (err) {
      console.error('Regeneration failed:', err);
    } finally {
      setRegenerating(false);
      setRegenerateVariant(null);
      setRegeneratePrompt('');
    }
  };

  const handleDownloadAll = async () => {
    if (!activeCampaign) return;
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    const doneOutputs: { headline: string; format: string; path: string }[] = [];
    for (const variant of activeCampaign.variants.filter(v => v.approved)) {
      for (const output of variant.outputs.filter(o => o.status === 'done' && o.outputPath)) {
        doneOutputs.push({
          headline: variant.fieldValues.headline || variant.id,
          format: output.format,
          path: output.outputPath!,
        });
      }
    }

    // Fetch all blobs via proxy to avoid CORS issues
    const results = await Promise.all(
      doneOutputs.map(async (item) => {
        try {
          const proxyUrl = `/api/download?url=${encodeURIComponent(item.path)}&filename=${encodeURIComponent(`${item.headline}-${item.format}.jpg`)}`;
          const res = await fetch(proxyUrl);
          if (!res.ok) throw new Error('Fetch failed');
          return { ...item, blob: await res.blob() };
        } catch {
          return null;
        }
      })
    );

    for (const result of results) {
      if (result) {
        // Sanitize filename
        const safeName = result.headline.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '').trim();
        zip.file(`${safeName}-${result.format}.jpg`, result.blob);
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCampaign.name}-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const deleteCampaign = async (id: string) => {
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
    loadCampaigns();
  };

  // Setup view
  if (view === 'setup') {
    return (
      <div className="p-6">
        <button onClick={() => { setView('list'); setActiveCampaign(null); }}
          className="text-[#6b7280] text-sm mb-4 hover:text-white">← Zurück</button>
        <h1 className="text-xl font-bold mb-6 font-[family-name:var(--font-heading)]">Neue Kampagne</h1>
        <CampaignSetup studioId={studioId} onGenerate={handleGenerate} loading={generating} />
      </div>
    );
  }

  // Review view
  if (view === 'review' && activeCampaign) {
    return (
      <>
        <div className="flex flex-col h-full">
          <div className="px-6 pt-6 pb-2 flex justify-between items-center flex-shrink-0">
            <div>
              <button onClick={() => { setView('list'); setActiveCampaign(null); }}
                className="text-[#6b7280] text-sm mb-2 hover:text-white block">← Zurück</button>
              <h1 className="text-xl font-bold font-[family-name:var(--font-heading)]">{activeCampaign.name}</h1>
              <p className="text-[#6b7280] text-sm">{activeCampaign.variants.length} Varianten generiert</p>
            </div>
          </div>
          <VariantGrid
            variants={activeCampaign.variants}
            formats={activeCampaign.formats}
            onToggleApproved={handleToggleApproved}
            onEdit={id => setEditingVariant(activeCampaign.variants.find(v => v.id === id) || null)}
            onRegenerate={id => {
              const v = activeCampaign.variants.find(v => v.id === id);
              if (v) { setRegenerateVariant(v); setRegeneratePrompt(''); }
            }}
            onRender={handleRender}
            rendering={rendering}
            onFeedback={handleFeedback}
            feedbackMap={feedbackMap}
          />
        </div>
        {editingVariant && (
          <CreativeEditorModal
            variant={editingVariant}
            studioId={studioId}
            personAssets={personAssets}
            bgAssets={bgAssets}
            onSave={handleEditorSave}
            onClose={() => setEditingVariant(null)}
            onAssetsChanged={loadAssets}
          />
        )}
        {regenerateVariant && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
            onClick={() => setRegenerateVariant(null)}>
            <div className="glass-panel rounded-2xl max-w-lg w-full p-6"
              onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold text-lg font-[family-name:var(--font-heading)]">Mehr in diesem Stil</h3>
                <button onClick={() => setRegenerateVariant(null)}
                  className="text-[#6b7280] hover:text-white text-xl">x</button>
              </div>
              <div className="bg-[#050507] rounded-xl p-4 mb-4 flex items-center justify-center h-48 overflow-hidden">
                <div className="pointer-events-none" style={{ transform: 'scale(0.4)', transformOrigin: 'center' }} />
                <p className="text-[#9ca3af] text-sm text-center">
                  Vorlage: <span className="text-white font-semibold">{regenerateVariant.fieldValues.headline || 'Variante'}</span>
                </p>
              </div>
              <div className="mb-4">
                <label className="text-[#9ca3af] text-xs uppercase tracking-wider mb-1.5 block">
                  Was soll angepasst werden? (optional)
                </label>
                <textarea
                  value={regeneratePrompt}
                  onChange={e => setRegeneratePrompt(e.target.value)}
                  placeholder="z.B. 'Headline groesser, Person mehr links, dunklerer Hintergrund' oder leer lassen fuer automatische Variationen"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none resize-none h-20 focus:border-[#00D4FF]/50"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="flex-1 bg-[#00D4FF] hover:bg-[#00b4d8] disabled:opacity-50 text-black font-bold py-3 rounded-full text-sm transition-all btn-primary shadow-[0_4px_20px_rgba(0,212,255,0.3)]"
                >
                  {regenerating ? 'Generiere 3 Variationen...' : '3 Variationen generieren'}
                </button>
                <button onClick={() => setRegenerateVariant(null)}
                  className="bg-white/[0.045] border border-white/10 text-[#e8eaed] py-3 px-5 rounded-full text-sm hover:bg-white/[0.08] transition-all">
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Render progress view
  if (view === 'rendering' && activeCampaign) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 pt-6 pb-2 flex-shrink-0">
          <button onClick={() => { setView('list'); setActiveCampaign(null); }}
            className="text-[#6b7280] text-sm mb-2 hover:text-white block">← Zurück</button>
          <h1 className="text-xl font-bold font-[family-name:var(--font-heading)]">{activeCampaign.name}</h1>
        </div>
        <RenderProgress
          variants={activeCampaign.variants}
          formats={activeCampaign.formats}
          onDownloadAll={handleDownloadAll}
        />
      </div>
    );
  }

  // List view (default)
  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold font-[family-name:var(--font-heading)]">Kampagnen</h1>
          <p className="text-[#6b7280] text-sm mt-1">{campaigns.length} Kampagnen</p>
        </div>
        <button onClick={() => setView('setup')}
          className="bg-[#00D4FF] hover:bg-[#00b4d8] text-black font-bold py-2 px-4 rounded-full text-sm transition-all btn-primary shadow-[0_4px_20px_rgba(0,212,255,0.3)]">
          + Neue Kampagne
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[#4b5563] text-sm mb-4">Noch keine Kampagnen erstellt</p>
          <button onClick={() => setView('setup')}
            className="bg-[#00D4FF] hover:bg-[#00b4d8] text-black font-bold py-2.5 px-6 rounded-full text-sm transition-all btn-primary">
            Erste Kampagne erstellen
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id}
              className="glass-card rounded-xl p-4 flex justify-between items-center cursor-pointer transition-all hover:-translate-y-0.5"
              onClick={() => openCampaign(c)}>
              <div>
                <h3 className="text-white font-semibold">{c.name}</h3>
                <p className="text-[#6b7280] text-xs mt-0.5">
                  {c.variants.length} Varianten · {c.formats.length} Formate ·
                  {new Date(c.createdAt).toLocaleDateString('de')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  c.status === 'done' ? 'bg-[#22c55e]/20 text-[#22c55e]' :
                  c.status === 'rendering' ? 'bg-[#00D4FF]/20 text-[#00D4FF]' :
                  c.status === 'reviewing' ? 'bg-[#2196F3]/20 text-[#2196F3]' :
                  'bg-white/[0.045] text-[#9ca3af]'
                }`}>
                  {c.status === 'done' ? 'Fertig' :
                   c.status === 'rendering' ? 'Rendert...' :
                   c.status === 'reviewing' ? 'Review' : 'Entwurf'}
                </span>
                <button onClick={e => { e.stopPropagation(); deleteCampaign(c.id); }}
                  className="text-[#6b7280] hover:text-red-400 text-sm">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
