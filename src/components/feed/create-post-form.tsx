'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import {
  MAX_POST_ATTACHMENT_BYTES,
  MAX_POST_ATTACHMENTS,
  usePosts,
} from '@/hooks/use-posts';
import { useAuth } from '@/contexts/auth-context';
import {
  POST_ATTACHMENT_EXTENSIONS,
  POST_ATTACHMENT_MIME_TYPES,
  isSafeImageFile,
  isSafeVideoFile,
  isTrustedAttachmentFile,
} from '@/lib/utils/attachments';

interface CreatePostFormProps {
  onSuccess: () => void;
}

export function CreatePostForm({ onSuccess }: CreatePostFormProps) {
  const { user, currentTeam } = useAuth();
  const { createPost, isLoading } = usePosts();
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (attachments.length + files.length > MAX_POST_ATTACHMENTS) {
      setError(`Attach up to ${MAX_POST_ATTACHMENTS} files per post.`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    const oversizedFile = files.find((file) => file.size > MAX_POST_ATTACHMENT_BYTES);
    if (oversizedFile) {
      setError(`${oversizedFile.name} is larger than 25 MB.`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    const unsupportedFile = files.find(
      (file) => !isTrustedAttachmentFile(file, POST_ATTACHMENT_MIME_TYPES, POST_ATTACHMENT_EXTENSIONS)
    );
    if (unsupportedFile) {
      setError(`${unsupportedFile.name} is not a supported attachment type.`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setError('');
    setAttachments((prev) => [...prev, ...files]);

    // Create previews for images
    files.forEach((file) => {
      if (isSafeImageFile(file)) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviews((prev) => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviews((prev) => [...prev, '']);
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !currentTeam) return;
    setError('');

    const result = await createPost(
      { team_id: currentTeam.id, content: content.trim() },
      attachments.length > 0 ? attachments : undefined
    );

    if (result.success) {
      setContent('');
      setAttachments([]);
      setPreviews([]);
      onSuccess();
    } else {
      setError(result.error || 'Failed to create post.');
    }
  };

  const getFileIcon = (file: File) => {
    if (isSafeVideoFile(file)) return '🎬';
    if (file.type === 'application/pdf') return '📄';
    return '📎';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-semibold flex-shrink-0">
            {user?.user_metadata?.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share something with your team..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />

            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="relative group"
                  >
                    {previews[index] ? (
                      <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                        <Image
                          src={previews[index]}
                          alt={file.name}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-gray-100 flex flex-col items-center justify-center p-2">
                        <span className="text-2xl">{getFileIcon(file)}</span>
                        <span className="text-xs text-gray-500 truncate w-full text-center">
                          {file.name}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between">
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-full"
                  title="Add image"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-full"
                  title="Add file"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
              </div>
              <button
                type="submit"
                disabled={!content.trim() || isLoading}
                className="px-4 py-2 bg-primary text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-light"
              >
                {isLoading ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
