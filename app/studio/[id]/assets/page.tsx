'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileUpload } from '@/components/file-upload';
import { AssetGrid } from '@/components/asset-grid';
import { ImageGenerator } from '@/components/image-generator';
import type { AssetType } from '@/lib/types';

const ASSET_SECTIONS: { type: AssetType; label: string; description: string }[] = [
  { type: 'background', label: 'Hintergrundbilder', description: 'Gym-Fotos für den Hintergrund deiner Creatives' },
  { type: 'person', label: 'Personen', description: 'Freigestellte Personen (PNG mit Transparenz)' },
  { type: 'logo', label: 'Logos', description: 'Studio-Logos' },
  { type: 'generated', label: 'AI-generiert', description: 'Per Imagen 4 generierte Bilder' },
];

export default function AssetsPage() {
  const { id: studioId } = useParams<{ id: string }>();
  const [assets, setAssets] = useState<Record<string, string[]>>({});
  const [showGenerator, setShowGenerator] = useState(false);

  const loadAssets = async () => {
    const res = await fetch(`/api/assets/${studioId}`);
    const allPaths: string[] = await res.json();

    const grouped: Record<string, string[]> = { background: [], person: [], logo: [], generated: [] };
    for (const p of allPaths) {
      for (const type of ['background', 'person', 'logo', 'generated']) {
        if (p.includes(`/${type}/`) || p.includes(`\\${type}\\`)) {
          grouped[type].push(p);
          break;
        }
      }
    }
    setAssets(grouped);
  };

  useEffect(() => { loadAssets(); }, [studioId]);

  const uploadFiles = async (files: File[], type: AssetType) => {
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('studioId', studioId);
      formData.append('type', type);
      await fetch('/api/assets/upload', { method: 'POST', body: formData });
    }
    loadAssets();
  };

  const deleteAsset = async (path: string) => {
    await fetch(`/api/assets/${studioId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    loadAssets();
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold">Asset Library</h1>
          <p className="text-[#666] text-sm mt-1">Verwalte alle Bilder für deine Creatives</p>
        </div>
        <button
          onClick={() => setShowGenerator(!showGenerator)}
          className="bg-[#FF4500] hover:bg-[#e63e00] text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors"
        >
          {showGenerator ? 'Schließen' : 'AI Bild generieren ✨'}
        </button>
      </div>

      {showGenerator && (
        <div className="mb-6">
          <ImageGenerator studioId={studioId} assetType="generated" onGenerated={() => loadAssets()} />
        </div>
      )}

      <div className="space-y-8">
        {ASSET_SECTIONS.map(section => (
          <div key={section.type}>
            <h2 className="text-sm font-semibold text-[#aaa] uppercase tracking-wider mb-1">{section.label}</h2>
            <p className="text-[#555] text-xs mb-3">{section.description}</p>
            <AssetGrid
              assets={assets[section.type] || []}
              onDelete={deleteAsset}
            />
            <div className="mt-2">
              <FileUpload
                onFiles={files => uploadFiles(files, section.type)}
                accept={section.type === 'person' ? 'image/png' : 'image/*'}
                label={`+ ${section.label} hochladen`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
