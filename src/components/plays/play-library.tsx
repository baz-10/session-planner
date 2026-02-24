'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { usePlays } from '@/hooks/use-plays';
import type { CourtTemplate, PlayType } from '@/lib/plays/diagram-types';
import type { Play } from '@/types/database';

export function PlayLibrary() {
  const router = useRouter();
  const { currentTeam, teamMemberships } = useAuth();
  const { getPlays, duplicatePlay, deletePlay, searchPlays } = usePlays();

  const [plays, setPlays] = useState<Play[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [playType, setPlayType] = useState<string>('');
  const [courtTemplate, setCourtTemplate] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState('');

  const membership = teamMemberships.find((item) => item.team.id === currentTeam?.id);
  const canEdit = membership?.role === 'coach' || membership?.role === 'admin';

  const loadPlays = async () => {
    setIsLoading(true);
    const data = await getPlays({
      playType: (playType || undefined) as PlayType | undefined,
      courtTemplate: (courtTemplate || undefined) as CourtTemplate | undefined,
      tag: selectedTag || undefined,
    });
    setPlays(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (!currentTeam) {
      setIsLoading(false);
      setPlays([]);
      return;
    }
    void loadPlays();
  }, [currentTeam?.id, playType, courtTemplate, selectedTag]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      void loadPlays();
      return;
    }

    const timeout = setTimeout(async () => {
      setIsLoading(true);
      const result = await searchPlays(searchQuery);
      const filtered = result.filter((play) => {
        if (playType && play.play_type !== playType) return false;
        if (courtTemplate && play.court_template !== courtTemplate) return false;
        if (selectedTag && !(play.tags || []).includes(selectedTag)) return false;
        return true;
      });
      setPlays(filtered);
      setIsLoading(false);
    }, 250);

    return () => clearTimeout(timeout);
  }, [searchQuery, playType, courtTemplate, selectedTag]);

  const availableTags = useMemo(() => {
    const tags = plays.flatMap((play) => play.tags || []);
    return Array.from(new Set(tags)).sort((a, b) => a.localeCompare(b));
  }, [plays]);

  const handleDuplicate = async (play: Play) => {
    const newName = prompt('Name for duplicate play:', `${play.name} (Copy)`);
    if (!newName) return;

    const result = await duplicatePlay(play.id, newName);
    if (result.success) {
      await loadPlays();
    } else {
      alert(result.error || 'Failed to duplicate play');
    }
  };

  const handleDelete = async (play: Play) => {
    if (!confirm(`Delete "${play.name}"?`)) return;
    const result = await deletePlay(play.id);
    if (result.success) {
      setPlays((prev) => prev.filter((item) => item.id !== play.id));
    } else {
      alert(result.error || 'Failed to delete play');
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

  if (!currentTeam) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-600">
        Select a team to access plays.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
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
            {availableTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
      </div>

      {plays.length === 0 ? (
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
            <article key={play.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <button
                onClick={() => router.push(`/dashboard/plays/${play.id}`)}
                className="w-full text-left"
              >
                <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                  {play.thumbnail_data_url ? (
                    <img
                      src={play.thumbnail_data_url}
                      alt={`${play.name} diagram`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">
                      No preview image
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <h3 className="font-semibold text-gray-900 line-clamp-1">{play.name}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                    <span className="px-2 py-0.5 bg-gray-100 rounded">{play.play_type}</span>
                    <span className="px-2 py-0.5 bg-gray-100 rounded">{templateLabel(play.court_template)}</span>
                    <span className="px-2 py-0.5 bg-gray-100 rounded">v{play.version}</span>
                  </div>
                  {play.tags && play.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {play.tags.slice(0, 4).map((tag) => (
                        <span key={`${play.id}-${tag}`} className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>

              <div className="px-3 pb-3 flex items-center justify-end gap-2">
                <button
                  onClick={() => router.push(`/dashboard/plays/${play.id}`)}
                  className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                >
                  {canEdit ? 'Edit' : 'View'}
                </button>
                {canEdit && (
                  <>
                    <button
                      onClick={() => handleDuplicate(play)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => handleDelete(play)}
                      className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
