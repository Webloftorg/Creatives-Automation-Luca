'use client';

import type { Studio } from '@/lib/types';
import Link from 'next/link';

export function StudioCard({ studio }: { studio: Studio }) {
  if (!studio?.name) return null;
  return (
    <Link href={`/studio/${studio.id}/creatives`}>
      <div className="glass-card rounded-xl p-5 cursor-pointer group transition-all duration-300 hover:-translate-y-0.5">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-black font-bold text-lg shadow-[0_0_20px_rgba(0,212,255,0.2)]"
            style={{ backgroundColor: studio.primaryColor || '#00D4FF' }}
          >
            {studio.name[0]}
          </div>
          <div>
            <h3 className="font-semibold text-white group-hover:text-[#00D4FF] transition-colors font-[family-name:var(--font-heading)]">
              {studio.name}
            </h3>
            <p className="text-sm text-[#6b7280]">{studio.location || ''}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-5 h-5 rounded" style={{ backgroundColor: studio.primaryColor }} />
          <div className="w-5 h-5 rounded" style={{ backgroundColor: studio.secondaryColor }} />
          <div className="w-5 h-5 rounded" style={{ backgroundColor: studio.accentColor }} />
        </div>
      </div>
    </Link>
  );
}
