'use client';

import { useCallback, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';
import {
  POST_ATTACHMENT_EXTENSIONS,
  POST_ATTACHMENT_MIME_TYPES,
  getSafeFileExtension,
  isSafeImageFile,
  isSafeVideoFile,
  isTrustedAttachmentFile,
} from '@/lib/utils/attachments';
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

export const MAX_POST_ATTACHMENTS = 5;
export const MAX_POST_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const POST_ATTACHMENT_BUCKET = 'attachments';
const STALE_POST_ERROR = 'This post could not be updated. It may have been removed or your access may have changed.';
const STALE_COMMENT_ERROR =
  'This comment could not be updated. It may have been removed or your access may have changed.';

type GetPostsResult =
  | { success: true; posts: PostWithDetails[] }
  | { success: false; posts: PostWithDetails[]; error: string };

function validatePostAttachment(file: File): string | null {
  if (file.size > MAX_POST_ATTACHMENT_BYTES) {
    return `${file.name} is larger than 25 MB.`;
  }

  if (!isTrustedAttachmentFile(file, POST_ATTACHMENT_MIME_TYPES, POST_ATTACHMENT_EXTENSIONS)) {
    return `${file.name} is not a supported attachment type.`;
  }

  return null;
}

function createPostAttachmentObjectName(fileExtension: string) {
  const uniqueId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return `${uniqueId}.${fileExtension}`;
}

export function usePosts() {
  const { user, currentTeam } = useAuth();
  const supabase = getBrowserSupabaseClient();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Get all posts for the current team
   */
  const getPosts = useCallback(
    async (limit = 20, offset = 0): Promise<GetPostsResult> => {
      if (!currentTeam || !user) {
        return { success: false, posts: [], error: 'Select a team to view the feed.' };
      }

      const { data: posts, error } = await supabase
        .from('posts')
        .select(`
          *,
          author:profiles!author_id(id, email, full_name, avatar_url),
          attachments:post_attachments(*),
          reactions(*, user:profiles!user_id(id, email, full_name, avatar_url)),
          comments(*, author:profiles!author_id(id, email, full_name, avatar_url))
        `)
        .eq('team_id', currentTeam.id)
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching posts:', error);
        return { success: false, posts: [], error: 'Failed to load team feed.' };
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

      const postsWithDetails = posts.map((post) => ({
        ...post,
        view_count: viewCounts.get(post.id) || 0,
        has_viewed: hasViewed.get(post.id) || false,
      })) as PostWithDetails[];

      return { success: true, posts: postsWithDetails };
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
          author:profiles!author_id(id, email, full_name, avatar_url),
          attachments:post_attachments(*),
          reactions(*, user:profiles!user_id(id, email, full_name, avatar_url)),
          comments(*, author:profiles!author_id(id, email, full_name, avatar_url))
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
   * Upload an attachment to a post
   */
  const uploadAttachment = useCallback(
    async (
      postId: string,
      file: File
    ): Promise<{ success: boolean; attachment?: PostAttachment; storagePath?: string; error?: string }> => {
      if (!user || !currentTeam) {
        return { success: false, error: 'Not authenticated' };
      }

      const fileExt = getSafeFileExtension(file, POST_ATTACHMENT_EXTENSIONS);
      const filePath = `${currentTeam.id}/posts/${postId}/${createPostAttachmentObjectName(fileExt)}`;

      const { error: uploadError } = await supabase.storage
        .from(POST_ATTACHMENT_BUCKET)
        .upload(filePath, file);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        return { success: false, error: 'Failed to upload file' };
      }

      const { data: publicUrl } = supabase.storage
        .from(POST_ATTACHMENT_BUCKET)
        .getPublicUrl(filePath);

      // Determine attachment type
      let attachmentType: AttachmentType = 'document';
      if (isSafeImageFile(file)) attachmentType = 'image';
      else if (isSafeVideoFile(file)) attachmentType = 'video';

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
        const { error: cleanupError } = await supabase.storage
          .from(POST_ATTACHMENT_BUCKET)
          .remove([filePath]);

        if (cleanupError) {
          console.error('Error cleaning up failed post attachment upload:', cleanupError);
        }

        return { success: false, error: 'Failed to save attachment record' };
      }

      return { success: true, attachment: attachment as PostAttachment, storagePath: filePath };
    },
    [user, currentTeam, supabase]
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

      try {
        if (attachmentFiles && attachmentFiles.length > MAX_POST_ATTACHMENTS) {
          return {
            success: false,
            error: `Attach up to ${MAX_POST_ATTACHMENTS} files per post.`,
          };
        }

        for (const file of attachmentFiles || []) {
          const validationError = validatePostAttachment(file);
          if (validationError) {
            return { success: false, error: validationError };
          }
        }

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
          console.error('Error creating post:', error);
          return { success: false, error: 'Failed to create post' };
        }

        const uploadedAttachmentPaths: string[] = [];

        for (const file of attachmentFiles || []) {
          const result = await uploadAttachment(post.id, file);
          if (!result.success) {
            if (uploadedAttachmentPaths.length > 0) {
              const { error: cleanupError } = await supabase.storage
                .from(POST_ATTACHMENT_BUCKET)
                .remove(uploadedAttachmentPaths);

              if (cleanupError) {
                console.error('Error cleaning up post attachments after failed post create:', cleanupError);
              }
            }

            await supabase.from('posts').delete().eq('id', post.id);
            return {
              success: false,
              error: result.error || 'Failed to upload one or more attachments.',
            };
          }

          if (result.storagePath) {
            uploadedAttachmentPaths.push(result.storagePath);
          }
        }

        return { success: true, post: post as Post };
      } finally {
        setIsLoading(false);
      }
    },
    [user, currentTeam, supabase, uploadAttachment]
  );

  /**
   * Update a post
   */
  const updatePost = useCallback(
    async (
      postId: string,
      content: string
    ): Promise<{ success: boolean; error?: string }> => {
      const { error, count } = await supabase
        .from('posts')
        .update({ content }, { count: 'exact' })
        .eq('id', postId);

      if (error) {
        console.error('Error updating post:', error);
        return { success: false, error: 'Failed to update post' };
      }

      if (count === 0) {
        return { success: false, error: STALE_POST_ERROR };
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
      const { error, count } = await supabase
        .from('posts')
        .delete({ count: 'exact' })
        .eq('id', postId);

      if (error) {
        console.error('Error deleting post:', error);
        return { success: false, error: 'Failed to delete post' };
      }

      if (count === 0) {
        return { success: false, error: STALE_POST_ERROR };
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
      const { error, count } = await supabase
        .from('posts')
        .update({
          pinned,
          pinned_at: pinned ? new Date().toISOString() : null,
        }, { count: 'exact' })
        .eq('id', postId);

      if (error) {
        console.error('Error toggling pin:', error);
        return { success: false, error: 'Failed to toggle pin' };
      }

      if (count === 0) {
        return { success: false, error: STALE_POST_ERROR };
      }

      return { success: true };
    },
    [supabase]
  );

  /**
   * Delete an attachment
   */
  const deleteAttachment = useCallback(
    async (attachmentId: string): Promise<{ success: boolean; error?: string }> => {
      const { error, count } = await supabase
        .from('post_attachments')
        .delete({ count: 'exact' })
        .eq('id', attachmentId);

      if (error) {
        console.error('Error deleting attachment:', error);
        return { success: false, error: 'Failed to delete attachment' };
      }

      if (count === 0) {
        return { success: false, error: 'This attachment could not be deleted. Refresh and try again.' };
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
      const { error, count } = await supabase
        .from('comments')
        .update({ content }, { count: 'exact' })
        .eq('id', commentId);

      if (error) {
        console.error('Error updating comment:', error);
        return { success: false, error: 'Failed to update comment' };
      }

      if (count === 0) {
        return { success: false, error: STALE_COMMENT_ERROR };
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
      const { error, count } = await supabase
        .from('comments')
        .delete({ count: 'exact' })
        .eq('id', commentId);

      if (error) {
        console.error('Error deleting comment:', error);
        return { success: false, error: 'Failed to delete comment' };
      }

      if (count === 0) {
        return { success: false, error: STALE_COMMENT_ERROR };
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
