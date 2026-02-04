'use client';

import { useCallback, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';
import type {
  Post,
  PostAttachment,
  Reaction,
  Comment,
  Profile,
  CreatePostInput,
  AttachmentType,
} from '@/types/database';

interface PostWithDetails extends Post {
  author: Profile;
  attachments: PostAttachment[];
  reactions: ReactionWithUser[];
  comments: CommentWithAuthor[];
  view_count: number;
  has_viewed: boolean;
}

interface ReactionWithUser extends Reaction {
  user: Profile;
}

interface CommentWithAuthor extends Comment {
  author: Profile;
}

interface ReactionSummary {
  emoji: string;
  count: number;
  users: Profile[];
  hasReacted: boolean;
}

export function usePosts() {
  const { user, currentTeam } = useAuth();
  const supabase = getBrowserSupabaseClient();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Get all posts for the current team
   */
  const getPosts = useCallback(
    async (limit = 20, offset = 0): Promise<PostWithDetails[]> => {
      if (!currentTeam || !user) return [];

      const { data: posts, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!author_id(*),
          attachments:post_attachments(*),
          reactions(*, user:profiles!user_id(*)),
          comments(*, author:profiles!author_id(*))
        `)
        .eq('team_id', currentTeam.id)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching posts:', error);
        return [];
      }

      // Get view counts and check if user has viewed
      const postIds = posts.map((p) => p.id);
      const { data: views } = await supabase
        .from('post_views')
        .select('post_id, user_id')
        .in('post_id', postIds);

      const viewCounts = new Map<string, number>();
      const hasViewed = new Map<string, boolean>();

      views?.forEach((v) => {
        viewCounts.set(v.post_id, (viewCounts.get(v.post_id) || 0) + 1);
        if (v.user_id === user.id) {
          hasViewed.set(v.post_id, true);
        }
      });

      return posts.map((post) => ({
        ...post,
        view_count: viewCounts.get(post.id) || 0,
        has_viewed: hasViewed.get(post.id) || false,
      })) as PostWithDetails[];
    },
    [supabase, currentTeam, user]
  );

  /**
   * Get a single post by ID
   */
  const getPost = useCallback(
    async (postId: string): Promise<PostWithDetails | null> => {
      if (!user) return null;

      const { data: post, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!author_id(*),
          attachments:post_attachments(*),
          reactions(*, user:profiles!user_id(*)),
          comments(*, author:profiles!author_id(*))
        `)
        .eq('id', postId)
        .single();

      if (error || !post) {
        console.error('Error fetching post:', error);
        return null;
      }

      // Get view count
      const { count } = await supabase
        .from('post_views')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);

      // Check if user has viewed
      const { data: userView } = await supabase
        .from('post_views')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .single();

      return {
        ...post,
        view_count: count || 0,
        has_viewed: !!userView,
      } as PostWithDetails;
    },
    [supabase, user]
  );

  /**
   * Create a new post
   */
  const createPost = useCallback(
    async (
      input: CreatePostInput,
      attachmentFiles?: File[]
    ): Promise<{ success: boolean; post?: Post; error?: string }> => {
      if (!user || !currentTeam) {
        return { success: false, error: 'Not authenticated or no team selected' };
      }

      setIsLoading(true);

      const { data: post, error } = await supabase
        .from('posts')
        .insert({
          team_id: currentTeam.id,
          author_id: user.id,
          content: input.content,
          pinned: false,
        })
        .select()
        .single();

      if (error || !post) {
        setIsLoading(false);
        console.error('Error creating post:', error);
        return { success: false, error: 'Failed to create post' };
      }

      // Upload attachments if any
      if (attachmentFiles && attachmentFiles.length > 0) {
        for (const file of attachmentFiles) {
          await uploadAttachment(post.id, file);
        }
      }

      setIsLoading(false);
      return { success: true, post: post as Post };
    },
    [user, currentTeam, supabase]
  );

  /**
   * Update a post
   */
  const updatePost = useCallback(
    async (
      postId: string,
      content: string
    ): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase
        .from('posts')
        .update({ content })
        .eq('id', postId);

      if (error) {
        console.error('Error updating post:', error);
        return { success: false, error: 'Failed to update post' };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Delete a post
   */
  const deletePost = useCallback(
    async (postId: string): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase.from('posts').delete().eq('id', postId);

      if (error) {
        console.error('Error deleting post:', error);
        return { success: false, error: 'Failed to delete post' };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Pin/unpin a post
   */
  const togglePin = useCallback(
    async (
      postId: string,
      pinned: boolean
    ): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase
        .from('posts')
        .update({
          pinned,
          pinned_at: pinned ? new Date().toISOString() : null,
        })
        .eq('id', postId);

      if (error) {
        console.error('Error toggling pin:', error);
        return { success: false, error: 'Failed to toggle pin' };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Upload an attachment to a post
   */
  const uploadAttachment = useCallback(
    async (
      postId: string,
      file: File
    ): Promise<{ success: boolean; attachment?: PostAttachment; error?: string }> => {
      if (!user || !currentTeam) {
        return { success: false, error: 'Not authenticated' };
      }

      const fileExt = file.name.split('.').pop();
      const filePath = `${currentTeam.id}/posts/${postId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        return { success: false, error: 'Failed to upload file' };
      }

      const { data: publicUrl } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      // Determine attachment type
      let attachmentType: AttachmentType = 'document';
      if (file.type.startsWith('image/')) attachmentType = 'image';
      else if (file.type.startsWith('video/')) attachmentType = 'video';
      else if (file.type.startsWith('audio/')) attachmentType = 'audio';

      const { data: attachment, error } = await supabase
        .from('post_attachments')
        .insert({
          post_id: postId,
          type: attachmentType,
          url: publicUrl.publicUrl,
          filename: file.name,
          size_bytes: file.size,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving attachment:', error);
        return { success: false, error: 'Failed to save attachment record' };
      }

      return { success: true, attachment: attachment as PostAttachment };
    },
    [user, currentTeam, supabase]
  );

  /**
   * Delete an attachment
   */
  const deleteAttachment = useCallback(
    async (attachmentId: string): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase
        .from('post_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) {
        console.error('Error deleting attachment:', error);
        return { success: false, error: 'Failed to delete attachment' };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Add a reaction to a post
   */
  const addReaction = useCallback(
    async (
      postId: string,
      emoji: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Check if user already reacted with this emoji
      const { data: existing } = await supabase
        .from('reactions')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .single();

      if (existing) {
        // Remove the reaction (toggle off)
        const { error } = await supabase
          .from('reactions')
          .delete()
          .eq('id', existing.id);

        if (error) {
          console.error('Error removing reaction:', error);
          return { success: false, error: 'Failed to remove reaction' };
        }
      } else {
        // Add the reaction
        const { error } = await supabase.from('reactions').insert({
          post_id: postId,
          user_id: user.id,
          emoji,
        });

        if (error) {
          console.error('Error adding reaction:', error);
          return { success: false, error: 'Failed to add reaction' };
        }
      }

      return { success: true };
    },
    [user, supabase]
  );

  /**
   * Get reaction summary for a post
   */
  const getReactionSummary = useCallback(
    (reactions: ReactionWithUser[]): ReactionSummary[] => {
      if (!user) return [];

      const emojiMap = new Map<
        string,
        { count: number; users: Profile[]; hasReacted: boolean }
      >();

      reactions.forEach((reaction) => {
        const existing = emojiMap.get(reaction.emoji) || {
          count: 0,
          users: [],
          hasReacted: false,
        };
        existing.count++;
        existing.users.push(reaction.user);
        if (reaction.user_id === user.id) {
          existing.hasReacted = true;
        }
        emojiMap.set(reaction.emoji, existing);
      });

      return Array.from(emojiMap.entries()).map(([emoji, data]) => ({
        emoji,
        ...data,
      }));
    },
    [user]
  );

  /**
   * Add a comment to a post
   */
  const addComment = useCallback(
    async (
      postId: string,
      content: string
    ): Promise<{ success: boolean; comment?: Comment; error?: string }> => {
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { data: comment, error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          author_id: user.id,
          content,
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding comment:', error);
        return { success: false, error: 'Failed to add comment' };
      }

      return { success: true, comment: comment as Comment };
    },
    [user, supabase]
  );

  /**
   * Update a comment
   */
  const updateComment = useCallback(
    async (
      commentId: string,
      content: string
    ): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase
        .from('comments')
        .update({ content })
        .eq('id', commentId);

      if (error) {
        console.error('Error updating comment:', error);
        return { success: false, error: 'Failed to update comment' };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Delete a comment
   */
  const deleteComment = useCallback(
    async (commentId: string): Promise<{ success: boolean; error?: string }> => {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) {
        console.error('Error deleting comment:', error);
        return { success: false, error: 'Failed to delete comment' };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Mark a post as viewed
   */
  const markAsViewed = useCallback(
    async (postId: string): Promise<void> => {
      if (!user) return;

      // Use upsert to avoid duplicates
      await supabase.from('post_views').upsert(
        {
          post_id: postId,
          user_id: user.id,
        },
        { onConflict: 'post_id,user_id' }
      );
    },
    [user, supabase]
  );

  /**
   * Get unread post count for the team
   */
  const getUnreadCount = useCallback(async (): Promise<number> => {
    if (!user || !currentTeam) return 0;

    // Get all post IDs for the team
    const { data: posts } = await supabase
      .from('posts')
      .select('id')
      .eq('team_id', currentTeam.id);

    if (!posts || posts.length === 0) return 0;

    const postIds = posts.map((p) => p.id);

    // Get viewed post IDs
    const { data: views } = await supabase
      .from('post_views')
      .select('post_id')
      .eq('user_id', user.id)
      .in('post_id', postIds);

    const viewedIds = new Set(views?.map((v) => v.post_id) || []);
    return postIds.filter((id) => !viewedIds.has(id)).length;
  }, [user, currentTeam, supabase]);

  return {
    isLoading,
    getPosts,
    getPost,
    createPost,
    updatePost,
    deletePost,
    togglePin,
    uploadAttachment,
    deleteAttachment,
    addReaction,
    getReactionSummary,
    addComment,
    updateComment,
    deleteComment,
    markAsViewed,
    getUnreadCount,
  };
}
