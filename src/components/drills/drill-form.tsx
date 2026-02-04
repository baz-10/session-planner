'use client';

import { useState, useEffect } from 'react';
import { useDrills } from '@/hooks/use-drills';
import type { Drill, DrillCategory, DrillMedia } from '@/types/database';

interface DrillWithDetails extends Drill {
  category?: DrillCategory | null;
  media?: DrillMedia[];
}

interface DrillFormProps {
  drill?: DrillWithDetails | null;
  categories: DrillCategory[];
  onClose: () => void;
  onSuccess: () => void;
}

export function DrillForm({ drill, categories, onClose, onSuccess }: DrillFormProps) {
  const { createDrill, updateDrill, addDrillMedia, deleteDrillMedia, isLoading } = useDrills();

  const [name, setName] = useState(drill?.name || '');
  const [categoryId, setCategoryId] = useState(drill?.category_id || '');
  const [defaultDuration, setDefaultDuration] = useState(drill?.default_duration?.toString() || '10');
  const [description, setDescription] = useState(drill?.description || '');
  const [notes, setNotes] = useState(drill?.notes || '');
  const [media, setMedia] = useState<DrillMedia[]>(drill?.media || []);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!drill;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Drill name is required');
      return;
    }

    const duration = parseInt(defaultDuration);
    if (isNaN(duration) || duration < 1) {
      setError('Duration must be at least 1 minute');
      return;
    }

    const drillData = {
      name: name.trim(),
      category_id: categoryId || undefined,
      default_duration: duration,
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    let result;
    if (isEditing && drill) {
      result = await updateDrill(drill.id, drillData);
    } else {
      result = await createDrill(drillData);
    }

    if (result.success) {
      onSuccess();
    } else {
      setError(result.error || 'Failed to save drill');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!drill || !e.target.files || e.target.files.length === 0) return;

    setUploadingFiles(true);
    const files = Array.from(e.target.files);

    for (const file of files) {
      const result = await addDrillMedia(drill.id, file);
      if (result.success && result.media) {
        setMedia((prev) => [...prev, result.media!]);
      }
    }

    setUploadingFiles(false);
    e.target.value = '';
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!confirm('Delete this media file?')) return;

    const result = await deleteDrillMedia(mediaId);
    if (result.success) {
      setMedia((prev) => prev.filter((m) => m.id !== mediaId));
    }
  };

  const getMediaIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type === 'application/pdf') return '📄';
    return '📎';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {isEditing ? 'Edit Drill' : 'Create New Drill'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 rounded"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Drill Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g., 3-Man Weave"
              required
            />
          </div>

          {/* Category and Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">No category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Duration (min) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                min="1"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Describe the drill..."
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Coach Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Private notes for coaches..."
            />
          </div>

          {/* Media (only for existing drills) */}
          {isEditing && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Media Attachments
              </label>

              {/* Existing media */}
              {media.length > 0 && (
                <div className="space-y-2 mb-3">
                  {media.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                    >
                      <div className="flex items-center gap-2">
                        <span>{getMediaIcon(m.type)}</span>
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline truncate max-w-[200px]"
                        >
                          {m.filename}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteMedia(m.id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload button */}
              <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-primary hover:bg-gray-50">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  multiple
                  accept="image/*,video/*,.pdf"
                  className="hidden"
                  disabled={uploadingFiles}
                />
                {uploadingFiles ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                    <span className="text-sm text-gray-600">Uploading...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-sm text-gray-600">Add images, videos, or PDFs</span>
                  </>
                )}
              </label>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Drill'}
          </button>
        </div>
      </div>
    </div>
  );
}
