import { DEFAULT_PROMPTS } from './prompts';
import type { PromptType } from './types';

/**
 * Gets the best available prompt for a given type.
 * Priority: studio-specific > global evolved > static default
 */
export async function getEvolvedPrompt(
  studioId: string,
  promptType: PromptType,
): Promise<string> {
  const { getStorage } = await import('./storage');
  const storage = getStorage();

  // 1. Check studio-specific override
  const studioPrompt = await storage.getSystemPrompt(studioId, promptType);
  if (studioPrompt) return studioPrompt;

  // 2. Check global evolved prompt (Supabase only)
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { supabaseAdmin } = await import('./supabase');
      const { data } = await supabaseAdmin
        .from('global_prompts')
        .select('prompt')
        .eq('prompt_type', promptType)
        .single();

      if (data?.prompt) return data.prompt;
    } catch {
      // Table might not exist yet or other error - fall through to default
    }
  }

  // 3. Fall back to static default
  return DEFAULT_PROMPTS[promptType];
}
