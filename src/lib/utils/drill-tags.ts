import type { Drill } from '@/types/database';

const CATEGORY_TAG_PREFIX = 'cat:';

export function toCategoryTag(categoryId: string): string {
  return `${CATEGORY_TAG_PREFIX}${categoryId}`;
}

export function isInternalCategoryTag(tag: string): boolean {
  return tag.startsWith(CATEGORY_TAG_PREFIX);
}

export function getAdditionalCategoryIdsFromTags(tags?: string[] | null): string[] {
  if (!tags || tags.length === 0) return [];

  return tags
    .filter(isInternalCategoryTag)
    .map((tag) => tag.slice(CATEGORY_TAG_PREFIX.length))
    .filter(Boolean);
}

export function getVisibleLabelTags(tags?: string[] | null): string[] {
  if (!tags || tags.length === 0) return [];
  return tags.filter((tag) => !isInternalCategoryTag(tag));
}

export function buildDrillTags(
  visibleLabels: string[],
  additionalCategoryIds: string[]
): string[] {
  const normalizedVisible = visibleLabels
    .map((label) => label.trim())
    .filter(Boolean)
    .filter((label) => !isInternalCategoryTag(label));

  const categoryTags = additionalCategoryIds
    .map((id) => id.trim())
    .filter(Boolean)
    .map(toCategoryTag);

  return Array.from(new Set([...normalizedVisible, ...categoryTags]));
}

export function drillMatchesCategory(
  drill: Pick<Drill, 'category_id' | 'tags'>,
  categoryId?: string
): boolean {
  if (!categoryId) return true;
  if (drill.category_id === categoryId) return true;

  return getAdditionalCategoryIdsFromTags(drill.tags).includes(categoryId);
}
