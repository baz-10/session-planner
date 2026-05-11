'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';

export interface AISettings {
  openaiApiKey: string | null;
  aiEnabled: boolean;
  preferredModel: string;
}

const API_KEY_STORAGE_KEY = 'session_planner_ai_settings';

function storageKeyForUser(userId: string): string {
  return `${API_KEY_STORAGE_KEY}:${userId}`;
}

function readStoredApiKey(userId: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const storageKey = storageKeyForUser(userId);
    const sessionValue = window.sessionStorage.getItem(storageKey)?.trim();
    if (sessionValue) return sessionValue;

    const legacyLocalValue = window.localStorage.getItem(storageKey)?.trim();
    if (!legacyLocalValue) return null;

    try {
      window.sessionStorage.setItem(storageKey, legacyLocalValue);
    } catch {
      // Keep the key in memory for this render if session storage is unavailable.
    }

    window.localStorage.removeItem(storageKey);
    return legacyLocalValue;
  } catch {
    return null;
  }
}

function writeStoredApiKey(userId: string, apiKey: string | null) {
  if (typeof window === 'undefined') return;

  const storageKey = storageKeyForUser(userId);

  try {
    if (apiKey) {
      window.sessionStorage.setItem(storageKey, apiKey);
    } else {
      window.sessionStorage.removeItem(storageKey);
    }
  } catch {
    // Session persistence can fail in private browsing; keep in-memory state.
  }

  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Best-effort cleanup of the legacy persistent API key cache.
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

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

  const loadSettings = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data: profile } = await (supabase as any)
        .from('profiles')
        .select('settings')
        .eq('id', user.id)
        .single();

      const profileSettings = isRecord(profile?.settings) ? profile.settings : {};
      const aiSettings = isRecord(profileSettings.ai) ? profileSettings.ai : {};
      const sessionApiKey = readStoredApiKey(user.id);
      const legacyProfileApiKey =
        typeof aiSettings.openaiApiKey === 'string' ? aiSettings.openaiApiKey.trim() : '';

      if (legacyProfileApiKey && !sessionApiKey) {
        writeStoredApiKey(user.id, legacyProfileApiKey);
      }

      const openaiApiKey = sessionApiKey || legacyProfileApiKey || null;

      const nextSettings = {
        openaiApiKey,
        aiEnabled:
          Boolean(openaiApiKey) &&
          (typeof aiSettings.aiEnabled === 'boolean' ? aiSettings.aiEnabled : false),
        preferredModel:
          typeof aiSettings.preferredModel === 'string'
            ? aiSettings.preferredModel
            : 'gpt-4o-mini',
      };

      setSettings(nextSettings);

      if (legacyProfileApiKey) {
        const safeAISettings = { ...aiSettings };
        delete safeAISettings.openaiApiKey;
        await supabase
          .from('profiles')
          .update({
            settings: {
              ...profileSettings,
              ai: safeAISettings,
            },
          })
          .eq('id', user.id);
      }
    } catch (error) {
      console.error('Error loading AI settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, supabase]);

  // Load settings from profile on mount
  useEffect(() => {
    if (user) {
      void loadSettings();
    } else {
      setIsLoading(false);
    }
  }, [user, loadSettings]);

  const saveSettings = useCallback(
    async (newSettings: Partial<AISettings>): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      setIsSaving(true);
      try {
        // Get current profile settings
        const { data: profile } = await (supabase as any)
          .from('profiles')
          .select('settings')
          .eq('id', user.id)
          .single();

        const currentSettings = isRecord(profile?.settings) ? profile.settings : {};
        const currentAISettings = isRecord(currentSettings.ai) ? currentSettings.ai : {};
        const nextApiKey =
          newSettings.openaiApiKey === undefined
            ? settings.openaiApiKey
            : newSettings.openaiApiKey?.trim() || null;

        if (newSettings.openaiApiKey !== undefined) {
          writeStoredApiKey(user.id, nextApiKey);
        }

        const updatedSettings = {
          openaiApiKey: nextApiKey,
          aiEnabled: Boolean(nextApiKey) && (newSettings.aiEnabled ?? settings.aiEnabled),
          preferredModel: newSettings.preferredModel ?? settings.preferredModel,
        };
        const safeProfileAISettings = {
          ...currentAISettings,
          aiEnabled: updatedSettings.aiEnabled,
          preferredModel: updatedSettings.preferredModel,
        };
        delete safeProfileAISettings.openaiApiKey;

        // Keep user API keys out of profile settings; profile rows can be visible to teammates.
        const { error } = await (supabase as any)
          .from('profiles')
          .update({
            settings: {
              ...currentSettings,
              ai: safeProfileAISettings,
            },
          })
          .eq('id', user.id);

        if (error) {
          throw error;
        }

        setSettings(updatedSettings);
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
      const normalizedApiKey = apiKey.trim();
      if (!normalizedApiKey) {
        return { valid: false, error: 'API key is required' };
      }

      try {
        const response = await fetch('/api/ai/validate-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: normalizedApiKey }),
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
