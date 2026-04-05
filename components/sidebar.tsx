'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { icon: '📦', label: 'Kampagnen', path: 'campaigns' },
  { icon: '✏️', label: 'Creatives', path: 'creatives' },
  { icon: '🎨', label: 'Templates', path: 'templates' },
  { icon: '📷', label: 'Assets', path: 'assets' },
  { icon: '⚙️', label: 'Einstellungen', path: 'settings' },
];

export function Sidebar({ studioId, studioName }: { studioId: string; studioName?: string }) {
  const pathname = usePathname();

  return (
    <div
      className="sidebar-nav flex flex-col py-4 overflow-hidden group flex-shrink-0"
      style={{
        background: 'rgba(14,14,21, 0.85)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <Link href="/" className="px-[10px] mb-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-[#00D4FF] rounded-lg flex items-center justify-center text-black font-bold text-sm flex-shrink-0 shadow-[0_0_20px_rgba(0,212,255,0.3)]">
          {studioName?.[0] || 'S'}
        </div>
        <span className="text-white text-sm font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity font-[var(--font-heading)]">
          {studioName || 'Studio'}
        </span>
      </Link>

      <nav className="flex flex-col gap-1 px-[10px]">
        {NAV_ITEMS.map(item => {
          const href = `/studio/${studioId}/${item.path}`;
          const isActive = pathname === href;
          return (
            <Link key={item.path} href={href}
              className={`flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-200 ${
                isActive
                  ? 'bg-[#00D4FF]/15 text-[#00D4FF]'
                  : 'hover:bg-white/[0.04] text-[#9ca3af] hover:text-white'
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
