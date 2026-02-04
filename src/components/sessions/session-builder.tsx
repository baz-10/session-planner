'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useSessions } from '@/hooks/use-sessions';
import { useDrills } from '@/hooks/use-drills';
import { SessionMetadataForm } from './session-metadata-form';
import { ActivityTable } from './activity-table';
import { TimeAllocationChart } from './time-allocation-chart';
import { DrillSelectorModal } from './drill-selector-modal';
import { printSessionPlan } from '@/lib/utils/pdf-export';
import type { Session, SessionActivity, DrillCategory, Drill } from '@/types/database';

interface ActivityWithCategory extends SessionActivity {
  category?: DrillCategory | null;
}

interface SessionWithActivities extends Session {
  activities: ActivityWithCategory[];
}

interface DrillWithCategory extends Drill {
  category?: DrillCategory | null;
}

interface SessionBuilderProps {
  sessionId?: string;
  isNew?: boolean;
}

export function SessionBuilder({ sessionId, isNew = false }: SessionBuilderProps) {
  const router = useRouter();
  const { currentTeam } = useAuth();
  const {
    getSession,
    createSession,
    updateSession,
    addActivity,
    updateActivity,
    deleteActivity,
    reorderActivities,
    duplicateSession,
  } = useSessions();
  const { getCategories } = useDrills();

  // Session state
  const [session, setSession] = useState<Partial<SessionWithActivities>>({
    name: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '17:00',
    duration: 90,
    location: '',
    defensive_emphasis: '',
    offensive_emphasis: '',
    quote: '',
    announcements: '',
    activities: [],
  });

  const [categories, setCategories] = useState<DrillCategory[]>([]);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [isDrillModalOpen, setIsDrillModalOpen] = useState(false);
  const [drillModalMode, setDrillModalMode] = useState<'single' | 'multiple'>('single');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load session data if editing
  useEffect(() => {
    if (sessionId && !isNew) {
      loadSession();
    }
    loadCategories();
  }, [sessionId, isNew]);

  const loadSession = async () => {
    if (!sessionId) return;
    setIsLoading(true);
    const data = await getSession(sessionId);
    if (data) {
      setSession(data);
    }
    setIsLoading(false);
  };

  const loadCategories = async () => {
    const data = await getCategories();
    setCategories(data);
  };

  // Handle metadata changes
  const handleMetadataChange = useCallback((updates: Partial<Session>) => {
    setSession((prev) => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  }, []);

  // Handle activity changes
  const handleActivityUpdate = useCallback(
    async (activityId: string, updates: Partial<SessionActivity>) => {
      // Update local state immediately for responsiveness
      setSession((prev) => ({
        ...prev,
        activities: prev.activities?.map((a) =>
          a.id === activityId ? { ...a, ...updates } : a
        ),
      }));

      // If session is saved, persist to database
      if (session.id) {
        await updateActivity(activityId, updates);
      } else {
        setHasUnsavedChanges(true);
      }
    },
    [session.id, updateActivity]
  );

  const handleActivityDelete = useCallback(
    async (activityId: string) => {
      // Update local state
      setSession((prev) => ({
        ...prev,
        activities: prev.activities?.filter((a) => a.id !== activityId),
      }));

      // If session is saved, delete from database
      if (session.id) {
        await deleteActivity(activityId);
      } else {
        setHasUnsavedChanges(true);
      }
    },
    [session.id, deleteActivity]
  );

  const handleReorder = useCallback(
    async (activityIds: string[]) => {
      // Update local state
      const activities = session.activities || [];
      const reorderedActivities = activityIds
        .map((id) => activities.find((a) => a.id === id))
        .filter(Boolean) as ActivityWithCategory[];

      setSession((prev) => ({
        ...prev,
        activities: reorderedActivities,
      }));

      // If session is saved, persist to database
      if (session.id) {
        await reorderActivities(session.id, activityIds);
      } else {
        setHasUnsavedChanges(true);
      }
    },
    [session.id, session.activities, reorderActivities]
  );

  // Add activity from drill library
  const handleAddDrill = useCallback(
    async (drill: DrillWithCategory) => {
      const newActivity: Partial<SessionActivity> = {
        id: `temp-${Date.now()}`,
        drill_id: drill.id,
        name: drill.name,
        duration: drill.default_duration,
        category_id: drill.category_id,
        notes: drill.description || '',
        sort_order: session.activities?.length || 0,
        groups: [],
      };

      // If session is saved, add to database
      if (session.id) {
        const result = await addActivity({
          session_id: session.id,
          drill_id: drill.id,
          sort_order: session.activities?.length || 0,
          name: drill.name,
          duration: drill.default_duration,
          category_id: drill.category_id || undefined,
          notes: drill.description || undefined,
        });

        if (result.success && result.activity) {
          setSession((prev) => ({
            ...prev,
            activities: [
              ...(prev.activities || []),
              { ...result.activity, category: drill.category } as ActivityWithCategory,
            ],
          }));
        }
      } else {
        // Add to local state with category attached
        setSession((prev) => ({
          ...prev,
          activities: [
            ...(prev.activities || []),
            {
              ...newActivity,
              category: drill.category || categories.find((c) => c.id === drill.category_id),
            } as ActivityWithCategory,
          ],
        }));
        setHasUnsavedChanges(true);
      }

      setIsDrillModalOpen(false);
    },
    [session.id, session.activities, addActivity, categories]
  );

  // Add multiple drills at once
  const handleAddMultipleDrills = useCallback(
    async (drills: DrillWithCategory[]) => {
      const currentActivitiesCount = session.activities?.length || 0;

      if (session.id) {
        // If session is saved, add each drill to database
        const newActivities: ActivityWithCategory[] = [];

        for (let i = 0; i < drills.length; i++) {
          const drill = drills[i];
          const result = await addActivity({
            session_id: session.id,
            drill_id: drill.id,
            sort_order: currentActivitiesCount + i,
            name: drill.name,
            duration: drill.default_duration,
            category_id: drill.category_id || undefined,
            notes: drill.description || undefined,
          });

          if (result.success && result.activity) {
            newActivities.push({
              ...result.activity,
              category: drill.category,
            } as ActivityWithCategory);
          }
        }

        setSession((prev) => ({
          ...prev,
          activities: [...(prev.activities || []), ...newActivities],
        }));
      } else {
        // Add to local state
        const newActivities: ActivityWithCategory[] = drills.map((drill, index) => ({
          id: `temp-${Date.now()}-${index}`,
          session_id: '',
          drill_id: drill.id,
          name: drill.name,
          duration: drill.default_duration,
          category_id: drill.category_id,
          notes: drill.description || null,
          sort_order: currentActivitiesCount + index,
          groups: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          category: drill.category || categories.find((c) => c.id === drill.category_id),
        }));

        setSession((prev) => ({
          ...prev,
          activities: [...(prev.activities || []), ...newActivities],
        }));
        setHasUnsavedChanges(true);
      }

      setIsDrillModalOpen(false);
    },
    [session.id, session.activities, addActivity, categories]
  );

  // Add custom activity
  const handleAddCustomActivity = useCallback(
    async (name: string, duration: number, categoryId?: string) => {
      const category = categories.find((c) => c.id === categoryId);

      if (session.id) {
        const result = await addActivity({
          session_id: session.id,
          sort_order: session.activities?.length || 0,
          name,
          duration,
          category_id: categoryId,
        });

        if (result.success && result.activity) {
          setSession((prev) => ({
            ...prev,
            activities: [
              ...(prev.activities || []),
              { ...result.activity, category } as ActivityWithCategory,
            ],
          }));
        }
      } else {
        const newActivity: ActivityWithCategory = {
          id: `temp-${Date.now()}`,
          session_id: '',
          drill_id: null,
          name,
          duration,
          category_id: categoryId || null,
          notes: null,
          sort_order: session.activities?.length || 0,
          groups: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          category,
        };

        setSession((prev) => ({
          ...prev,
          activities: [...(prev.activities || []), newActivity],
        }));
        setHasUnsavedChanges(true);
      }

      setIsDrillModalOpen(false);
    },
    [session.id, session.activities, addActivity, categories]
  );

  // Open drill modal in single mode
  const openSingleDrillModal = useCallback(() => {
    setDrillModalMode('single');
    setIsDrillModalOpen(true);
  }, []);

  // Open drill modal in multi mode
  const openMultipleDrillModal = useCallback(() => {
    setDrillModalMode('multiple');
    setIsDrillModalOpen(true);
  }, []);

  // Save session
  const handleSave = useCallback(async () => {
    if (!session.name?.trim()) {
      alert('Please enter a session name');
      return;
    }

    setIsSaving(true);

    if (session.id) {
      // Update existing session
      await updateSession(session.id, {
        name: session.name,
        date: session.date,
        start_time: session.start_time,
        duration: session.duration,
        location: session.location,
        defensive_emphasis: session.defensive_emphasis,
        offensive_emphasis: session.offensive_emphasis,
        quote: session.quote,
        announcements: session.announcements,
      });
    } else {
      // Create new session
      const result = await createSession({
        team_id: currentTeam?.id || '',
        name: session.name,
        date: session.date || undefined,
        start_time: session.start_time || undefined,
        duration: session.duration || undefined,
        location: session.location || undefined,
        defensive_emphasis: session.defensive_emphasis || undefined,
        offensive_emphasis: session.offensive_emphasis || undefined,
        quote: session.quote || undefined,
        announcements: session.announcements || undefined,
      });

      if (result.success && result.session) {
        const newSessionId = result.session.id;

        // Add all activities to the new session
        for (const activity of session.activities || []) {
          await addActivity({
            session_id: newSessionId,
            drill_id: activity.drill_id || undefined,
            sort_order: activity.sort_order,
            name: activity.name,
            duration: activity.duration,
            category_id: activity.category_id || undefined,
            notes: activity.notes || undefined,
          });
        }

        // Update URL to reflect new session ID
        router.replace(`/dashboard/sessions/${newSessionId}`);
        setSession((prev) => ({ ...prev, id: newSessionId }));
      }
    }

    setHasUnsavedChanges(false);
    setIsSaving(false);
  }, [session, currentTeam, createSession, updateSession, addActivity, router]);

  // Save as new (duplicate)
  const handleSaveAsNew = useCallback(async () => {
    const newName = prompt('Enter name for the new plan:', `${session.name} (Copy)`);
    if (!newName) return;

    if (session.id) {
      setIsSaving(true);
      const result = await duplicateSession(session.id, newName);
      if (result.success && result.session) {
        router.push(`/dashboard/sessions/${result.session.id}`);
      }
      setIsSaving(false);
    }
  }, [session.id, session.name, duplicateSession, router]);

  // Print session
  const handlePrint = useCallback(() => {
    if (!session.name) return;
    printSessionPlan(session as SessionWithActivities, currentTeam?.name || '');
  }, [session, currentTeam]);

  // Clear form
  const handleClear = useCallback(() => {
    if (hasUnsavedChanges) {
      if (!confirm('Are you sure you want to clear the form? Unsaved changes will be lost.')) {
        return;
      }
    }

    setSession({
      name: '',
      date: new Date().toISOString().split('T')[0],
      start_time: '17:00',
      duration: 90,
      location: '',
      defensive_emphasis: '',
      offensive_emphasis: '',
      quote: '',
      announcements: '',
      activities: [],
    });
    setHasUnsavedChanges(false);
  }, [hasUnsavedChanges]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? 'Create New Plan' : 'Update Plan'}
        </h1>
        {hasUnsavedChanges && (
          <span className="text-sm text-orange-600">Unsaved changes</span>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Metadata Form */}
        <div className="lg:col-span-2">
          <SessionMetadataForm
            session={session}
            onChange={handleMetadataChange}
            disabled={isSaving}
          />
        </div>

        {/* Right: Time Allocation Chart */}
        <div>
          <TimeAllocationChart
            activities={session.activities || []}
            totalDuration={session.duration || 90}
          />
        </div>
      </div>

      {/* Activity Table */}
      <ActivityTable
        activities={session.activities || []}
        sessionStartTime={session.start_time || '17:00'}
        totalDuration={session.duration || 90}
        categories={categories}
        onActivityUpdate={handleActivityUpdate}
        onActivityDelete={handleActivityDelete}
        onReorder={handleReorder}
        onAddDrillClick={openSingleDrillModal}
        onAddMultipleDrillsClick={openMultipleDrillModal}
        disabled={isSaving}
      />

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 py-4 border-t border-gray-200">
        <button
          onClick={handleClear}
          disabled={isSaving}
          className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Clear Form
        </button>
        <button
          onClick={handlePrint}
          disabled={isSaving || !session.name}
          className="px-4 py-2 border border-primary text-primary rounded-md hover:bg-primary/5 disabled:opacity-50"
        >
          Print Plan
        </button>
        {session.id && (
          <button
            onClick={handleSaveAsNew}
            disabled={isSaving}
            className="px-4 py-2 border border-primary text-primary rounded-md hover:bg-primary/5 disabled:opacity-50"
          >
            Save as New Plan
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={isSaving || !session.name?.trim()}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Plan'}
        </button>
      </div>

      {/* Drill Selector Modal */}
      <DrillSelectorModal
        isOpen={isDrillModalOpen}
        onClose={() => setIsDrillModalOpen(false)}
        onSelect={handleAddDrill}
        onSelectMultiple={handleAddMultipleDrills}
        onAddCustom={handleAddCustomActivity}
        categories={categories}
        mode={drillModalMode}
      />
    </div>
  );
}
