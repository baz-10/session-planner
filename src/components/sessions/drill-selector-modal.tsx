'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDrills } from '@/hooks/use-drills';
import type { Drill, DrillCategory } from '@/types/database';

interface DrillWithCategory extends Drill {
  category?: DrillCategory | null;
}

interface DrillSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (drill: DrillWithCategory, customDuration?: number) => void;
  onSelectMultiple?: (drills: DrillWithCategory[]) => void;
  onAddCustom: (name: string, duration: number, categoryId?: string) => void;
  categories: DrillCategory[];
  mode?: 'single' | 'multiple';
}

export function DrillSelectorModal({
  isOpen,
  onClose,
  onSelect,
  onSelectMultiple,
  onAddCustom,
  categories,
  mode = 'single',
}: DrillSelectorModalProps) {
  const { getDrills, searchDrills } = useDrills();
  const [drills, setDrills] = useState<DrillWithCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'library' | 'custom'>('library');
  const [selectedDrills, setSelectedDrills] = useState<Map<string, DrillWithCategory>>(new Map());

  // Custom activity form
  const [customName, setCustomName] = useState('');
  const [customDuration, setCustomDuration] = useState('10');
  const [customCategoryId, setCustomCategoryId] = useState('');

  const loadDrills = useCallback(async () => {
    setIsLoading(true);
    const data = await getDrills(selectedCategoryId || undefined);
    setDrills(data);
    setIsLoading(false);
  }, [getDrills, selectedCategoryId]);

  // Reset selections when modal opens/closes or mode changes
  useEffect(() => {
    if (isOpen) {
      setSelectedDrills(new Map());
      setSelectedTag('');
      loadDrills();
    }
  }, [isOpen, mode, loadDrills]);

  // Handle search
  useEffect(() => {
    if (!isOpen) return;

    if (searchQuery.trim()) {
      const timer = setTimeout(async () => {
        setIsLoading(true);
        const results = await searchDrills(searchQuery);
        // Filter by category if selected
        if (selectedCategoryId) {
          setDrills(results.filter(d => d.category_id === selectedCategoryId));
        } else {
          setDrills(results);
        }
        setIsLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      loadDrills();
    }
  }, [searchQuery, selectedCategoryId, isOpen, loadDrills, searchDrills]);

  const availableTags = useMemo(() => {
    const tags = drills.flatMap((drill) => drill.tags || []);
    return Array.from(new Set(tags)).sort((a, b) => a.localeCompare(b));
  }, [drills]);

  const filteredDrills = useMemo(() => {
    if (!selectedTag) return drills;
    return drills.filter((drill) => (drill.tags || []).includes(selectedTag));
  }, [drills, selectedTag]);

  useEffect(() => {
    if (selectedTag && !availableTags.includes(selectedTag)) {
      setSelectedTag('');
    }
  }, [availableTags, selectedTag]);

  const handleAddCustom = () => {
    if (!customName.trim()) return;

    onAddCustom(
      customName.trim(),
      parseInt(customDuration) || 10,
      customCategoryId || undefined
    );

    // Reset form
    setCustomName('');
    setCustomDuration('10');
    setCustomCategoryId('');
    onClose();
  };

  const toggleDrillSelection = useCallback((drill: DrillWithCategory) => {
    if (mode === 'single') {
      onSelect(drill);
      return;
    }

    setSelectedDrills((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(drill.id)) {
        newMap.delete(drill.id);
      } else {
        newMap.set(drill.id, drill);
      }
      return newMap;
    });
  }, [mode, onSelect]);

  const handleAddSelected = useCallback(() => {
    if (onSelectMultiple && selectedDrills.size > 0) {
      onSelectMultiple(Array.from(selectedDrills.values()));
      setSelectedDrills(new Map());
      onClose();
    }
  }, [onSelectMultiple, selectedDrills, onClose]);

  const selectAll = useCallback(() => {
    const newMap = new Map<string, DrillWithCategory>();
    filteredDrills.forEach((drill) => newMap.set(drill.id, drill));
    setSelectedDrills(newMap);
  }, [filteredDrills]);

  const clearSelection = useCallback(() => {
    setSelectedDrills(new Map());
  }, []);

  if (!isOpen) return null;

  const isMultiMode = mode === 'multiple';
  const selectedCount = selectedDrills.size;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {isMultiMode ? 'Add Multiple Drills' : 'Add Activity'}
            </h2>
            {isMultiMode && selectedCount > 0 && (
              <p className="text-sm text-primary mt-1">
                {selectedCount} drill{selectedCount !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs - only show for single mode */}
        {!isMultiMode && (
          <div className="px-6 pt-4 border-b border-gray-200">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('library')}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'library'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                From Library
              </button>
              <button
                onClick={() => setActiveTab('custom')}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'custom'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Custom Activity
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {(activeTab === 'library' || isMultiMode) ? (
            <div className="space-y-4">
              {/* Search and Filter */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search drills..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">All Labels</option>
                  {availableTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>

              {/* Multi-select actions */}
              {isMultiMode && filteredDrills.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="text-primary hover:underline"
                    >
                      Select All
                    </button>
                    {selectedCount > 0 && (
                      <>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={clearSelection}
                          className="text-gray-600 hover:underline"
                        >
                          Clear Selection
                        </button>
                      </>
                    )}
                  </div>
                  <span className="text-gray-500">
                    {filteredDrills.length} drill{filteredDrills.length !== 1 ? 's' : ''} available
                  </span>
                </div>
              )}

              {/* Drill List */}
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredDrills.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchQuery || selectedTag
                    ? 'No drills found matching your filters'
                    : 'No drills in your library yet'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredDrills.map((drill) => {
                    const isSelected = selectedDrills.has(drill.id);
                    return (
                      <button
                        key={drill.id}
                        onClick={() => toggleDrillSelection(drill)}
                        className={`w-full p-3 border rounded-lg text-left transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-gray-200 hover:border-primary hover:bg-primary/5'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isMultiMode && (
                              <div
                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? 'border-primary bg-primary'
                                    : 'border-gray-300'
                                }`}
                              >
                                {isSelected && (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            )}
                            <div>
                              <div className="font-medium">{drill.name}</div>
                              <div className="text-sm text-gray-600 flex items-center gap-2">
                                {drill.category && (
                                  <span
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs text-white"
                                    style={{ backgroundColor: drill.category.color }}
                                  >
                                    {drill.category.name}
                                  </span>
                                )}
                                <span>{drill.default_duration} min</span>
                              </div>
                              {drill.tags && drill.tags.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {drill.tags.map((tag) => (
                                    <span
                                      key={`${drill.id}-${tag}`}
                                      className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          {!isMultiMode && (
                            <svg
                              className="w-5 h-5 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                              />
                            </svg>
                          )}
                        </div>
                        {drill.description && (
                          <p className={`mt-1 text-sm text-gray-500 line-clamp-2 ${isMultiMode ? 'ml-8' : ''}`}>
                            {drill.description}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Activity Name
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g., Warm-up, Drink Break, Scrimmage"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={customDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={customCategoryId}
                    onChange={(e) => setCustomCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleAddCustom}
                disabled={!customName.trim()}
                className="w-full py-2 bg-primary text-white rounded-md hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Activity
              </button>
            </div>
          )}
        </div>

        {/* Footer for multi-select mode */}
        {isMultiMode && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSelected}
              disabled={selectedCount === 0}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add {selectedCount > 0 ? `${selectedCount} Drill${selectedCount !== 1 ? 's' : ''}` : 'Selected'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
