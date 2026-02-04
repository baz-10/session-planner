'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { PostAttachment } from '@/types/database';

interface AttachmentGalleryProps {
  attachments: PostAttachment[];
}

export function AttachmentGallery({ attachments }: AttachmentGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const images = attachments.filter((a) => a.type === 'image');
  const videos = attachments.filter((a) => a.type === 'video');
  const documents = attachments.filter((a) => a.type === 'document' || a.type === 'audio');

  const getGridClass = () => {
    const imageCount = images.length;
    if (imageCount === 1) return 'grid-cols-1';
    if (imageCount === 2) return 'grid-cols-2';
    if (imageCount === 3) return 'grid-cols-3';
    return 'grid-cols-2';
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (filename: string | null) => {
    const ext = filename?.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return '📄';
    if (['doc', 'docx'].includes(ext || '')) return '📝';
    if (['xls', 'xlsx'].includes(ext || '')) return '📊';
    if (['mp3', 'wav', 'ogg'].includes(ext || '')) return '🎵';
    return '📎';
  };

  return (
    <div className="space-y-2">
      {/* Images */}
      {images.length > 0 && (
        <div className={`grid ${getGridClass()} gap-1`}>
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => setSelectedImage(image.url)}
              className={`relative overflow-hidden bg-gray-100 ${
                images.length === 1 ? 'aspect-video' : 'aspect-square'
              }`}
            >
              <Image
                src={image.url}
                alt={image.filename || 'Attachment'}
                fill
                className="object-cover hover:scale-105 transition-transform"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              {images.length > 4 && index === 3 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">
                    +{images.length - 4}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Videos */}
      {videos.length > 0 && (
        <div className="space-y-2">
          {videos.map((video) => (
            <video
              key={video.id}
              src={video.url}
              controls
              className="w-full rounded-lg"
              preload="metadata"
            />
          ))}
        </div>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <div className="space-y-1 px-4 pb-3">
          {documents.map((doc) => (
            <a
              key={doc.id}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
            >
              <span className="text-2xl">{getFileIcon(doc.filename)}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {doc.filename || 'Document'}
                </div>
                <div className="text-sm text-gray-500">
                  {formatFileSize(doc.size_bytes)}
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
          ))}
        </div>
      )}

      {/* Image lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <Image
            src={selectedImage}
            alt="Full size"
            fill
            className="object-contain p-4"
            sizes="100vw"
          />
        </div>
      )}
    </div>
  );
}
