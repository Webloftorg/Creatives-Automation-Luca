import type { StorageAdapter } from './types';

// Re-export for backward compat with tests
export { FilesystemStorage } from './storage-filesystem';

let storageInstance: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (!storageInstance) {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Supabase mode (Vercel / production)
      const { SupabaseStorage } = require('./storage-supabase');
      storageInstance = new SupabaseStorage();
    } else {
      // Filesystem mode (local dev fallback)
      const { FilesystemStorage } = require('./storage-filesystem');
      storageInstance = new FilesystemStorage();
    }
  }
  return storageInstance!;
}
