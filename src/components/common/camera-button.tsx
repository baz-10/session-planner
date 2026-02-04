'use client';

import { useState, useCallback } from 'react';
import {
  captureOrPickPhoto,
  takePhoto,
  pickFromGallery,
  dataUrlToFile,
  resizeImage,
  CapturedImage,
} from '@/lib/native/camera';
import { isNative } from '@/lib/native/capacitor-utils';

interface CameraButtonProps {
  onCapture: (file: File) => void;
  onError?: (error: string) => void;
  className?: string;
  variant?: 'button' | 'icon' | 'fab';
  label?: string;
  maxSize?: number; // Max dimension in pixels
  quality?: number; // 0-100
  showSourceOptions?: boolean;
}

export function CameraButton({
  onCapture,
  onError,
  className = '',
  variant = 'button',
  label = 'Add Photo',
  maxSize = 1200,
  quality = 90,
  showSourceOptions = true,
}: CameraButtonProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const processImage = useCallback(
    async (image: CapturedImage | null) => {
      if (!image || !image.dataUrl) {
        return;
      }

      try {
        // Resize if needed
        const resized = await resizeImage(image.dataUrl, maxSize, maxSize, quality / 100);
        const file = dataUrlToFile(resized, `photo_${Date.now()}.jpg`);
        onCapture(file);
      } catch (error) {
        console.error('Failed to process image:', error);
        onError?.('Failed to process image');
      }
    },
    [maxSize, quality, onCapture, onError]
  );

  const handleCapture = useCallback(
    async (source: 'camera' | 'gallery' | 'prompt') => {
      setIsCapturing(true);
      setShowOptions(false);

      try {
        let image: CapturedImage | null = null;

        switch (source) {
          case 'camera':
            image = await takePhoto({ quality });
            break;
          case 'gallery':
            image = await pickFromGallery({ quality });
            break;
          case 'prompt':
          default:
            image = await captureOrPickPhoto({ quality });
            break;
        }

        await processImage(image);
      } catch (error) {
        console.error('Capture failed:', error);
        onError?.('Failed to capture photo');
      } finally {
        setIsCapturing(false);
      }
    },
    [quality, processImage, onError]
  );

  const handleClick = useCallback(() => {
    if (isNative() && showSourceOptions) {
      setShowOptions(true);
    } else {
      handleCapture('prompt');
    }
  }, [showSourceOptions, handleCapture]);

  // Render based on variant
  const renderButton = () => {
    switch (variant) {
      case 'icon':
        return (
          <button
            onClick={handleClick}
            disabled={isCapturing}
            className={`p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg disabled:opacity-50 ${className}`}
            title={label}
          >
            {isCapturing ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            )}
          </button>
        );

      case 'fab':
        return (
          <button
            onClick={handleClick}
            disabled={isCapturing}
            className={`fixed bottom-6 right-6 p-4 bg-primary text-white rounded-full shadow-lg hover:bg-primary-light disabled:opacity-50 z-50 ${className}`}
            title={label}
          >
            {isCapturing ? (
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            )}
          </button>
        );

      default:
        return (
          <button
            onClick={handleClick}
            disabled={isCapturing}
            className={`px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2 ${className}`}
          >
            {isCapturing ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            )}
            <span>{label}</span>
          </button>
        );
    }
  };

  return (
    <>
      {renderButton()}

      {/* Source Options Modal */}
      {showOptions && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4 sm:items-center">
          <div className="bg-white rounded-t-xl sm:rounded-xl w-full max-w-sm overflow-hidden animate-slide-up">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-center">Add Photo</h3>
            </div>

            <div className="p-2">
              <button
                onClick={() => handleCapture('camera')}
                className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 rounded-lg"
              >
                <div className="p-2 bg-primary/10 rounded-full">
                  <svg
                    className="w-6 h-6 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-medium">Take Photo</p>
                  <p className="text-sm text-gray-500">Use your camera</p>
                </div>
              </button>

              <button
                onClick={() => handleCapture('gallery')}
                className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 rounded-lg"
              >
                <div className="p-2 bg-purple-100 rounded-full">
                  <svg
                    className="w-6 h-6 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-medium">Choose from Library</p>
                  <p className="text-sm text-gray-500">Select an existing photo</p>
                </div>
              </button>
            </div>

            <div className="p-2 border-t border-gray-200">
              <button
                onClick={() => setShowOptions(false)}
                className="w-full px-4 py-3 text-center text-gray-500 font-medium hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
