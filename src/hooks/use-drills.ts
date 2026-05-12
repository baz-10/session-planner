'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';
import {
  DRILL_MEDIA_EXTENSIONS,
  DRILL_MEDIA_MIME_TYPES,
  getSafeFileExtension,
  isSafeImageFile,
  isSafeVideoFile,
  isTrustedAttachmentFile,
} from '@/lib/utils/attachments';
import { getVisibleLabelTags, toCategoryTag } from '@/lib/utils/drill-tags';
import type {
  Drill,
  DrillCategory,
  DrillMedia,
  CreateDrillInput,
  AttachmentType,
} from '@/types/database';

interface DrillWithDetails extends Drill {
  category?: DrillCategory | null;
  media?: DrillMedia[];
}

interface DrillReadOptions {
  throwOnError?: boolean;
}

const STALE_DRILL_ERROR = 'Drill access changed. Refresh the library and try again.';
const STALE_CATEGORY_ERROR = 'Category access changed. Refresh categories and try again.';
const STALE_MEDIA_ERROR = 'Media access changed. Refresh the drill and try again.';
const MAX_DRILL_MEDIA_BYTES = 50 * 1024 * 1024;
const DRILL_MEDIA_BUCKET = 'drill-media';
const SIGNED_DRILL_MEDIA_URL_SECONDS = 60 * 60;

function validateDrillMedia(file: File) {
  if (file.size > MAX_DRILL_MEDIA_BYTES) {
    return `${file.name} is larger than 50 MB.`;
  }

  if (!isTrustedAttachmentFile(file, DRILL_MEDIA_MIME_TYPES, DRILL_MEDIA_EXTENSIONS)) {
    return `${file.name} is not a supported drill media type.`;
  }

  return null;
}

function createDrillMediaObjectName(fileExtension: string) {
  const uniqueId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${uniqueId}.${fileExtension}`;
}

function getDrillMediaStoragePath(urlOrPath: string) {
  const urlWithoutQuery = urlOrPath.split(/[?#]/)[0];
  const marker = `/${DRILL_MEDIA_BUCKET}/`;

  try {
    const pathname = new URL(urlOrPath).pathname;
    const markerIndex = pathname.indexOf(marker);

    if (markerIndex >= 0) {
      return decodeURIComponent(pathname.slice(markerIndex + marker.length));
    }
  } catch {
    // Fall through to the legacy path extraction below.
  }

  const markerIndex = urlWithoutQuery.indexOf(marker);
  if (markerIndex >= 0) {
    const storagePath = decodeURIComponent(urlWithoutQuery.slice(markerIndex + marker.length));
    return storagePath || null;
  }

  const fallbackPath = urlWithoutQuery.split('/').filter(Boolean).slice(-2).join('/');
  return fallbackPath || null;
}

export function useDrills() {
  const { user, currentTeam } = useAuth();
  const supabase = getBrowserSupabaseClient();
  const [isLoading, setIsLoading] = useState(false);

  const signDrillMediaUrl = useCallback(
    async (media: DrillMedia): Promise<DrillMedia> => {
      const storagePath = media.url ? getDrillMediaStoragePath(media.url) : null;
      if (!storagePath) {
        return media;
      }

      const { data, error } = await supabase.storage
        .from(DRILL_MEDIA_BUCKET)
        .createSignedUrl(storagePath, SIGNED_DRILL_MEDIA_URL_SECONDS);

      if (error || !data?.signedUrl) {
        console.error('Error creating signed drill media URL:', error);
        return media;
      }

      return { ...media, url: data.signedUrl };
    },
    [supabase]
  );

  const attachSignedMediaUrls = useCallback(
    async (drills: DrillWithDetails[]): Promise<DrillWithDetails[]> => {
      return Promise.all(
        drills.map(async (drill) => ({
          ...drill,
          media: await Promise.all((drill.media || []).map(signDrillMediaUrl)),
        }))
      );
    },
    [signDrillMediaUrl]
  );

  const toDrillErrorMessage = (error: { code?: string; message?: string } | null, fallback: string) => {
    if (!error) return fallback;

    if (error.code === '42501' || error.message?.toLowerCase().includes('row-level security')) {
      return 'You do not have permission to manage drills or categories for the selected team. Try switching to the correct team.';
    }

    return error.message || fallback;
  };

  /**
   * Get all drills for the current team
   */
  const getDrills = useCallback(
    async (categoryId?: string, options: DrillReadOptions = {}): Promise<DrillWithDetails[]> => {
      if (!currentTeam) return [];

      let query = supabase
        .from('drills')
        .select(`
          *,
          category:drill_categories(*),
          media:drill_media(*)
        `)
        .eq('team_id', currentTeam.id)
        .order('name', { ascending: true });

      if (categoryId) {
        query = query.or(`category_id.eq.${categoryId},tags.cs.{${toCategoryTag(categoryId)}}`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching drills with relations:', error);

        // Fallback: relation metadata can occasionally go stale after schema changes.
        // Fetch base drills so the library still loads instead of showing empty.
        let fallbackQuery = supabase
          .from('drills')
          .select('*')
          .eq('team_id', currentTeam.id)
          .order('name', { ascending: true });

        if (categoryId) {
          fallbackQuery = fallbackQuery.or(`category_id.eq.${categoryId},tags.cs.{${toCategoryTag(categoryId)}}`);
        }

        const { data: fallbackData, error: fallbackError } = await fallbackQuery;

        if (fallbackError) {
          console.error('Error fetching drills (fallback):', fallbackError);
          if (options.throwOnError) {
            throw new Error('Failed to load drill library.');
          }
          return [];
        }

        return (fallbackData || []).map((drill) => ({
          ...drill,
          category: null,
          media: [],
        })) as DrillWithDetails[];
      }

      return attachSignedMediaUrls(data as DrillWithDetails[]);
    },
    [supabase, currentTeam, attachSignedMediaUrls]
  );

  /**
   * Get a single drill with details
   */
  const getDrill = useCallback(
    async (drillId: string): Promise<DrillWithDetails | null> => {
      const { data, error } = await supabase
        .from('drills')
        .select(`
          *,
          category:drill_categories(*),
          media:drill_media(*)
        `)
        .eq('id', drillId)
        .single();

      if (error || !data) {
        console.error('Error fetching drill:', error);
        return null;
      }

      const [signedDrill] = await attachSignedMediaUrls([data as DrillWithDetails]);
      return signedDrill || (data as DrillWithDetails);
    },
    [supabase, attachSignedMediaUrls]
  );

  /**
   * Create a new drill
   */
  const createDrill = useCallback(
    async (input: CreateDrillInput): Promise<{ success: boolean; drill?: Drill; error?: string }> => {
      if (!user || !currentTeam) {
        return { success: false, error: 'Not authenticated or no team selected' };
      }

      setIsLoading(true);

      try {
        const { data, error } = await supabase
          .from('drills')
          .insert({
            team_id: currentTeam.id,
            organization_id: input.organization_id || null,
            category_id: input.category_id || null,
            name: input.name,
            description: input.description || null,
            default_duration: input.default_duration || 10,
            notes: input.notes || null,
            tags: input.tags || [],
            created_by: user.id,
          })
          .select()
          .single();

        if (error || !data) {
          console.error('Error creating drill:', error);
          return {
            success: false,
            error: toDrillErrorMessage(error, 'Failed to create drill'),
          };
        }

        return { success: true, drill: data as Drill };
      } catch (error) {
        console.error('Unexpected error creating drill:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create drill',
        };
      } finally {
        setIsLoading(false);
      }
    },
    [user, currentTeam, supabase]
  );

  /**
   * Update a drill
   */
  const updateDrill = useCallback(
    async (drillId: string, updates: Partial<Drill>): Promise<{ success: boolean; error?: string }> => {
      if (!currentTeam) {
        return { success: false, error: 'Select a team before updating this drill.' };
      }

      setIsLoading(true);

      try {
        const { error, count } = await supabase
          .from('drills')
          .update(updates, { count: 'exact' })
          .eq('id', drillId)
          .eq('team_id', currentTeam.id);

        if (error) {
          console.error('Error updating drill:', error);
          return {
            success: false,
            error: toDrillErrorMessage(error, 'Failed to update drill'),
          };
        }

        if (count === 0) {
          return { success: false, error: STALE_DRILL_ERROR };
        }

        return { success: true };
      } catch (error) {
        console.error('Unexpected error updating drill:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update drill',
        };
      } finally {
        setIsLoading(false);
      }
    },
    [supabase, currentTeam]
  );

  /**
   * Delete a drill
   */
  const deleteDrill = useCallback(
    async (drillId: string): Promise<{ success: boolean; error?: string }> => {
      if (!currentTeam) {
        return { success: false, error: 'Select a team before deleting this drill.' };
      }

      const { error, count } = await supabase
        .from('drills')
        .delete({ count: 'exact' })
        .eq('id', drillId)
        .eq('team_id', currentTeam.id);

      if (error) {
        console.error('Error deleting drill:', error);
        return { success: false, error: 'Failed to delete drill' };
      }

      if (count === 0) {
        return { success: false, error: STALE_DRILL_ERROR };
      }

      return { success: true };
    },
    [supabase, currentTeam]
  );

  /**
   * Add media to a drill
   */
  const addDrillMedia = useCallback(
    async (
      drillId: string,
      file: File
    ): Promise<{ success: boolean; media?: DrillMedia; error?: string }> => {
      const validationError = validateDrillMedia(file);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // Upload file to storage
      const fileExt = getSafeFileExtension(file, DRILL_MEDIA_EXTENSIONS);
      const fileName = `${drillId}/${createDrillMediaObjectName(fileExt)}`;

      const { error: uploadError } = await supabase.storage
        .from(DRILL_MEDIA_BUCKET)
        .upload(fileName, file);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        return { success: false, error: 'Failed to upload file' };
      }

      // Determine type
      const type: AttachmentType = isSafeImageFile(file)
        ? 'image'
        : isSafeVideoFile(file)
        ? 'video'
        : 'document';

      // Create media record
      const { data, error } = await supabase
        .from('drill_media')
        .insert({
          drill_id: drillId,
          type,
          url: fileName,
          filename: file.name,
          size_bytes: file.size,
        })
        .select()
        .single();

      if (error || !data) {
        console.error('Error creating media record:', error);
        const { error: cleanupError } = await supabase.storage
          .from(DRILL_MEDIA_BUCKET)
          .remove([fileName]);

        if (cleanupError) {
          console.error('Error cleaning up failed drill media upload:', cleanupError);
        }

        return { success: false, error: 'Failed to save media record' };
      }

      return { success: true, media: await signDrillMediaUrl(data as DrillMedia) };
    },
    [supabase, signDrillMediaUrl]
  );

  /**
   * Delete media from a drill
   */
  const deleteDrillMedia = useCallback(
    async (mediaId: string): Promise<{ success: boolean; error?: string }> => {
      // Get the media record first to get the URL
      const { data: media } = await supabase
        .from('drill_media')
        .select('url')
        .eq('id', mediaId)
        .single();

      // Delete the record
      const { error, count } = await supabase
        .from('drill_media')
        .delete({ count: 'exact' })
        .eq('id', mediaId);

      if (error) {
        console.error('Error deleting media:', error);
        return { success: false, error: 'Failed to delete media' };
      }

      if (count === 0) {
        return { success: false, error: STALE_MEDIA_ERROR };
      }

      if (media?.url) {
        const filePath = getDrillMediaStoragePath(media.url);
        const { error: storageError } = filePath
          ? await supabase.storage.from(DRILL_MEDIA_BUCKET).remove([filePath])
          : { error: null };

        if (storageError) {
          console.error('Error cleaning up deleted drill media file:', storageError);
        }
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Get all categories
   */
  const getCategories = useCallback(async (): Promise<DrillCategory[]> => {
    // Get both team-specific and default (null team_id) categories
    const { data, error } = await supabase
      .from('drill_categories')
      .select('*')
      .or(currentTeam ? `team_id.eq.${currentTeam.id},team_id.is.null` : 'team_id.is.null')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      return [];
    }

    return data as DrillCategory[];
  }, [supabase, currentTeam]);

  /**
   * Create a category
   */
  const createCategory = useCallback(
    async (
      name: string,
      color: string = '#3b82f6'
    ): Promise<{ success: boolean; category?: DrillCategory; error?: string }> => {
      if (!currentTeam) {
        return { success: false, error: 'No team selected' };
      }

      // Get the next sort order
      const { data: existing, error: existingError } = await supabase
        .from('drill_categories')
        .select('sort_order')
        .eq('team_id', currentTeam.id)
        .order('sort_order', { ascending: false })
        .limit(1);

      if (existingError) {
        console.error('Error loading category sort order:', existingError);
        return {
          success: false,
          error: toDrillErrorMessage(existingError, 'Failed to create category'),
        };
      }

      const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

      const { data, error } = await supabase
        .from('drill_categories')
        .insert({
          team_id: currentTeam.id,
          name,
          color,
          sort_order: nextOrder,
        })
        .select()
        .single();

      if (error || !data) {
        console.error('Error creating category:', error);
        return {
          success: false,
          error: toDrillErrorMessage(error, 'Failed to create category'),
        };
      }

      return { success: true, category: data as DrillCategory };
    },
    [supabase, currentTeam]
  );

  /**
   * Update a category
   */
  const updateCategory = useCallback(
    async (
      categoryId: string,
      updates: Partial<DrillCategory>
    ): Promise<{ success: boolean; error?: string }> => {
      const { error, count } = await supabase
        .from('drill_categories')
        .update(updates, { count: 'exact' })
        .eq('id', categoryId);

      if (error) {
        console.error('Error updating category:', error);
        return { success: false, error: 'Failed to update category' };
      }

      if (count === 0) {
        return { success: false, error: STALE_CATEGORY_ERROR };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Delete a category
   */
  const deleteCategory = useCallback(
    async (categoryId: string): Promise<{ success: boolean; error?: string }> => {
      const { error, count } = await supabase
        .from('drill_categories')
        .delete({ count: 'exact' })
        .eq('id', categoryId);

      if (error) {
        console.error('Error deleting category:', error);
        return { success: false, error: 'Failed to delete category' };
      }

      if (count === 0) {
        return { success: false, error: STALE_CATEGORY_ERROR };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Search drills
   */
  const searchDrills = useCallback(
    async (query: string, options: DrillReadOptions = {}): Promise<DrillWithDetails[]> => {
      const normalizedQuery = query.trim().toLowerCase();
      if (!currentTeam || !normalizedQuery) return [];

      const { data, error } = await supabase
        .from('drills')
        .select(`
          *,
          category:drill_categories(*),
          media:drill_media(*)
        `)
        .eq('team_id', currentTeam.id)
        .order('name', { ascending: true })
        .limit(200);

      if (error) {
        console.error('Error searching drills with relations:', error);

        const { data: fallbackData, error: fallbackError } = await supabase
          .from('drills')
          .select('*')
          .eq('team_id', currentTeam.id)
          .order('name', { ascending: true })
          .limit(200);

        if (fallbackError) {
          console.error('Error searching drills (fallback):', fallbackError);
          if (options.throwOnError) {
            throw new Error('Failed to search drill library.');
          }
          return [];
        }

        const fallbackDrills = (fallbackData || []).map((drill) => ({
          ...drill,
          category: null,
          media: [],
        })) as DrillWithDetails[];

        return fallbackDrills.filter((drill) => {
          const searchableText = [
            drill.name || '',
            drill.description || '',
            drill.notes || '',
            getVisibleLabelTags(drill.tags).join(' '),
          ]
            .join(' ')
            .toLowerCase();

          return searchableText.includes(normalizedQuery);
        }).slice(0, 20);
      }

      const drills = (data || []) as DrillWithDetails[];

      const filteredDrills = drills.filter((drill) => {
        const searchableText = [
          drill.name || '',
          drill.description || '',
          drill.notes || '',
          getVisibleLabelTags(drill.tags).join(' '),
        ]
          .join(' ')
          .toLowerCase();

        return searchableText.includes(normalizedQuery);
      });

      return filteredDrills.slice(0, 20);
    },
    [supabase, currentTeam]
  );

  return {
    isLoading,
    getDrills,
    getDrill,
    createDrill,
    updateDrill,
    deleteDrill,
    addDrillMedia,
    deleteDrillMedia,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    searchDrills,
  };
}
