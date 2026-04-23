'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GripVertical,
  Link2,
  Pencil,
  RefreshCcw,
  Trash2,
  Unlink,
  X,
} from 'lucide-react';
import { PlayDiagramPreview } from '@/components/plays/play-diagram-preview';
import type { PlayEditorTheme } from '@/lib/plays/play-theme';
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
  playTheme: PlayEditorTheme;
  playerLabelsById?: Record<string, string>;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
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

function getInitials(value: string): string {
  const words = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (words.length === 0) {
    return '?';
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
}

function getAvatarColor(index: number): string {
  const colors = ['#1e3a5f', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444'];
  return colors[index % colors.length];
}

export function ActivityRow({
  activity,
  index,
  timing,
  categories,
  playTheme,
  playerLabelsById = {},
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp = () => undefined,
  onMoveDown = () => undefined,
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
    opacity: isDragging ? 0.72 : 1,
  };

  const categoryColor = activity.category?.color || '#94a3b8';
  const additionalCategoryIds = (activity.additional_category_ids || []).filter(
    (categoryId) => categoryId && categoryId !== activity.category_id
  );

  const selectedAdditionalCategories = additionalCategoryIds
    .map((categoryId) => categories.find((category) => category.id === categoryId))
    .filter(Boolean) as DrillCategory[];

  const assigneeIds = useMemo(
    () =>
      Array.from(
        new Set((activity.groups || []).flatMap((group) => group.player_ids || []))
      ),
    [activity.groups]
  );

  const assigneeLabels = assigneeIds.map(
    (playerId) => playerLabelsById[playerId] || `Player ${playerId.slice(0, 4)}`
  );

  const handleSave = () => {
    onUpdate({
      name: editName.trim() || activity.name,
      duration: parseInt(editDuration, 10) || activity.duration,
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
        (existingCategoryId) =>
          existingCategoryId && existingCategoryId !== activity.category_id
      )
    );

    if (currentIds.has(categoryId)) {
      currentIds.delete(categoryId);
    } else {
      currentIds.add(categoryId);
    }

    onUpdate({ additional_category_ids: Array.from(currentIds) });
  };

  useEffect(() => {
    setInlineNotes(activity.notes || '');
    setEditName(activity.name);
    setEditDuration(activity.duration.toString());
  }, [activity.duration, activity.id, activity.name, activity.notes]);

  const commitInlineNotes = useCallback(() => {
    const nextNotes = inlineNotes.trim();
    const currentNotes = (activity.notes || '').trim();

    if (nextNotes === currentNotes) {
      return;
    }

    onUpdate({ notes: nextNotes || null });
  }, [activity.notes, inlineNotes, onUpdate]);

  const linkedPlayCourtTemplate =
    activity.linked_play_snapshot?.courtTemplate || 'half_court';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-sm transition-shadow ${
        isDragging ? 'shadow-2xl' : 'hover:shadow-md'
      } lg:grid-cols-[72px_72px_minmax(0,1fr)_240px_140px_52px]`}
    >
      <div
        {...attributes}
        {...listeners}
        className="flex cursor-grab select-none flex-col items-center justify-center gap-1 px-2 py-4 text-white active:cursor-grabbing"
        style={{ backgroundColor: categoryColor }}
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4 opacity-80" />
        <div className="font-mono text-[10px] font-semibold tracking-[0.18em]">
          #{index}
        </div>
        {isEditing ? (
          <input
            type="number"
            min="1"
            value={editDuration}
            onChange={(event) => setEditDuration(event.target.value)}
            className="w-12 rounded-md border border-white/20 bg-white/15 px-1 py-0.5 text-center font-mono text-base font-bold text-white outline-none placeholder:text-white/70"
          />
        ) : (
          <div className="font-mono text-lg font-bold leading-none">
            {activity.duration}
          </div>
        )}
        <div className="font-mono text-[9px] tracking-[0.18em] text-white/85">MIN</div>
      </div>

      <div className="flex flex-row items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 lg:flex-col lg:justify-center lg:border-b-0 lg:border-r">
        <div className="font-mono text-[13px] font-bold text-navy">
          {timing ? formatTime12Hour(timing.startTime).replace(/ (AM|PM)/, '') : '--'}
        </div>
        <div className="font-mono text-[10px] text-slate-500">
          {timing
            ? `-> ${formatTime12Hour(timing.endTime).replace(/ (AM|PM)/, '')}`
            : '--'}
        </div>
        <div className="rounded-full bg-white px-2 py-1 font-mono text-[10px] text-slate-500 shadow-sm">
          {timing?.cumulativeMinutes || activity.duration} total
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap items-start gap-2">
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              className="min-w-[220px] flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-teal"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => !disabled && setIsEditing(true)}
              className="text-left text-[15px] font-bold text-slate-950 transition-colors hover:text-primary"
            >
              {activity.name}
            </button>
          )}

          {activity.category && (
            <span
              className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
              style={{
                backgroundColor: `${categoryColor}22`,
                color: categoryColor,
              }}
            >
              {activity.category.name}
            </span>
          )}

          {activity.linked_play_id && (
            <span className="inline-flex items-center gap-1 rounded-full bg-navy px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-light" />
              {activity.linked_play_name_snapshot || 'Linked Play'}
            </span>
          )}
        </div>

        <textarea
          value={inlineNotes}
          onChange={(event) => setInlineNotes(event.target.value)}
          onBlur={commitInlineNotes}
          disabled={disabled}
          rows={2}
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 outline-none transition-colors focus:border-teal disabled:bg-slate-100"
          placeholder="Add notes / coaching points"
        />

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={activity.category_id || ''}
            onChange={(event) => handleCategoryChange(event.target.value)}
            disabled={disabled}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-teal disabled:bg-slate-100"
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          {!activity.drill_id &&
            categories
              .filter((category) => category.id !== activity.category_id)
              .slice(0, 6)
              .map((category) => {
                const isSelected = additionalCategoryIds.includes(category.id);
                return (
                  <button
                    key={`${activity.id}-${category.id}`}
                    type="button"
                    onClick={() => toggleAdditionalCategory(category.id)}
                    disabled={disabled}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                    } disabled:opacity-50`}
                  >
                    {category.name}
                  </button>
                );
              })}
        </div>

        {selectedAdditionalCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedAdditionalCategories.map((category) => (
              <span
                key={`${activity.id}-badge-${category.id}`}
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
                style={{ backgroundColor: category.color }}
              >
                {category.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 px-4 py-4 lg:border-l lg:border-t-0">
        {activity.linked_play_id || activity.linked_play_thumbnail_data_url ? (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <div className="aspect-[4/3]">
                <PlayDiagramPreview
                  alt={`${activity.linked_play_name_snapshot || 'Linked play'} preview`}
                  diagram={activity.linked_play_snapshot}
                  courtTemplate={linkedPlayCourtTemplate}
                  theme={playTheme}
                  fallbackSrc={activity.linked_play_thumbnail_data_url}
                  className="h-full w-full"
                />
              </div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-navy">
                Linked play
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                v{activity.linked_play_version_snapshot || 1}{' '}
                {linkedPlayIsStale ? '· refresh available' : '· synced'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
              {onViewLinkedPlay && (
                <button
                  type="button"
                  onClick={onViewLinkedPlay}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View
                </button>
              )}
              {canManagePlayLinks && onAttachPlay && (
                <button
                  type="button"
                  onClick={onAttachPlay}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Replace
                </button>
              )}
              {canManagePlayLinks && linkedPlayIsStale && onRefreshPlaySnapshot && (
                <button
                  type="button"
                  onClick={onRefreshPlaySnapshot}
                  className="inline-flex items-center gap-1 text-orange-700 hover:underline"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  Update
                </button>
              )}
              {canManagePlayLinks && onClearPlay && (
                <button
                  type="button"
                  onClick={onClearPlay}
                  className="inline-flex items-center gap-1 text-red-700 hover:underline"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAttachPlay}
            disabled={!canManagePlayLinks || !onAttachPlay}
            className="flex h-full min-h-32 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm font-medium text-slate-500 transition-colors hover:border-teal hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Link2 className="mb-2 h-5 w-5" />
            Link a play
          </button>
        )}
      </div>

      <div className="border-t border-slate-200 px-4 py-4 lg:border-l lg:border-t-0">
        {assigneeLabels.length > 0 ? (
          <div className="space-y-3">
            <div className="flex">
              {assigneeLabels.slice(0, 3).map((label, avatarIndex) => (
                <div
                  key={`${activity.id}-${label}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white shadow-sm"
                  style={{
                    backgroundColor: getAvatarColor(avatarIndex),
                    marginLeft: avatarIndex === 0 ? 0 : -6,
                  }}
                >
                  {getInitials(label)}
                </div>
              ))}
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-800">
                {assigneeLabels.length} assigned
              </div>
              <div className="text-[11px] text-slate-500">
                {assigneeLabels.slice(0, 2).join(', ')}
                {assigneeLabels.length > 2 ? ' +' : ''}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col justify-center text-sm text-slate-500">
            <div className="font-semibold text-slate-700">All squad</div>
            <div className="text-[11px]">No assignee groups set</div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-1 border-t border-slate-200 px-2 py-3 lg:flex-col lg:border-t-0 lg:border-l">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg border border-teal/20 bg-teal/10 p-2 text-teal hover:bg-teal/15"
              title="Save edits"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              title="Cancel edits"
            >
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onMoveUp}
              disabled={disabled || !canMoveUp}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              title="Move up"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={disabled || !canMoveDown}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              title="Move down"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              disabled={disabled}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              title="Edit activity"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={disabled}
              className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50 disabled:opacity-50"
              title="Delete activity"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
