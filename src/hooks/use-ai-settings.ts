'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';

export interface AISettings {
  openaiApiKey: string | null;
  aiEnabled: boolean;
  preferredModel: string;
}

const STORAGE_KEY = 'session_planner_ai_settings';

export function useAISettings() {
  const { user } = useAuth();
  const supabase = getBrowserSupabaseClient();
  const [settings, setSettings] = useState<AISettings>({
    openaiApiKey: null,
    aiEnabled: false,
    preferredModel: 'gpt-4o-mini',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings from profile on mount
  useEffect(() => {
    if (user) {
      loadSettings();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  const loadSettings = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('settings')
        .eq('id', user.id)
        .single();

      if (profile?.settings) {
        const aiSettings = (profile.settings as Record<string, unknown>).ai as AISettings | undefined;
        if (aiSettings) {
          setSettings({
            openaiApiKey: aiSettings.openaiApiKey || null,
            aiEnabled: aiSettings.aiEnabled || false,
            preferredModel: aiSettings.preferredModel || 'gpt-4o-mini',
          });
        }
      }
    } catch (error) {
      console.error('Error loading AI settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, supabase]);

  const saveSettings = useCallback(
    async (newSettings: Partial<AISettings>): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      setIsSaving(true);
      try {
        // Get current profile settings
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase as any)
          .from('profiles')
          .select('settings')
          .eq('id', user.id)
          .single();

        const currentSettings = (profile?.settings || {}) as Record<string, unknown>;
        const updatedAISettings = {
          ...settings,
          ...newSettings,
        };

        // Update profile with new AI settings
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('profiles')
          .update({
            settings: {
              ...currentSettings,
              ai: updatedAISettings,
            },
          })
          .eq('id', user.id);

        if (error) {
          throw error;
        }

        setSettings(updatedAISettings);
        return { success: true };
      } catch (error) {
        console.error('Error saving AI settings:', error);
        return { success: false, error: 'Failed to save settings' };
      } finally {
        setIsSaving(false);
      }
    },
    [user, supabase, settings]
  );

  const validateApiKey = useCallback(
    async (apiKey: string): Promise<{ valid: boolean; error?: string }> => {
      try {
        const response = await fetch('/api/ai/validate-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey }),
        });

        return await response.json();
      } catch (error) {
        return { valid: false, error: 'Validation failed' };
      }
    },
    []
  );

  const clearApiKey = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    return saveSettings({ openaiApiKey: null, aiEnabled: false });
  }, [saveSettings]);

  return {
    settings,
    isLoading,
    isSaving,
    saveSettings,
    validateApiKey,
    clearApiKey,
    hasApiKey: Boolean(settings.openaiApiKey),
  };
}
