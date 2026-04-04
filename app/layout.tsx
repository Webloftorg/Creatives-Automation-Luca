import type { Metadata } from 'next';
import { Sora, DM_Sans } from 'next/font/google';
import './globals.css';

const sora = Sora({ subsets: ['latin'], variable: '--font-heading' });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'Creative Generator',
  description: 'Fitness Ad Creative Automation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={`${sora.variable} ${dmSans.variable} ${dmSans.className}`}>{children}</body>
    </html>
  );
}
