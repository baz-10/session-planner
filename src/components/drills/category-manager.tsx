'use client';

import { useState } from 'react';
import { useDrills } from '@/hooks/use-drills';
import { useConfirmDialog } from '@/components/ui';
import type { DrillCategory } from '@/types/database';

interface CategoryManagerProps {
  categories: DrillCategory[];
  onClose: () => void;
  onUpdate: () => void | Promise<void>;
}

const DEFAULT_COLORS = [
  '#1e3a5f', // Navy
  '#2563eb', // Blue
  '#7c3aed', // Purple
  '#db2777', // Pink
  '#dc2626', // Red
  '#ea580c', // Orange
  '#ca8a04', // Yellow
  '#16a34a', // Green
  '#0d9488', // Teal
  '#64748b', // Slate
];

export function CategoryManager({ categories, onClose, onUpdate }: CategoryManagerProps) {
  const { createCategory, updateCategory, deleteCategory, isLoading } = useDrills();

  const [editingCategory, setEditingCategory] = useState<DrillCategory | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(DEFAULT_COLORS[0]);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [error, setError] = useState('');
  const [activeAction, setActiveAction] = useState<{
    type: 'create' | 'update' | 'delete';
    categoryId?: string;
  } | null>(null);
  const { confirmAction, confirmDialog } = useConfirmDialog();
  const isBusy = isLoading || activeAction !== null;

  const handleCreateCategory = async () => {
    if (isBusy) return;

    if (!newCategoryName.trim()) {
      setError('Category name is required');
      return;
    }

    setError('');
    setActiveAction({ type: 'create' });
    try {
      const result = await createCategory(newCategoryName.trim(), newCategoryColor);

      if (result.success) {
        setNewCategoryName('');
        setNewCategoryColor(DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)]);
        await onUpdate();
      } else {
        setError(result.error || 'Failed to create category');
      }
    } catch (error) {
      console.error('Unexpected error creating drill category:', error);
      setError(error instanceof Error ? error.message : 'Failed to create category');
    } finally {
      setActiveAction(null);
    }
  };

  const handleStartEdit = (category: DrillCategory) => {
    setEditingCategory(category);
    setEditName(category.name);
    setEditColor(category.color);
    setError('');
  };

  const handleSaveEdit = async () => {
    if (isBusy) return;
    if (!editingCategory) return;

    if (!editName.trim()) {
      setError('Category name is required');
      return;
    }

    setError('');
    setActiveAction({ type: 'update', categoryId: editingCategory.id });
    try {
      const result = await updateCategory(editingCategory.id, {
        name: editName.trim(),
        color: editColor,
      });

      if (result.success) {
        setEditingCategory(null);
        await onUpdate();
      } else {
        setError(result.error || 'Failed to update category');
      }
    } catch (error) {
      console.error('Unexpected error updating drill category:', error);
      setError(error instanceof Error ? error.message : 'Failed to update category');
    } finally {
      setActiveAction(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditName('');
    setEditColor('');
    setError('');
  };

  const handleDelete = async (category: DrillCategory) => {
    const confirmed = await confirmAction({
      title: 'Delete category?',
      description: `Drills using "${category.name}" will be uncategorized.`,
      confirmLabel: 'Delete category',
      confirmVariant: 'destructive',
    });

    if (!confirmed) return;

    setError('');
    setActiveAction({ type: 'delete', categoryId: category.id });
    try {
      const result = await deleteCategory(category.id);
      if (result.success) {
        await onUpdate();
      } else {
        setError(result.error || 'Failed to delete category');
      }
    } catch (error) {
      console.error('Unexpected error deleting drill category:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete category');
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        aria-busy={isBusy}
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Manage Categories</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="p-1 text-gray-500 hover:text-gray-700 rounded disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Create New Category */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Create New Category</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category name"
                disabled={isBusy}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <div className="relative">
                <input
                  type="color"
                  value={newCategoryColor}
                  onChange={(e) => setNewCategoryColor(e.target.value)}
                  disabled={isBusy}
                  className="w-10 h-10 rounded cursor-pointer border border-gray-300"
                  title="Choose color"
                />
              </div>
              <button
                type="button"
                onClick={handleCreateCategory}
                disabled={isBusy}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light disabled:opacity-50"
              >
                {activeAction?.type === 'create' ? 'Adding...' : 'Add'}
              </button>
            </div>

            {/* Color presets */}
            <div className="flex gap-1 flex-wrap">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewCategoryColor(color)}
                  disabled={isBusy}
                  className={`w-6 h-6 rounded border-2 ${
                    newCategoryColor === color ? 'border-gray-800' : 'border-transparent'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Existing Categories */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">
              Existing Categories ({categories.length})
            </h3>

            {categories.length === 0 ? (
              <p className="text-gray-500 text-sm">No categories yet. Create one above.</p>
            ) : (
              <div className="space-y-2">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-md"
                  >
                    {editingCategory?.id === category.id ? (
                      // Edit mode
                      <>
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          disabled={isBusy}
                          className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                        />
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          disabled={isBusy}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={isBusy}
                          className="p-1 text-green-600 hover:bg-green-50 rounded disabled:cursor-not-allowed disabled:opacity-50"
                          title="Save"
                        >
                          {activeAction?.type === 'update' &&
                          activeAction.categoryId === editingCategory.id ? (
                            <span className="block h-5 w-5 animate-spin rounded-full border-2 border-green-200 border-b-green-600" />
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          disabled={isBusy}
                          className="p-1 text-gray-600 hover:bg-gray-100 rounded disabled:cursor-not-allowed disabled:opacity-50"
                          title="Cancel"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      // View mode
                      <>
                        <div
                          className="w-8 h-8 rounded flex-shrink-0"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="flex-1 font-medium">{category.name}</span>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(category)}
                          disabled={isBusy}
                          className="p-1 text-gray-600 hover:bg-gray-200 rounded disabled:cursor-not-allowed disabled:opacity-50"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(category)}
                          disabled={isBusy}
                          className="p-1 text-red-600 hover:bg-red-50 rounded disabled:cursor-not-allowed disabled:opacity-50"
                          title="Delete"
                        >
                          {activeAction?.type === 'delete' &&
                          activeAction.categoryId === category.id ? (
                            <span className="block h-5 w-5 animate-spin rounded-full border-2 border-red-200 border-b-red-600" />
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
