'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { FileText, ImageIcon, Paperclip, Video } from 'lucide-react';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPosting = isLoading || isSubmitting;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isPosting) return;

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
    if (isPosting) return;
    setAttachments((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !currentTeam || isPosting) return;
    setError('');
    setIsSubmitting(true);

    try {
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
    } catch (error) {
      console.error('Unexpected error creating post:', error);
      setError('Failed to create post. Check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFileIcon = (file: File) => {
    if (isSafeVideoFile(file)) return <Video className="h-6 w-6 text-gray-500" aria-hidden="true" />;
    if (file.type === 'application/pdf') return <FileText className="h-6 w-6 text-gray-500" aria-hidden="true" />;
    return <Paperclip className="h-6 w-6 text-gray-500" aria-hidden="true" />;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <form onSubmit={handleSubmit} aria-busy={isPosting}>
        {error && (
          <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
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
              aria-label="Post content"
              rows={3}
              disabled={isPosting}
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
                        {getFileIcon(file)}
                        <span className="text-xs text-gray-500 truncate w-full text-center">
                          {file.name}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      disabled={isPosting}
                      aria-label={`Remove ${file.name}`}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
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
                  disabled={isPosting}
                  className="hidden"
                  aria-label="Attach files to post"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPosting}
                  className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-full disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Add image to post"
                  title="Add image"
                >
                  <ImageIcon className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPosting}
                  className="p-2 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-full disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Add file to post"
                  title="Add file"
                >
                  <Paperclip className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <button
                type="submit"
                disabled={!content.trim() || isPosting}
                aria-busy={isPosting}
                className="px-4 py-2 bg-primary text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-light"
              >
                {isPosting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
