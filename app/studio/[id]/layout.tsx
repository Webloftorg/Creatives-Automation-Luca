import { Sidebar } from '@/components/sidebar';
import { getStorage } from '@/lib/storage';

export default async function StudioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const storage = getStorage();
  await storage.init();
  const studio = await storage.getStudio(id);

  return (
    <div className="flex h-screen">
      <Sidebar studioId={id} studioName={studio?.name} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
