'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { usePlays } from '@/hooks/use-plays';
import { usePlayEditorTheme } from '@/hooks/use-play-editor-theme';
import { PlayDiagramPreview } from '@/components/plays/play-diagram-preview';
import { useConfirmDialog, useTextPromptDialog } from '@/components/ui';
import type { CourtTemplate, PlayType } from '@/lib/plays/diagram-types';
import type { Play } from '@/types/database';

export function PlayLibrary() {
  const router = useRouter();
  const { currentTeam, teamMemberships } = useAuth();
  const currentTeamId = currentTeam?.id;
  const { getPlays, duplicatePlay, deletePlay, searchPlays } = usePlays();
  const { theme } = usePlayEditorTheme();

  const [plays, setPlays] = useState<Play[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [playType, setPlayType] = useState<string>('');
  const [courtTemplate, setCourtTemplate] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState('');
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [activeAction, setActiveAction] = useState<{ playId: string; type: 'duplicate' | 'delete' } | null>(
    null
  );
  const [reloadKey, setReloadKey] = useState(0);
  const { confirmAction, confirmDialog } = useConfirmDialog();
  const { promptForText, textPromptDialog } = useTextPromptDialog();

  const membership = teamMemberships.find((item) => item.team.id === currentTeamId);
  const canEdit = membership?.role === 'coach' || membership?.role === 'admin';

  const loadPlays = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await getPlays(
        {
          playType: (playType || undefined) as PlayType | undefined,
          courtTemplate: (courtTemplate || undefined) as CourtTemplate | undefined,
          tag: selectedTag || undefined,
        },
        { throwOnError: true }
      );
      setPlays(data);
    } catch (error) {
      console.error('Error loading play library:', error);
      setPlays([]);
      setLoadError(error instanceof Error ? error.message : 'Failed to load play library.');
    } finally {
      setIsLoading(false);
    }
  }, [courtTemplate, getPlays, playType, selectedTag]);

  const loadTagOptions = useCallback(async () => {
    if (!currentTeamId) {
      setTagOptions([]);
      return;
    }

    try {
      const data = await getPlays({}, { throwOnError: true });
      const tags = Array.from(new Set(data.flatMap((play) => play.tags || []))).sort((a, b) =>
        a.localeCompare(b)
      );
      setTagOptions(tags);
    } catch (error) {
      console.error('Error loading play tag options:', error);
      setTagOptions([]);
    }
  }, [currentTeamId, getPlays]);

  useEffect(() => {
    if (!currentTeamId) {
      setIsLoading(false);
      setPlays([]);
      setTagOptions([]);
      return;
    }
    void loadPlays();
    void loadTagOptions();
  }, [currentTeamId, loadPlays, loadTagOptions, reloadKey]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      void loadPlays();
      return;
    }

    const timeout = setTimeout(async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const result = await searchPlays(searchQuery, { throwOnError: true });
        const filtered = result.filter((play) => {
          if (playType && play.play_type !== playType) return false;
          if (courtTemplate && play.court_template !== courtTemplate) return false;
          if (selectedTag && !(play.tags || []).includes(selectedTag)) return false;
          return true;
        });
        setPlays(filtered);
      } catch (error) {
        console.error('Error searching play library:', error);
        setPlays([]);
        setLoadError(error instanceof Error ? error.message : 'Failed to search play library.');
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [courtTemplate, loadPlays, playType, searchPlays, searchQuery, selectedTag]);

  const handleDuplicate = async (play: Play) => {
    const newName = await promptForText({
      title: 'Duplicate play',
      description: 'Name the copied play before it is added to your library.',
      label: 'Play name',
      defaultValue: `${play.name} (Copy)`,
      confirmLabel: 'Create copy',
      validate: (value) => (value ? null : 'Play name is required.'),
    });

    if (!newName) return;

    setActionError('');
    setActiveAction({ playId: play.id, type: 'duplicate' });
    try {
      const result = await duplicatePlay(play.id, newName);
      if (result.success) {
        await loadPlays();
      } else {
        setActionError(result.error || 'Failed to duplicate play');
      }
    } catch (error) {
      console.error('Unexpected error duplicating play:', error);
      setActionError(error instanceof Error ? error.message : 'Failed to duplicate play');
    } finally {
      setActiveAction(null);
    }
  };

  const handleDelete = async (play: Play) => {
    const confirmed = await confirmAction({
      title: 'Delete play?',
      description: `"${play.name}" will be removed from your play library.`,
      confirmLabel: 'Delete play',
      confirmVariant: 'destructive',
    });

    if (!confirmed) return;

    setActionError('');
    setActiveAction({ playId: play.id, type: 'delete' });
    try {
      const result = await deletePlay(play.id);
      if (result.success) {
        setPlays((prev) => prev.filter((item) => item.id !== play.id));
      } else {
        setActionError(result.error || 'Failed to delete play');
      }
    } catch (error) {
      console.error('Unexpected error deleting play:', error);
      setActionError(error instanceof Error ? error.message : 'Failed to delete play');
    } finally {
      setActiveAction(null);
    }
  };

  const templateLabel = (value: CourtTemplate) => {
    if (value === 'half_court') return 'Half Court';
    if (value === 'full_court_vertical') return 'Full Vertical';
    return 'Full Horizontal';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!currentTeamId) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-600">
        Select a team to access plays.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        {actionError && (
          <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {actionError}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Play Library</h2>
            <p className="text-sm text-gray-600">Create and manage basketball sets and actions.</p>
          </div>
          {canEdit ? (
            <Link href="/dashboard/plays/new" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light">
              New Play
            </Link>
          ) : (
            <span className="text-sm text-gray-500">Coach/Admin role required to create plays</span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search plays..."
            className="md:col-span-2 border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <select
            value={playType}
            onChange={(event) => setPlayType(event.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Types</option>
            <option value="offense">Offense</option>
            <option value="defense">Defense</option>
            <option value="ato">ATO</option>
            <option value="baseline">Baseline</option>
            <option value="sideline">Sideline</option>
            <option value="special">Special</option>
          </select>
          <select
            value={courtTemplate}
            onChange={(event) => setCourtTemplate(event.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Templates</option>
            <option value="half_court">Half Court</option>
            <option value="full_court_vertical">Full Vertical</option>
            <option value="full_court_horizontal">Full Horizontal</option>
          </select>
          <select
            value={selectedTag}
            onChange={(event) => setSelectedTag(event.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Tags</option>
            {tagOptions.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loadError ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Could not load plays</h3>
          <p className="text-gray-600 mb-5">{loadError}</p>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light"
          >
            Retry
          </button>
        </div>
      ) : plays.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No plays found</h3>
          <p className="text-gray-600 mb-5">Create a play or adjust filters to see results.</p>
          {canEdit && (
            <Link href="/dashboard/plays/new" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light">
              Create Play
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plays.map((play) => (
            <article
              key={play.id}
              aria-busy={activeAction?.playId === play.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal/30 hover:shadow-lg"
            >
              <button
                type="button"
                onClick={() => router.push(`/dashboard/plays/${play.id}`)}
                disabled={activeAction !== null}
                className="w-full text-left disabled:cursor-not-allowed"
              >
                <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                  <PlayDiagramPreview
                    alt={`${play.name} diagram`}
                    diagram={play.diagram}
                    courtTemplate={play.court_template}
                    theme={theme}
                    fallbackSrc={play.thumbnail_data_url}
                    className="h-full w-full"
                  />
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="line-clamp-1 text-base font-semibold text-slate-950">
                        {play.name}
                      </h3>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                        {templateLabel(play.court_template)}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      v{play.version}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-teal/10 px-2.5 py-1 font-semibold capitalize text-teal-dark">
                      {play.play_type}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium">
                      Theme: {theme}
                    </span>
                  </div>
                  {play.tags && play.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {play.tags.slice(0, 4).map((tag) => (
                        <span
                          key={`${play.id}-${tag}`}
                          className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/plays/${play.id}`)}
                  disabled={activeAction !== null}
                  className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {canEdit ? 'Edit' : 'View'}
                </button>
                {canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(play)}
                      disabled={activeAction !== null}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {activeAction?.playId === play.id && activeAction.type === 'duplicate'
                        ? 'Duplicating...'
                        : 'Duplicate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(play)}
                      disabled={activeAction !== null}
                      className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {activeAction?.playId === play.id && activeAction.type === 'delete'
                        ? 'Deleting...'
                        : 'Delete'}
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {confirmDialog}
      {textPromptDialog}
    </div>
  );
}
