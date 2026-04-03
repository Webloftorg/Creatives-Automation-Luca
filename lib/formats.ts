// lib/formats.ts
import type { CreativeFormat } from './types';

export const FORMAT_DIMENSIONS: Record<CreativeFormat, { width: number; height: number; label: string }> = {
  'instagram-post':  { width: 1080, height: 1080, label: 'Instagram Post (1080×1080)' },
  'instagram-story': { width: 1080, height: 1920, label: 'Instagram Story (1080×1920)' },
  'facebook-feed':   { width: 1200, height: 628,  label: 'Facebook Feed (1200×628)' },
  'facebook-story':  { width: 1080, height: 1920, label: 'Facebook Story (1080×1920)' },
};

export const ALL_FORMATS = Object.keys(FORMAT_DIMENSIONS) as CreativeFormat[];
