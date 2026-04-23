'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { LibraryBig, Plus, Tags } from 'lucide-react';
import { ActivityRow } from './activity-row';
import { calculateActivityTimings, type ActivityTiming } from '@/lib/utils/time';
import type { PlayEditorTheme } from '@/lib/plays/play-theme';
import type { SessionActivity, DrillCategory } from '@/types/database';

interface ActivityWithCategory extends SessionActivity {
  category?: DrillCategory | null;
}

interface ActivityTableProps {
  activities: ActivityWithCategory[];
  sessionStartTime: string;
  totalDuration: number;
  categories: DrillCategory[];
  playTheme: PlayEditorTheme;
  playerLabelsById?: Record<string, string>;
  onActivityUpdate: (id: string, updates: Partial<SessionActivity>) => void;
  onActivityDelete: (id: string) => void;
  onReorder: (activityIds: string[]) => void;
  onAddDrillClick: () => void;
  onAddMultipleDrillsClick?: () => void;
  onManageCategoriesClick?: () => void;
  onSaveActivitiesToLibrary?: () => void;
  isSavingActivitiesToLibrary?: boolean;
  canManagePlayLinks?: boolean;
  onAttachPlayClick?: (activityId: string) => void;
  onClearPlayClick?: (activityId: string) => void;
  onRefreshPlaySnapshotClick?: (activityId: string) => void;
  onViewLinkedPlayClick?: (activityId: string) => void;
  linkedPlayIsStale?: (activity: ActivityWithCategory) => boolean;
  disabled?: boolean;
}

export function ActivityTable({
  activities,
  sessionStartTime,
  totalDuration,
  categories,
  playTheme,
  playerLabelsById = {},
  onActivityUpdate,
  onActivityDelete,
  onReorder,
  onAddDrillClick,
  onAddMultipleDrillsClick,
  onManageCategoriesClick,
  onSaveActivitiesToLibrary,
  isSavingActivitiesToLibrary = false,
  canManagePlayLinks = false,
  onAttachPlayClick,
  onClearPlayClick,
  onRefreshPlaySnapshotClick,
  onViewLinkedPlayClick,
  linkedPlayIsStale,
  disabled = false,
}: ActivityTableProps) {
  const [localActivities, setLocalActivities] = useState(activities);

  useEffect(() => {
    setLocalActivities(activities);
  }, [activities]);

  const activityTimings = useMemo(() => {
    const timingData = calculateActivityTimings(
      localActivities.map((activity) => ({
        id: activity.id,
        duration: activity.duration,
      })),
      sessionStartTime || '17:00',
      totalDuration || 90
    );

    const timingMap = new Map<string, ActivityTiming>();
    timingData.forEach((timing) => timingMap.set(timing.id, timing));
    return timingMap;
  }, [localActivities, sessionStartTime, totalDuration]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = localActivities.findIndex((activity) => activity.id === active.id);
        const newIndex = localActivities.findIndex((activity) => activity.id === over.id);
        const nextOrder = arrayMove(localActivities, oldIndex, newIndex);

        setLocalActivities(nextOrder);
        onReorder(nextOrder.map((activity) => activity.id));
      }
    },
    [localActivities, onReorder]
  );

  const totalAllocated = useMemo(
    () => localActivities.reduce((sum, activity) => sum + activity.duration, 0),
    [localActivities]
  );

  const minutesRemaining = totalDuration - totalAllocated;

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={localActivities.map((activity) => activity.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {localActivities.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">No activities yet</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Add drills, custom blocks, or let autopilot sketch the run of show.
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={onAddDrillClick}
                    disabled={disabled}
                    className="inline-flex items-center gap-2 rounded-xl border border-teal px-4 py-2 text-sm font-semibold text-teal transition-colors hover:bg-teal/5 disabled:opacity-50"
                  >
                    <LibraryBig className="h-4 w-4" />
                    Add from library
                  </button>
                  <button
                    onClick={onAddMultipleDrillsClick || onAddDrillClick}
                    disabled={disabled}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" />
                    Add custom block
                  </button>
                </div>
              </div>
            ) : (
              localActivities.map((activity, index) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  index={index + 1}
                  timing={activityTimings.get(activity.id)}
                  categories={categories}
                  playTheme={playTheme}
                  playerLabelsById={playerLabelsById}
                  canMoveUp={index > 0}
                  canMoveDown={index < localActivities.length - 1}
                  onMoveUp={() => {
                    if (index <= 0) return;
                    const nextOrder = arrayMove(localActivities, index, index - 1);
                    setLocalActivities(nextOrder);
                    onReorder(nextOrder.map((item) => item.id));
                  }}
                  onMoveDown={() => {
                    if (index >= localActivities.length - 1) return;
                    const nextOrder = arrayMove(localActivities, index, index + 1);
                    setLocalActivities(nextOrder);
                    onReorder(nextOrder.map((item) => item.id));
                  }}
                  onUpdate={(updates) => onActivityUpdate(activity.id, updates)}
                  onDelete={() => onActivityDelete(activity.id)}
                  canManagePlayLinks={canManagePlayLinks}
                  linkedPlayIsStale={linkedPlayIsStale ? linkedPlayIsStale(activity) : false}
                  onAttachPlay={
                    canManagePlayLinks && onAttachPlayClick
                      ? () => onAttachPlayClick(activity.id)
                      : undefined
                  }
                  onClearPlay={
                    canManagePlayLinks && onClearPlayClick
                      ? () => onClearPlayClick(activity.id)
                      : undefined
                  }
                  onRefreshPlaySnapshot={
                    canManagePlayLinks && onRefreshPlaySnapshotClick
                      ? () => onRefreshPlaySnapshotClick(activity.id)
                      : undefined
                  }
                  onViewLinkedPlay={
                    onViewLinkedPlayClick
                      ? () => onViewLinkedPlayClick(activity.id)
                      : undefined
                  }
                  disabled={disabled}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onAddDrillClick}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-xl border border-teal px-3 py-2 text-sm font-semibold text-teal transition-colors hover:bg-teal/5 disabled:opacity-50"
          >
            <LibraryBig className="h-4 w-4" />
            Add from library
          </button>
          <button
            onClick={onAddMultipleDrillsClick || onAddDrillClick}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Add custom
          </button>
          {onManageCategoriesClick && (
            <button
              onClick={onManageCategoriesClick}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              <Tags className="h-4 w-4" />
              Categories
            </button>
          )}
          {onSaveActivitiesToLibrary && (
            <button
              onClick={onSaveActivitiesToLibrary}
              disabled={disabled || isSavingActivitiesToLibrary}
              className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
            >
              {isSavingActivitiesToLibrary ? 'Saving...' : 'Save activities to library'}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-mono font-semibold text-slate-700">
            {totalAllocated} / {totalDuration} min planned
          </span>
          {minutesRemaining > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
              {minutesRemaining} min remaining
            </span>
          )}
          {minutesRemaining < 0 && (
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
              {Math.abs(minutesRemaining)} min over
            </span>
          )}
          {minutesRemaining === 0 && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              Fully allocated
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
