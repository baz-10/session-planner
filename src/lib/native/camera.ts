/**
 * Camera Service
 *
 * Provides camera and photo library access for mobile and web platforms.
 */

import { Camera, CameraResultType, CameraSource, Photo, ImageOptions } from '@capacitor/camera';
import { isNative, isPluginAvailable, isWeb } from './capacitor-utils';

export interface CapturedImage {
  dataUrl: string;
  format: string;
  path?: string;
  webPath?: string;
  blob?: Blob;
}

export interface CameraOptions {
  quality?: number;
  allowEditing?: boolean;
  resultType?: CameraResultType;
  source?: CameraSource;
  width?: number;
  height?: number;
  correctOrientation?: boolean;
  saveToGallery?: boolean;
  promptLabelHeader?: string;
  promptLabelPhoto?: string;
  promptLabelPicture?: string;
}

const DEFAULT_OPTIONS: CameraOptions = {
  quality: 90,
  allowEditing: false,
  resultType: CameraResultType.DataUrl,
  correctOrientation: true,
  width: 1200,
  height: 1200,
};

type PermissionState = 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'limited';

/**
 * Check camera permissions
 */
export async function checkCameraPermissions(): Promise<{
  camera: PermissionState;
  photos: PermissionState;
}> {
  if (!isNative() || !isPluginAvailable('Camera')) {
    return { camera: 'granted', photos: 'granted' };
  }

  try {
    const status = await Camera.checkPermissions();
    return {
      camera: status.camera,
      photos: status.photos,
    };
  } catch (error) {
    console.error('Failed to check camera permissions:', error);
    return { camera: 'denied', photos: 'denied' };
  }
}

/**
 * Request camera permissions
 */
export async function requestCameraPermissions(): Promise<{
  camera: PermissionState;
  photos: PermissionState;
}> {
  if (!isNative() || !isPluginAvailable('Camera')) {
    return { camera: 'granted', photos: 'granted' };
  }

  try {
    const status = await Camera.requestPermissions();
    return {
      camera: status.camera,
      photos: status.photos,
    };
  } catch (error) {
    console.error('Failed to request camera permissions:', error);
    return { camera: 'denied', photos: 'denied' };
  }
}

/**
 * Take a photo using the camera
 */
export async function takePhoto(options?: CameraOptions): Promise<CapturedImage | null> {
  const mergedOptions: ImageOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    source: CameraSource.Camera,
    resultType: CameraResultType.DataUrl,
  };

  return captureImage(mergedOptions);
}

/**
 * Pick a photo from the gallery
 */
export async function pickFromGallery(options?: CameraOptions): Promise<CapturedImage | null> {
  const mergedOptions: ImageOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    source: CameraSource.Photos,
    resultType: CameraResultType.DataUrl,
  };

  return captureImage(mergedOptions);
}

/**
 * Show photo source prompt (camera or gallery)
 */
export async function captureOrPickPhoto(options?: CameraOptions): Promise<CapturedImage | null> {
  const mergedOptions: ImageOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    source: CameraSource.Prompt,
    resultType: CameraResultType.DataUrl,
    promptLabelHeader: options?.promptLabelHeader || 'Photo',
    promptLabelPhoto: options?.promptLabelPhoto || 'From Gallery',
    promptLabelPicture: options?.promptLabelPicture || 'Take Photo',
  };

  return captureImage(mergedOptions);
}

/**
 * Internal function to capture image
 */
async function captureImage(options: ImageOptions): Promise<CapturedImage | null> {
  // For web, use file input as fallback
  if (isWeb()) {
    return captureImageWeb(options.source);
  }

  if (!isPluginAvailable('Camera')) {
    console.warn('Camera plugin not available');
    return captureImageWeb(options.source);
  }

  try {
    const photo = await Camera.getPhoto(options);
    return photoToCapture(photo);
  } catch (error) {
    // User cancelled or other error
    if (error instanceof Error && error.message.includes('User cancelled')) {
      return null;
    }
    console.error('Failed to capture image:', error);
    return null;
  }
}

/**
 * Convert Camera Photo to CapturedImage
 */
function photoToCapture(photo: Photo): CapturedImage {
  return {
    dataUrl: photo.dataUrl || '',
    format: photo.format,
    path: photo.path,
    webPath: photo.webPath,
  };
}

/**
 * Web fallback for image capture using file input
 */
function captureImageWeb(source?: CameraSource): Promise<CapturedImage | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    // For camera source, add capture attribute
    if (source === CameraSource.Camera) {
      input.capture = 'environment';
    }

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const dataUrl = await fileToDataUrl(file);
        resolve({
          dataUrl,
          format: file.type.split('/')[1] || 'jpeg',
          blob: file,
        });
      } catch (error) {
        console.error('Failed to read file:', error);
        resolve(null);
      }
    };

    input.oncancel = () => resolve(null);
    input.click();
  });
}

/**
 * Convert File to data URL
 */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert data URL to Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Convert data URL to File
 */
export function dataUrlToFile(dataUrl: string, filename: string): File {
  const blob = dataUrlToBlob(dataUrl);
  return new File([blob], filename, { type: blob.type });
}

/**
 * Resize an image
 */
export async function resizeImage(
  dataUrl: string,
  maxWidth: number,
  maxHeight: number,
  quality: number = 0.9
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
