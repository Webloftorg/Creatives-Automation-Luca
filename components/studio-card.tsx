'use client';

import type { Studio } from '@/lib/types';
import Link from 'next/link';

export function StudioCard({ studio }: { studio: Studio }) {
  return (
    <Link href={`/studio/${studio.id}/creatives`}>
      <div className="bg-[#111] border border-[#222] rounded-xl p-5 hover:border-[#FF4500] transition-colors cursor-pointer group">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: studio.primaryColor }}
          >
            {studio.name[0]}
          </div>
          <div>
            <h3 className="font-semibold text-white group-hover:text-[#FF4500] transition-colors">
              {studio.name}
            </h3>
            <p className="text-sm text-[#666]">{studio.location}</p>
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
