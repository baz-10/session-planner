'use client';

import { useBrandingContext } from '@/contexts/branding-context';

export function useBranding() {
  return useBrandingContext();
}
