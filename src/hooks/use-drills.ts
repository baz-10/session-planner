'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';
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

export function useDrills() {
  const { user, currentTeam } = useAuth();
  const supabase = getBrowserSupabaseClient();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Get all drills for the current team
   */
  const getDrills = useCallback(
    async (categoryId?: string): Promise<DrillWithDetails[]> => {
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
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching drills:', error);
        return [];
      }

      return data as DrillWithDetails[];
    },
    [supabase, currentTeam]
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

      return data as DrillWithDetails;
    },
    [supabase]
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

      setIsLoading(false);

      if (error || !data) {
        console.error('Error creating drill:', error);
        return { success: false, error: 'Failed to create drill' };
      }

      return { success: true, drill: data as Drill };
    },
    [user, currentTeam, supabase]
  );

  /**
   * Update a drill
   */
  const updateDrill = useCallback(
    async (drillId: string, updates: Partial<Drill>): Promise<{ success: boolean; error?: string }> => {
      setIsLoading(true);
      const { error } = await supabase.from('drills').update(updates).eq('id', drillId);
      setIsLoading(false);

      if (error) {
        console.error('Error updating drill:', error);
        return { success: false, error: 'Failed to update drill' };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Delete a drill
   */
  const deleteDrill = useCallback(
    async (drillId: string): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase.from('drills').delete().eq('id', drillId);

      if (error) {
        console.error('Error deleting drill:', error);
        return { success: false, error: 'Failed to delete drill' };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Add media to a drill
   */
  const addDrillMedia = useCallback(
    async (
      drillId: string,
      file: File
    ): Promise<{ success: boolean; media?: DrillMedia; error?: string }> => {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${drillId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('drill-media')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        return { success: false, error: 'Failed to upload file' };
      }

      // Get public URL
      const { data: urlData } = supabase.storage.from('drill-media').getPublicUrl(fileName);

      // Determine type
      const type: AttachmentType = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
        ? 'audio'
        : 'document';

      // Create media record
      const { data, error } = await supabase
        .from('drill_media')
        .insert({
          drill_id: drillId,
          type,
          url: urlData.publicUrl,
          filename: file.name,
          size_bytes: file.size,
        })
        .select()
        .single();

      if (error || !data) {
        console.error('Error creating media record:', error);
        return { success: false, error: 'Failed to save media record' };
      }

      return { success: true, media: data as DrillMedia };
    },
    [supabase]
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

      if (media?.url) {
        // Extract file path from URL and delete from storage
        const urlParts = media.url.split('/');
        const filePath = urlParts.slice(-2).join('/');
        await supabase.storage.from('drill-media').remove([filePath]);
      }

      // Delete the record
      const { error } = await supabase.from('drill_media').delete().eq('id', mediaId);

      if (error) {
        console.error('Error deleting media:', error);
        return { success: false, error: 'Failed to delete media' };
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
      const { data: existing } = await supabase
        .from('drill_categories')
        .select('sort_order')
        .eq('team_id', currentTeam.id)
        .order('sort_order', { ascending: false })
        .limit(1);

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
        return { success: false, error: 'Failed to create category' };
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
      const { error } = await supabase
        .from('drill_categories')
        .update(updates)
        .eq('id', categoryId);

      if (error) {
        console.error('Error updating category:', error);
        return { success: false, error: 'Failed to update category' };
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
      const { error } = await supabase.from('drill_categories').delete().eq('id', categoryId);

      if (error) {
        console.error('Error deleting category:', error);
        return { success: false, error: 'Failed to delete category' };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Search drills
   */
  const searchDrills = useCallback(
    async (query: string): Promise<DrillWithDetails[]> => {
      if (!currentTeam || !query.trim()) return [];

      const { data, error } = await supabase
        .from('drills')
        .select(`
          *,
          category:drill_categories(*),
          media:drill_media(*)
        `)
        .eq('team_id', currentTeam.id)
        .ilike('name', `%${query}%`)
        .order('name', { ascending: true })
        .limit(20);

      if (error) {
        console.error('Error searching drills:', error);
        return [];
      }

      return data as DrillWithDetails[];
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
