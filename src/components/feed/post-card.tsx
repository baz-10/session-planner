'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { usePosts } from '@/hooks/use-posts';
import { useAuth } from '@/contexts/auth-context';
import { useConfirmDialog } from '@/components/ui';
import { CommentSection } from './comment-section';
import { ReactionPicker } from './reaction-picker';
import { AttachmentGallery } from './attachment-gallery';
import type { Post, Profile, PostAttachment, Reaction, Comment } from '@/types/database';

interface ReactionWithUser extends Reaction {
  user: Profile;
}

interface CommentWithAuthor extends Comment {
  author: Profile;
}

interface PostWithDetails extends Post {
  author: Profile;
  attachments: PostAttachment[];
  reactions: ReactionWithUser[];
  comments: CommentWithAuthor[];
  view_count: number;
  has_viewed: boolean;
}

interface PostCardProps {
  post: PostWithDetails;
  onUpdate: () => void;
}

type PostAction = 'delete' | 'pin' | 'reaction';

export function PostCard({ post, onUpdate }: PostCardProps) {
  const { user, teamMemberships, currentTeam } = useAuth();
  const teamMembership = teamMemberships.find(m => m.team.id === currentTeam?.id);
  const { deletePost, togglePin, addReaction, getReactionSummary, markAsViewed } = usePosts();
  const [showComments, setShowComments] = useState(false);
  const [activeAction, setActiveAction] = useState<PostAction | null>(null);
  const [actionError, setActionError] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const { confirmAction, confirmDialog } = useConfirmDialog();

  const isAuthor = user?.id === post.author_id;
  const isAdminOrCoach = teamMembership?.role === 'admin' || teamMembership?.role === 'coach';
  const canEdit = isAuthor;
  const canDelete = isAuthor || isAdminOrCoach;
  const canPin = isAdminOrCoach;
  const actionInFlight = activeAction !== null;

  const reactionSummary = getReactionSummary(post.reactions);

  const handleDelete = async () => {
    if (actionInFlight) return;

    const confirmed = await confirmAction({
      title: 'Delete post?',
      description: 'This post and its comments will be removed from the team feed.',
      confirmLabel: 'Delete post',
      confirmVariant: 'destructive',
    });

    if (!confirmed) return;

    setActiveAction('delete');
    setActionError('');
    try {
      const result = await deletePost(post.id);
      if (!result.success) {
        setActionError(result.error || 'Failed to delete post.');
        return;
      }
      setShowMenu(false);
      onUpdate();
    } catch (error) {
      console.error('Unexpected error deleting post:', error);
      setActionError('Failed to delete post. Check your connection and try again.');
    } finally {
      setActiveAction(null);
    }
  };

  const handleTogglePin = async () => {
    if (actionInFlight) return;

    setActiveAction('pin');
    setActionError('');
    try {
      const result = await togglePin(post.id, !post.pinned);
      if (!result.success) {
        setActionError(result.error || 'Failed to update pinned state.');
        setShowMenu(false);
        return;
      }
      onUpdate();
      setShowMenu(false);
    } catch (error) {
      console.error('Unexpected error updating post pin:', error);
      setActionError('Failed to update pinned state. Check your connection and try again.');
      setShowMenu(false);
    } finally {
      setActiveAction(null);
    }
  };

  const handleReaction = async (emoji: string) => {
    if (actionInFlight) return;

    setActiveAction('reaction');
    setActionError('');
    try {
      const result = await addReaction(post.id, emoji);
      if (!result.success) {
        setActionError(result.error || 'Failed to update reaction.');
        return;
      }
      onUpdate();
    } catch (error) {
      console.error('Unexpected error updating post reaction:', error);
      setActionError('Failed to update reaction. Check your connection and try again.');
    } finally {
      setActiveAction(null);
    }
  };

  // Mark as viewed when card becomes visible
  useEffect(() => {
    if (!post.has_viewed) {
      void markAsViewed(post.id).catch((error) => {
        console.error('Unexpected error marking post as viewed:', error);
      });
    }
  }, [markAsViewed, post.has_viewed, post.id]);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Pinned indicator */}
      {post.pinned && (
        <div className="bg-amber-50 px-4 py-2 border-b border-amber-100 flex items-center gap-2 text-amber-700 text-sm">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.617 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.018 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.583l1.715 5.35a1 1 0 01-.285 1.049A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.018 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.79l1.599.8L9 4.323V3a1 1 0 011-1z" />
          </svg>
          <span>Pinned Post</span>
        </div>
      )}

      {/* Header */}
      <div className="p-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-semibold">
            {post.author.full_name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div>
            <div className="font-medium text-gray-900">
              {post.author.full_name || 'Unknown User'}
            </div>
            <div className="text-sm text-gray-500">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </div>
          </div>
        </div>

        {/* Menu */}
        {(canEdit || canDelete || canPin) && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              disabled={actionInFlight}
              aria-busy={actionInFlight}
              className="p-1 text-gray-400 hover:text-gray-600 rounded disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Open post actions"
              aria-expanded={showMenu}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-1">
                  {canPin && (
                    <button
                      type="button"
                      onClick={handleTogglePin}
                      disabled={actionInFlight}
                      aria-busy={activeAction === 'pin'}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      {activeAction === 'pin' ? 'Saving...' : post.pinned ? 'Unpin' : 'Pin to top'}
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={actionInFlight}
                      aria-busy={activeAction === 'delete'}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {activeAction === 'delete' ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-3">
        <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>
      </div>

      {actionError && (
        <div className="mx-4 mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {actionError}
        </div>
      )}

      {/* Attachments */}
      {post.attachments.length > 0 && (
        <AttachmentGallery attachments={post.attachments} />
      )}

      {/* Stats bar */}
      <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-4">
          {reactionSummary.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="flex -space-x-1">
                {reactionSummary.slice(0, 3).map((r) => (
                  <span key={r.emoji} className="text-base">
                    {r.emoji}
                  </span>
                ))}
              </span>
              <span>{post.reactions.length}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          {post.comments.length > 0 && (
            <button
              type="button"
              onClick={() => setShowComments(!showComments)}
              className="hover:text-primary"
              aria-expanded={showComments}
              aria-label={`${showComments ? 'Hide' : 'Show'} ${post.comments.length} comment${post.comments.length !== 1 ? 's' : ''}`}
            >
              {post.comments.length} comment{post.comments.length !== 1 ? 's' : ''}
            </button>
          )}
          <span>{post.view_count} view{post.view_count !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Action bar */}
      <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-2">
        <ReactionPicker
          reactions={reactionSummary}
          onReact={handleReaction}
          disabled={actionInFlight}
        />
        <button
          type="button"
          onClick={() => setShowComments(!showComments)}
          className="flex-1 flex items-center justify-center gap-2 py-2 text-gray-600 hover:bg-gray-50 rounded-md"
          aria-expanded={showComments}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Comment
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <CommentSection
          postId={post.id}
          comments={post.comments}
          onUpdate={onUpdate}
        />
      )}
      {confirmDialog}
    </div>
  );
}
