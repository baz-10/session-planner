'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatTime12Hour, type ActivityTiming } from '@/lib/utils/time';
import type { SessionActivity, DrillCategory } from '@/types/database';

interface ActivityWithCategory extends SessionActivity {
  category?: DrillCategory | null;
}

interface ActivityRowProps {
  activity: ActivityWithCategory;
  index: number;
  timing?: ActivityTiming;
  categories: DrillCategory[];
  onUpdate: (updates: Partial<SessionActivity>) => void;
  onDelete: () => void;
  disabled?: boolean;
}

export function ActivityRow({
  activity,
  index,
  timing,
  categories,
  onUpdate,
  onDelete,
  disabled = false,
}: ActivityRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(activity.name);
  const [editDuration, setEditDuration] = useState(activity.duration.toString());
  const [editNotes, setEditNotes] = useState(activity.notes || '');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: activity.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSave = () => {
    onUpdate({
      name: editName,
      duration: parseInt(editDuration) || activity.duration,
      notes: editNotes || null,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(activity.name);
    setEditDuration(activity.duration.toString());
    setEditNotes(activity.notes || '');
    setIsEditing(false);
  };

  const handleCategoryChange = (categoryId: string) => {
    onUpdate({ category_id: categoryId || null });
  };

  const handleDurationChange = (value: string) => {
    const newDuration = parseInt(value);
    if (!isNaN(newDuration) && newDuration > 0) {
      onUpdate({ duration: newDuration });
    }
  };

  // Get category color for the row indicator
  const categoryColor = activity.category?.color || '#94a3b8';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid grid-cols-[40px_1fr_80px_80px_120px_150px_1fr_100px_80px] gap-2 px-4 py-2 items-center text-sm hover:bg-gray-50 ${
        isDragging ? 'bg-blue-50' : ''
      }`}
    >
      {/* Row Number with Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center cursor-grab active:cursor-grabbing"
      >
        <div
          className="w-6 h-6 rounded flex items-center justify-center text-xs font-medium text-white"
          style={{ backgroundColor: categoryColor }}
        >
          {index}
        </div>
      </div>

      {/* Activity Name */}
      <div>
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            autoFocus
          />
        ) : (
          <span
            className="cursor-pointer hover:text-primary"
            onClick={() => !disabled && setIsEditing(true)}
          >
            {activity.name}
          </span>
        )}
      </div>

      {/* Duration (Min) */}
      <div className="text-center">
        {isEditing ? (
          <input
            type="number"
            value={editDuration}
            onChange={(e) => setEditDuration(e.target.value)}
            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
            min="1"
          />
        ) : (
          <input
            type="number"
            value={activity.duration}
            onChange={(e) => handleDurationChange(e.target.value)}
            disabled={disabled}
            className="w-16 px-2 py-1 border border-gray-200 rounded text-sm text-center hover:border-gray-400 focus:border-primary focus:outline-none disabled:bg-gray-50"
            min="1"
          />
        )}
      </div>

      {/* Total Min (Cumulative) */}
      <div className="text-center text-gray-600">
        {timing?.cumulativeMinutes || 0}
      </div>

      {/* Time Range */}
      <div className="text-center text-gray-600 text-xs">
        {timing ? (
          <>
            {formatTime12Hour(timing.startTime)} - {formatTime12Hour(timing.endTime)}
          </>
        ) : (
          '-'
        )}
      </div>

      {/* Category */}
      <div>
        <select
          value={activity.category_id || ''}
          onChange={(e) => handleCategoryChange(e.target.value)}
          disabled={disabled}
          className="w-full px-2 py-1 border border-gray-200 rounded text-sm hover:border-gray-400 focus:border-primary focus:outline-none disabled:bg-gray-50"
        >
          <option value="">Select category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div>
        {isEditing ? (
          <input
            type="text"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            placeholder="Notes..."
          />
        ) : (
          <span className="text-gray-600 truncate block" title={activity.notes || ''}>
            {activity.notes || '-'}
          </span>
        )}
      </div>

      {/* Min Remaining */}
      <div className="text-center">
        <span
          className={`${
            (timing?.minutesRemaining || 0) <= 0
              ? 'text-red-600'
              : (timing?.minutesRemaining || 0) <= 10
              ? 'text-orange-600'
              : 'text-gray-600'
          }`}
        >
          {timing?.minutesRemaining || 0}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-1">
        {isEditing ? (
          <>
            <button
              onClick={handleSave}
              className="p-1 text-green-600 hover:bg-green-50 rounded"
              title="Save"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              onClick={handleCancel}
              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
              title="Cancel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setIsEditing(true)}
              disabled={disabled}
              className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-50"
              title="Edit"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={onDelete}
              disabled={disabled}
              className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
              title="Delete"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
