import type { CapacitorConfig } from '@capacitor/cli';

const capacitorServerUrl = process.env.CAPACITOR_SERVER_URL;
const isDevelopment = process.env.NODE_ENV === 'development';

const config: CapacitorConfig = {
  appId: 'com.sessionplanner.app',
  appName: 'Session Planner',
  webDir: 'out',
  server: {
    // Development uses the local Next server. Production native builds can set
    // CAPACITOR_SERVER_URL to the deployed Next.js app while preserving API routes.
    url: capacitorServerUrl || (isDevelopment ? 'http://localhost:3000' : undefined),
    cleartext: isDevelopment,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Camera: {
      permissionType: 'camera',
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1e3a5f',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1e3a5f',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
  ios: {
    contentInset: 'automatic',
    scheme: 'Session Planner',
    backgroundColor: '#ffffff',
  },
  android: {
    backgroundColor: '#ffffff',
    allowMixedContent: isDevelopment,
    captureInput: true,
    webContentsDebuggingEnabled: process.env.NODE_ENV === 'development',
  },
};

export default config;
