/**
 * Capacitor Native Utilities
 *
 * Provides utilities for detecting and working with Capacitor native environment.
 */

import { Capacitor } from '@capacitor/core';

/**
 * Check if running in a native Capacitor environment
 */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Get the current platform
 */
export function getPlatform(): 'ios' | 'android' | 'web' {
  return Capacitor.getPlatform() as 'ios' | 'android' | 'web';
}

/**
 * Check if running on iOS
 */
export function isIOS(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

/**
 * Check if running on Android
 */
export function isAndroid(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/**
 * Check if running on web
 */
export function isWeb(): boolean {
  return Capacitor.getPlatform() === 'web';
}

/**
 * Check if a plugin is available
 */
export function isPluginAvailable(pluginName: string): boolean {
  return Capacitor.isPluginAvailable(pluginName);
}

/**
 * Safe platform-specific action wrapper
 */
export async function runNativeAction<T>(
  nativeAction: () => Promise<T>,
  webFallback?: () => Promise<T> | T
): Promise<T | null> {
  if (isNative()) {
    try {
      return await nativeAction();
    } catch (error) {
      console.error('Native action failed:', error);
      return null;
    }
  } else if (webFallback) {
    return await webFallback();
  }
  return null;
}
