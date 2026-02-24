'use client';

import { useCallback, useEffect, useState } from 'react';
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
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdate: (updates: Partial<SessionActivity>) => void;
  onDelete: () => void;
  onAttachPlay?: () => void;
  onClearPlay?: () => void;
  onRefreshPlaySnapshot?: () => void;
  onViewLinkedPlay?: () => void;
  linkedPlayIsStale?: boolean;
  canManagePlayLinks?: boolean;
  disabled?: boolean;
}

export function ActivityRow({
  activity,
  index,
  timing,
  categories,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onUpdate,
  onDelete,
  onAttachPlay,
  onClearPlay,
  onRefreshPlaySnapshot,
  onViewLinkedPlay,
  linkedPlayIsStale = false,
  canManagePlayLinks = false,
  disabled = false,
}: ActivityRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(activity.name);
  const [editDuration, setEditDuration] = useState(activity.duration.toString());
  const [inlineNotes, setInlineNotes] = useState(activity.notes || '');

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
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(activity.name);
    setEditDuration(activity.duration.toString());
    setIsEditing(false);
  };

  const handleCategoryChange = (categoryId: string) => {
    const nextCategoryId = categoryId || null;
    const nextAdditionalCategoryIds = (activity.additional_category_ids || []).filter(
      (existingCategoryId) => existingCategoryId && existingCategoryId !== nextCategoryId
    );
    onUpdate({
      category_id: nextCategoryId,
      additional_category_ids: nextAdditionalCategoryIds,
    });
  };

  const toggleAdditionalCategory = (categoryId: string) => {
    const currentIds = new Set(
      (activity.additional_category_ids || []).filter(
        (existingCategoryId) => existingCategoryId && existingCategoryId !== activity.category_id
      )
    );

    if (currentIds.has(categoryId)) {
      currentIds.delete(categoryId);
    } else {
      currentIds.add(categoryId);
    }

    onUpdate({ additional_category_ids: Array.from(currentIds) });
  };

  const handleDurationChange = (value: string) => {
    const newDuration = parseInt(value);
    if (!isNaN(newDuration) && newDuration > 0) {
      onUpdate({ duration: newDuration });
    }
  };

  useEffect(() => {
    setInlineNotes(activity.notes || '');
  }, [activity.id, activity.notes]);

  const commitInlineNotes = useCallback(() => {
    const nextNotes = inlineNotes.trim();
    const currentNotes = (activity.notes || '').trim();

    if (nextNotes === currentNotes) {
      return;
    }

    onUpdate({ notes: nextNotes || null });
  }, [activity.notes, inlineNotes, onUpdate]);

  // Get category color for the row indicator
  const categoryColor = activity.category?.color || '#94a3b8';
  const additionalCategoryIds = (activity.additional_category_ids || []).filter(
    (categoryId) => categoryId && categoryId !== activity.category_id
  );
  const selectedAdditionalCategories = additionalCategoryIds
    .map((categoryId) => categories.find((category) => category.id === categoryId))
    .filter(Boolean) as DrillCategory[];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid grid-cols-[40px_1fr_80px_80px_120px_260px_1fr_100px_180px] gap-2 px-4 py-2 items-center text-sm hover:bg-gray-50 ${
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
          title="Drag to reorder"
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
          <div className="space-y-1">
            <span
              className="cursor-pointer hover:text-primary"
              onClick={() => !disabled && setIsEditing(true)}
            >
              {activity.name}
            </span>

            {activity.linked_play_id ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs">
                  Play: {activity.linked_play_name_snapshot || 'Linked Play'}
                </span>
                {activity.linked_play_version_snapshot && (
                  <span className="text-[11px] text-gray-600">
                    v{activity.linked_play_version_snapshot}
                  </span>
                )}
                {linkedPlayIsStale && (
                  <span className="text-[11px] text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded">
                    Stale snapshot
                  </span>
                )}
                {onViewLinkedPlay && (
                  <button
                    type="button"
                    onClick={onViewLinkedPlay}
                    className="text-[11px] text-primary hover:underline"
                  >
                    View
                  </button>
                )}
                {canManagePlayLinks && onAttachPlay && (
                  <button
                    type="button"
                    onClick={onAttachPlay}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Replace
                  </button>
                )}
                {canManagePlayLinks && onClearPlay && (
                  <button
                    type="button"
                    onClick={onClearPlay}
                    className="text-[11px] text-red-600 hover:underline"
                  >
                    Clear
                  </button>
                )}
                {canManagePlayLinks && linkedPlayIsStale && onRefreshPlaySnapshot && (
                  <button
                    type="button"
                    onClick={onRefreshPlaySnapshot}
                    className="text-[11px] text-orange-700 hover:underline"
                  >
                    Update Snapshot
                  </button>
                )}
              </div>
            ) : (
              canManagePlayLinks &&
              onAttachPlay && (
                <button
                  type="button"
                  onClick={onAttachPlay}
                  className="text-[11px] text-primary hover:underline"
                >
                  Attach Play
                </button>
              )
            )}

            {activity.linked_play_thumbnail_data_url && (
              <img
                src={activity.linked_play_thumbnail_data_url}
                alt={`${activity.linked_play_name_snapshot || 'Play'} preview`}
                className="h-10 w-14 rounded border border-gray-200 object-cover"
              />
            )}
          </div>
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
      <div className="space-y-1">
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

        {!activity.drill_id && categories.length > 1 && (
          <details>
            <summary className="cursor-pointer text-xs text-gray-500 hover:text-primary">
              Additional categories ({additionalCategoryIds.length})
            </summary>
            <div className="mt-1 flex flex-wrap gap-1">
              {categories
                .filter((category) => category.id !== activity.category_id)
                .map((category) => {
                  const isSelected = additionalCategoryIds.includes(category.id);
                  return (
                    <button
                      key={`${activity.id}-${category.id}`}
                      type="button"
                      onClick={() => toggleAdditionalCategory(category.id)}
                      disabled={disabled}
                      className={`px-2 py-0.5 text-xs rounded border ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      } disabled:opacity-50`}
                    >
                      {category.name}
                    </button>
                  );
                })}
            </div>
          </details>
        )}

        {selectedAdditionalCategories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selectedAdditionalCategories.map((category) => (
              <span
                key={`${activity.id}-badge-${category.id}`}
                className="inline-flex items-center rounded px-2 py-0.5 text-[10px] text-white"
                style={{ backgroundColor: category.color }}
              >
                {category.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <input
          type="text"
          value={inlineNotes}
          onChange={(e) => setInlineNotes(e.target.value)}
          onBlur={commitInlineNotes}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              (event.target as HTMLInputElement).blur();
            }
          }}
          disabled={disabled}
          className="w-full px-2 py-1 border border-gray-200 rounded text-sm hover:border-gray-400 focus:border-primary focus:outline-none disabled:bg-gray-50"
          placeholder="Add notes / points of emphasis"
        />
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
              onClick={onMoveUp}
              disabled={disabled || !canMoveUp}
              className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-40"
              title="Move up"
              aria-label="Move activity up"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button
              onClick={onMoveDown}
              disabled={disabled || !canMoveDown}
              className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-40"
              title="Move down"
              aria-label="Move activity down"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
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
