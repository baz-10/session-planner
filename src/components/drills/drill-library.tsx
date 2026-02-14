'use client';

import { useState, useEffect, useMemo } from 'react';
import { useDrills } from '@/hooks/use-drills';
import { DrillForm } from './drill-form';
import { CategoryManager } from './category-manager';
import type { Drill, DrillCategory, DrillMedia } from '@/types/database';

interface DrillWithDetails extends Drill {
  category?: DrillCategory | null;
  media?: DrillMedia[];
}

export function DrillLibrary() {
  const {
    getDrills,
    getCategories,
    deleteDrill,
    searchDrills,
  } = useDrills();

  const [drills, setDrills] = useState<DrillWithDetails[]>([]);
  const [categories, setCategories] = useState<DrillCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [editingDrill, setEditingDrill] = useState<DrillWithDetails | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      handleSearch();
    } else {
      loadDrills();
    }
  }, [searchQuery, selectedCategoryId]);

  const availableTags = useMemo(() => {
    const tags = drills.flatMap((drill) => drill.tags || []);
    return Array.from(new Set(tags)).sort((a, b) => a.localeCompare(b));
  }, [drills]);

  const visibleDrills = useMemo(() => {
    if (!selectedTag) return drills;
    return drills.filter((drill) => (drill.tags || []).includes(selectedTag));
  }, [drills, selectedTag]);

  useEffect(() => {
    if (selectedTag && !availableTags.includes(selectedTag)) {
      setSelectedTag('');
    }
  }, [availableTags, selectedTag]);

  const loadData = async () => {
    setIsLoading(true);
    await Promise.all([loadDrills(), loadCategories()]);
    setIsLoading(false);
  };

  const loadDrills = async () => {
    const data = await getDrills(selectedCategoryId || undefined);
    setDrills(data);
  };

  const loadCategories = async () => {
    const data = await getCategories();
    setCategories(data);
  };

  const handleSearch = async () => {
    const results = await searchDrills(searchQuery);
    // Filter by category if selected
    if (selectedCategoryId) {
      setDrills(results.filter((d) => d.category_id === selectedCategoryId));
    } else {
      setDrills(results);
    }
  };

  const handleDelete = async (drill: DrillWithDetails) => {
    if (!confirm(`Are you sure you want to delete "${drill.name}"?`)) return;

    const result = await deleteDrill(drill.id);
    if (result.success) {
      setDrills((prev) => prev.filter((d) => d.id !== drill.id));
    }
  };

  const handleEdit = (drill: DrillWithDetails) => {
    setEditingDrill(drill);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingDrill(null);
  };

  const handleFormSuccess = () => {
    loadDrills();
    handleFormClose();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search drills..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Category Filter */}
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

          {/* Label Filter */}
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

          {/* Actions */}
          <button
            onClick={() => setIsCategoryManagerOpen(true)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            Manage Categories
          </button>
          <button
            onClick={() => setIsFormOpen(true)}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light"
          >
            Create New Drill
          </button>
        </div>
      </div>

      {/* Drill List */}
      {visibleDrills.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-xl font-semibold mb-2">
            {searchQuery || selectedTag ? 'No Drills Found' : 'No Drills Yet'}
          </h2>
          <p className="text-gray-600 mb-6">
            {searchQuery || selectedTag
              ? 'Try a different search term, category, or label.'
              : 'Start building your drill library to use in practice plans.'}
          </p>
          {!searchQuery && !selectedTag && (
            <button
              onClick={() => setIsFormOpen(true)}
              className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-light"
            >
              Create Your First Drill
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Labels
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Media
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {visibleDrills.map((drill) => (
                <tr key={drill.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {drill.category ? (
                      <span
                        className="px-2 py-1 text-xs text-white rounded"
                        style={{ backgroundColor: drill.category.color }}
                      >
                        {drill.category.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{drill.name}</div>
                    {drill.description && (
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {drill.description}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {drill.default_duration} min
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-500 truncate block max-w-xs">
                      {drill.notes || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {drill.tags && drill.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {drill.tags.map((tag) => (
                          <span
                            key={`${drill.id}-${tag}`}
                            className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {drill.media && drill.media.length > 0 ? (
                      <span className="text-primary">
                        {drill.media.length} file{drill.media.length !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(drill)}
                        className="p-1 text-gray-600 hover:text-primary hover:bg-gray-100 rounded"
                        title="Edit"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(drill)}
                        className="p-1 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drill Form Modal */}
      {isFormOpen && (
        <DrillForm
          drill={editingDrill}
          categories={categories}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Category Manager Modal */}
      {isCategoryManagerOpen && (
        <CategoryManager
          categories={categories}
          onClose={() => setIsCategoryManagerOpen(false)}
          onUpdate={loadCategories}
        />
      )}
    </div>
  );
}
