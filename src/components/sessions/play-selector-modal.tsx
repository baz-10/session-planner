'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePlays } from '@/hooks/use-plays';
import type { CourtTemplate, PlayType } from '@/lib/plays/diagram-types';
import type { Play } from '@/types/database';

interface PlaySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (play: Play) => void;
}

export function PlaySelectorModal({ isOpen, onClose, onSelect }: PlaySelectorModalProps) {
  const { getPlays, searchPlays } = usePlays();

  const [plays, setPlays] = useState<Play[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [playType, setPlayType] = useState<string>('');
  const [courtTemplate, setCourtTemplate] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState('');

  const loadPlays = useCallback(async () => {
    setIsLoading(true);
    const data = await getPlays({
      playType: (playType || undefined) as PlayType | undefined,
      courtTemplate: (courtTemplate || undefined) as CourtTemplate | undefined,
      tag: selectedTag || undefined,
    });
    setPlays(data);
    setIsLoading(false);
  }, [getPlays, playType, courtTemplate, selectedTag]);

  useEffect(() => {
    if (!isOpen) return;
    void loadPlays();
  }, [isOpen, loadPlays]);

  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen, searchQuery, playType, courtTemplate, selectedTag, searchPlays, loadPlays]);

  const availableTags = useMemo(() => {
    const tags = plays.flatMap((play) => play.tags || []);
    return Array.from(new Set(tags)).sort((a, b) => a.localeCompare(b));
  }, [plays]);

  const templateLabel = (value: CourtTemplate) => {
    if (value === 'half_court') return 'Half Court';
    if (value === 'full_court_vertical') return 'Full Vertical';
    return 'Full Horizontal';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[86vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Attach Play</h2>
            <p className="text-sm text-gray-600">Select one play to snapshot into this activity.</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 grid grid-cols-1 md:grid-cols-5 gap-2">
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

        <div className="p-4 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : plays.length === 0 ? (
            <div className="text-center py-10 text-gray-500">No plays found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {plays.map((play) => (
                <button
                  key={play.id}
                  onClick={() => onSelect(play)}
                  className="text-left border border-gray-200 rounded-lg overflow-hidden hover:border-primary hover:bg-primary/5"
                >
                  <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                    {play.thumbnail_data_url ? (
                      <img src={play.thumbnail_data_url} alt={play.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                        No preview
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-medium text-gray-900 line-clamp-1">{play.name}</div>
                    <div className="text-xs text-gray-600 mt-1 flex flex-wrap gap-1">
                      <span className="px-2 py-0.5 rounded bg-gray-100">{play.play_type}</span>
                      <span className="px-2 py-0.5 rounded bg-gray-100">{templateLabel(play.court_template)}</span>
                      <span className="px-2 py-0.5 rounded bg-gray-100">v{play.version}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
