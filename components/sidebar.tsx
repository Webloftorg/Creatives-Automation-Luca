'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { icon: '✏️', label: 'Creatives', path: 'creatives' },
  { icon: '📦', label: 'Kampagnen', path: 'campaigns' },
  { icon: '🎨', label: 'Templates', path: 'templates' },
  { icon: '📷', label: 'Assets', path: 'assets' },
  { icon: '⚙️', label: 'Einstellungen', path: 'settings' },
];

export function Sidebar({ studioId, studioName }: { studioId: string; studioName?: string }) {
  const pathname = usePathname();

  return (
    <div className="w-[52px] hover:w-[200px] bg-[#111] border-r border-[#222] flex flex-col py-4 transition-all duration-200 overflow-hidden group flex-shrink-0">
      <Link href="/" className="px-[10px] mb-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-[#FF4500] rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {studioName?.[0] || 'S'}
        </div>
        <span className="text-white text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          {studioName || 'Studio'}
        </span>
      </Link>

      <nav className="flex flex-col gap-1 px-[10px]">
        {NAV_ITEMS.map(item => {
          const href = `/studio/${studioId}/${item.path}`;
          const isActive = pathname === href;
          return (
            <Link key={item.path} href={href}
              className={`flex items-center gap-3 rounded-lg px-2 py-2 transition-colors ${
                isActive ? 'bg-[#FF4500]' : 'hover:bg-[#1a1a1a]'
              }`}>
              <span className="text-base flex-shrink-0 w-8 text-center">{item.icon}</span>
              <span className="text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
