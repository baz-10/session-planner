'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { usePosts } from '@/hooks/use-posts';
import { useAuth } from '@/contexts/auth-context';
import type { Comment, Profile } from '@/types/database';

interface CommentWithAuthor extends Comment {
  author: Profile;
}

interface CommentSectionProps {
  postId: string;
  comments: CommentWithAuthor[];
  onUpdate: () => void;
}

export function CommentSection({ postId, comments, onUpdate }: CommentSectionProps) {
  const { user, teamMemberships, currentTeam } = useAuth();
  const teamMembership = teamMemberships.find(m => m.team.id === currentTeam?.id);
  const { addComment, deleteComment } = usePosts();
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdminOrCoach = teamMembership?.role === 'admin' || teamMembership?.role === 'coach';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const result = await addComment(postId, newComment.trim());
    if (result.success) {
      setNewComment('');
      onUpdate();
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    await deleteComment(commentId);
    onUpdate();
  };

  return (
    <div className="border-t border-gray-100">
      {/* Comments list */}
      <div className="max-h-80 overflow-y-auto">
        {comments.map((comment) => (
          <div key={comment.id} className="px-4 py-3 flex gap-3 hover:bg-gray-50">
            <div className="w-8 h-8 rounded-full bg-gray-300 text-white flex items-center justify-center text-sm font-medium flex-shrink-0">
              {comment.author.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-sm text-gray-900">
                  {comment.author.full_name || 'Unknown'}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
            </div>
            {(user?.id === comment.author_id || isAdminOrCoach) && (
              <button
                onClick={() => handleDelete(comment.id)}
                className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="p-4 flex gap-2 border-t border-gray-100">
        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium flex-shrink-0">
          {user?.user_metadata?.full_name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 px-3 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="px-4 py-2 bg-primary text-white rounded-full text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? '...' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  );
}
