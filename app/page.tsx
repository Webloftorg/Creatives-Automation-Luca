'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StudioCard } from '@/components/studio-card';
import type { Studio } from '@/lib/types';

export default function HomePage() {
  const [studios, setStudios] = useState<Studio[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/studios')
      .then(r => r.json())
      .then(setStudios)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold">Creative Generator</h1>
            <p className="text-[#666] text-sm mt-1">Fitness Ad Automation</p>
          </div>
          <button
            onClick={() => router.push('/onboarding')}
            className="bg-[#FF4500] hover:bg-[#e63e00] text-white font-bold py-3 px-6 rounded-lg transition-colors"
          >
            + Neues Studio
          </button>
        </div>

        {loading ? (
          <div className="text-[#666]">Lade Studios...</div>
        ) : studios.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-[#444] text-6xl mb-4">&#127947;</div>
            <h2 className="text-xl font-semibold mb-2">Noch keine Studios</h2>
            <p className="text-[#666] mb-6">Erstelle dein erstes Studio um loszulegen.</p>
            <button
              onClick={() => router.push('/onboarding')}
              className="bg-[#FF4500] hover:bg-[#e63e00] text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              Studio anlegen
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {studios.map(s => <StudioCard key={s.id} studio={s} />)}
          </div>
        )}
      </div>
    </div>
  );
}
