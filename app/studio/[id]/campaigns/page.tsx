// app/studio/[id]/campaigns/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { CampaignSetup } from '@/components/campaign-setup';
import { VariantGrid } from '@/components/variant-grid';
import { QuickEditOverlay } from '@/components/quick-edit-overlay';
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
  const [personAssets, setPersonAssets] = useState<string[]>([]);
  const [bgAssets, setBgAssets] = useState<string[]>([]);

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
    baseTemplateId?: string;
    designVariantCount: number;
    headlineVariantCount: number;
    formats: CreativeFormat[];
    defaultValues: Record<string, string>;
  }) => {
    setGenerating(true);

    const campaign: Campaign = {
      id: uuidv4(),
      studioId,
      ...config,
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

  const handleQuickEditSave = async (updatedValues: Record<string, string>) => {
    if (!activeCampaign || !editingVariant) return;
    const updated = {
      ...activeCampaign,
      variants: activeCampaign.variants.map(v =>
        v.id === editingVariant.id ? { ...v, fieldValues: updatedValues } : v
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

    const res = await fetch(`/api/campaigns/${activeCampaign.id}/render`, { method: 'POST' });
    const updated = await res.json();

    if (res.ok) {
      setActiveCampaign(updated);
    }

    setRendering(false);
    loadCampaigns();
  };

  const handleDownloadAll = async () => {
    if (!activeCampaign) return;
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const variant of activeCampaign.variants.filter(v => v.approved)) {
      for (const output of variant.outputs.filter(o => o.status === 'done' && o.outputPath)) {
        const blob = await fetch(output.outputPath!).then(r => r.blob());
        zip.file(`${variant.fieldValues.headline || variant.id}-${output.format}.png`, blob);
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeCampaign.name}-${Date.now()}.zip`;
    a.click();
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
          className="text-[#666] text-sm mb-4 hover:text-white">← Zurück</button>
        <h1 className="text-xl font-bold mb-6">Neue Kampagne</h1>
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
                className="text-[#666] text-sm mb-2 hover:text-white block">← Zurück</button>
              <h1 className="text-xl font-bold">{activeCampaign.name}</h1>
              <p className="text-[#666] text-sm">{activeCampaign.variants.length} Varianten generiert</p>
            </div>
          </div>
          <VariantGrid
            variants={activeCampaign.variants}
            formats={activeCampaign.formats}
            onToggleApproved={handleToggleApproved}
            onEdit={id => setEditingVariant(activeCampaign.variants.find(v => v.id === id) || null)}
            onRender={handleRender}
            rendering={rendering}
          />
        </div>
        {editingVariant && (
          <QuickEditOverlay
            variant={editingVariant}
            personAssets={personAssets}
            bgAssets={bgAssets}
            onSave={handleQuickEditSave}
            onClose={() => setEditingVariant(null)}
          />
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
            className="text-[#666] text-sm mb-2 hover:text-white block">← Zurück</button>
          <h1 className="text-xl font-bold">{activeCampaign.name}</h1>
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
          <h1 className="text-xl font-bold">Kampagnen</h1>
          <p className="text-[#666] text-sm mt-1">{campaigns.length} Kampagnen</p>
        </div>
        <button onClick={() => setView('setup')}
          className="bg-[#FF4500] hover:bg-[#e63e00] text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors">
          + Neue Kampagne
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[#444] text-sm mb-4">Noch keine Kampagnen erstellt</p>
          <button onClick={() => setView('setup')}
            className="bg-[#FF4500] hover:bg-[#e63e00] text-white font-bold py-2.5 px-6 rounded-lg text-sm transition-colors">
            Erste Kampagne erstellen
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <div key={c.id}
              className="bg-[#111] border border-[#333] rounded-xl p-4 flex justify-between items-center hover:border-[#555] cursor-pointer transition-colors"
              onClick={() => openCampaign(c)}>
              <div>
                <h3 className="text-white font-semibold">{c.name}</h3>
                <p className="text-[#666] text-xs mt-0.5">
                  {c.variants.length} Varianten · {c.formats.length} Formate ·
                  {new Date(c.createdAt).toLocaleDateString('de')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-md ${
                  c.status === 'done' ? 'bg-[#4CAF50]/20 text-[#4CAF50]' :
                  c.status === 'rendering' ? 'bg-[#FF4500]/20 text-[#FF4500]' :
                  c.status === 'reviewing' ? 'bg-[#2196F3]/20 text-[#2196F3]' :
                  'bg-[#333] text-[#888]'
                }`}>
                  {c.status === 'done' ? 'Fertig' :
                   c.status === 'rendering' ? 'Rendert...' :
                   c.status === 'reviewing' ? 'Review' : 'Entwurf'}
                </span>
                <button onClick={e => { e.stopPropagation(); deleteCampaign(c.id); }}
                  className="text-[#666] hover:text-red-400 text-sm">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
