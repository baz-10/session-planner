/**
 * Push Notifications Service
 *
 * Handles push notification registration and management for mobile apps.
 */

import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { isNative, isPluginAvailable } from './capacitor-utils';

export interface PushNotificationHandlers {
  onRegistration?: (token: string) => void;
  onRegistrationError?: (error: Error) => void;
  onNotificationReceived?: (notification: PushNotificationSchema) => void;
  onNotificationAction?: (action: ActionPerformed) => void;
}

let isInitialized = false;

/**
 * Initialize push notifications
 */
export async function initializePushNotifications(
  handlers?: PushNotificationHandlers
): Promise<{ success: boolean; token?: string; error?: string }> {
  if (!isNative() || !isPluginAvailable('PushNotifications')) {
    return { success: false, error: 'Push notifications not available on this platform' };
  }

  if (isInitialized) {
    return { success: true };
  }

  try {
    // Request permission
    const permissionStatus = await PushNotifications.requestPermissions();

    if (permissionStatus.receive !== 'granted') {
      return { success: false, error: 'Push notification permission denied' };
    }

    // Register for push notifications
    await PushNotifications.register();

    // Set up listeners
    PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push registration success:', token.value);
      handlers?.onRegistration?.(token.value);
    });

    PushNotifications.addListener('registrationError', (error: { error: string }) => {
      console.error('Push registration error:', error.error);
      handlers?.onRegistrationError?.(new Error(error.error));
    });

    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Push notification received:', notification);
      handlers?.onNotificationReceived?.(notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('Push notification action:', action);
      handlers?.onNotificationAction?.(action);
    });

    isInitialized = true;
    return { success: true };
  } catch (error) {
    console.error('Failed to initialize push notifications:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize push notifications',
    };
  }
}

type PermissionState = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';

/**
 * Check push notification permission status
 */
export async function checkPermissionStatus(): Promise<PermissionState> {
  if (!isNative() || !isPluginAvailable('PushNotifications')) {
    return 'denied';
  }

  try {
    const status = await PushNotifications.checkPermissions();
    return status.receive;
  } catch (error) {
    console.error('Failed to check permission status:', error);
    return 'denied';
  }
}

/**
 * Get delivered notifications
 */
export async function getDeliveredNotifications(): Promise<PushNotificationSchema[]> {
  if (!isNative() || !isPluginAvailable('PushNotifications')) {
    return [];
  }

  try {
    const result = await PushNotifications.getDeliveredNotifications();
    return result.notifications;
  } catch (error) {
    console.error('Failed to get delivered notifications:', error);
    return [];
  }
}

/**
 * Remove all delivered notifications
 */
export async function removeAllDeliveredNotifications(): Promise<void> {
  if (!isNative() || !isPluginAvailable('PushNotifications')) {
    return;
  }

  try {
    await PushNotifications.removeAllDeliveredNotifications();
  } catch (error) {
    console.error('Failed to remove notifications:', error);
  }
}

/**
 * Remove specific delivered notifications
 */
export async function removeDeliveredNotifications(ids: string[]): Promise<void> {
  if (!isNative() || !isPluginAvailable('PushNotifications')) {
    return;
  }

  try {
    await PushNotifications.removeDeliveredNotifications({ notifications: ids.map((id) => ({ id, data: {} })) });
  } catch (error) {
    console.error('Failed to remove notifications:', error);
  }
}

/**
 * Create a channel for Android notifications
 */
export async function createNotificationChannel(
  id: string,
  name: string,
  description: string,
  importance: 1 | 2 | 3 | 4 | 5 = 4
): Promise<void> {
  if (!isNative() || !isPluginAvailable('PushNotifications')) {
    return;
  }

  try {
    await PushNotifications.createChannel({
      id,
      name,
      description,
      importance,
      visibility: 1,
      lights: true,
      vibration: true,
    });
  } catch (error) {
    console.error('Failed to create notification channel:', error);
  }
}
