'use client';

const DEFAULT_DISPLAY_NAME = 'Session Planner';

export interface BrandingState {
  displayName: string;
  logoUrl: string | null;
  isWhitelabelActive: boolean;
}

export function useBranding(): BrandingState {
  return {
    displayName: DEFAULT_DISPLAY_NAME,
    logoUrl: null,
    isWhitelabelActive: false,
  };
}
