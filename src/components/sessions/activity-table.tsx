'use client';

import { useMemo, useState, useCallback } from 'react';
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
import { ActivityRow } from './activity-row';
import {
  calculateActivityTimings,
  formatTime12Hour,
  type ActivityTiming,
} from '@/lib/utils/time';
import type { SessionActivity, DrillCategory } from '@/types/database';

interface ActivityWithCategory extends SessionActivity {
  category?: DrillCategory | null;
}

interface ActivityTableProps {
  activities: ActivityWithCategory[];
  sessionStartTime: string;
  totalDuration: number;
  categories: DrillCategory[];
  onActivityUpdate: (id: string, updates: Partial<SessionActivity>) => void;
  onActivityDelete: (id: string) => void;
  onReorder: (activityIds: string[]) => void;
  onAddDrillClick: () => void;
  onAddMultipleDrillsClick?: () => void;
  disabled?: boolean;
}

export function ActivityTable({
  activities,
  sessionStartTime,
  totalDuration,
  categories,
  onActivityUpdate,
  onActivityDelete,
  onReorder,
  onAddDrillClick,
  onAddMultipleDrillsClick,
  disabled = false,
}: ActivityTableProps) {
  const [localActivities, setLocalActivities] = useState(activities);

  // Update local state when activities prop changes
  useMemo(() => {
    setLocalActivities(activities);
  }, [activities]);

  // Calculate timings for all activities
  const activityTimings = useMemo(() => {
    const timingData = calculateActivityTimings(
      localActivities.map((a) => ({ id: a.id, duration: a.duration })),
      sessionStartTime || '17:00',
      totalDuration || 90
    );

    // Create a map for quick lookup
    const timingMap = new Map<string, ActivityTiming>();
    timingData.forEach((t) => timingMap.set(t.id, t));
    return timingMap;
  }, [localActivities, sessionStartTime, totalDuration]);

  // DnD sensors
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

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = localActivities.findIndex((a) => a.id === active.id);
        const newIndex = localActivities.findIndex((a) => a.id === over.id);

        const newOrder = arrayMove(localActivities, oldIndex, newIndex);
        setLocalActivities(newOrder);
        onReorder(newOrder.map((a) => a.id));
      }
    },
    [localActivities, onReorder]
  );

  // Calculate total allocated time
  const totalAllocated = useMemo(
    () => localActivities.reduce((sum, a) => sum + a.duration, 0),
    [localActivities]
  );

  const minutesRemaining = totalDuration - totalAllocated;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Table Header */}
      <div className="bg-primary text-white">
        <div className="grid grid-cols-[40px_1fr_80px_80px_120px_150px_1fr_100px_80px] gap-2 px-4 py-3 text-sm font-medium">
          <div className="text-center">#</div>
          <div>Activity</div>
          <div className="text-center">Min</div>
          <div className="text-center">Total Min</div>
          <div className="text-center">Time</div>
          <div>Category</div>
          <div>Notes</div>
          <div className="text-center">Min Left</div>
          <div className="text-center">Action</div>
        </div>
      </div>

      {/* Activity Rows */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={localActivities.map((a) => a.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="divide-y divide-gray-100">
            {localActivities.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-500">
                <p className="mb-2">No activities added yet</p>
                <button
                  onClick={onAddDrillClick}
                  disabled={disabled}
                  className="text-primary hover:underline disabled:opacity-50"
                >
                  Add your first activity
                </button>
              </div>
            ) : (
              localActivities.map((activity, index) => {
                const timing = activityTimings.get(activity.id);
                return (
                  <ActivityRow
                    key={activity.id}
                    activity={activity}
                    index={index + 1}
                    timing={timing}
                    categories={categories}
                    onUpdate={(updates) => onActivityUpdate(activity.id, updates)}
                    onDelete={() => onActivityDelete(activity.id)}
                    disabled={disabled}
                  />
                );
              })
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Action Buttons */}
      <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
        <div className="flex gap-2">
          <button
            onClick={onAddDrillClick}
            disabled={disabled}
            className="px-3 py-1.5 text-sm border border-primary text-primary rounded hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Lines
          </button>
          <button
            onClick={onAddMultipleDrillsClick || onAddDrillClick}
            disabled={disabled}
            className="px-3 py-1.5 text-sm border border-primary text-primary rounded hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Multiple Drills
          </button>
        </div>

        <div className="text-sm">
          <span className="text-gray-600">Total: </span>
          <span className="font-medium">{totalAllocated} min</span>
          {minutesRemaining > 0 && (
            <>
              <span className="text-gray-600 mx-2">|</span>
              <span className="text-orange-600">{minutesRemaining} min remaining</span>
            </>
          )}
          {minutesRemaining < 0 && (
            <>
              <span className="text-gray-600 mx-2">|</span>
              <span className="text-red-600">{Math.abs(minutesRemaining)} min over</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
