'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePosts } from '@/hooks/use-posts';
import { useAuth } from '@/contexts/auth-context';
import { PostCard } from './post-card';
import { CreatePostForm } from './create-post-form';
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

export function PostFeed() {
  const { currentTeam, teamMemberships } = useAuth();
  const teamMembership = teamMemberships.find(m => m.team.id === currentTeam?.id);
  const { getPosts } = usePosts();
  const [posts, setPosts] = useState<PostWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const canPost =
    teamMembership?.role === 'admin' ||
    teamMembership?.role === 'coach' ||
    (teamMembership?.role === 'player' && currentTeam?.settings?.allow_player_posts) ||
    (teamMembership?.role === 'parent' && currentTeam?.settings?.allow_parent_posts);

  const loadPosts = useCallback(async (nextOffset = 0, reset = false) => {
    if (!currentTeam) return;

    setIsLoading(true);
    setLoadError('');

    const result = await getPosts(LIMIT, nextOffset);
    const data = result.posts;

    if (reset) {
      setPosts(data);
    } else {
      setPosts((prev) => [...prev, ...data]);
    }

    setHasMore(data.length === LIMIT);
    setOffset(nextOffset + data.length);
    if (!result.success) {
      setLoadError(result.error);
    }
    setIsLoading(false);
  }, [currentTeam, getPosts]);

  useEffect(() => {
    void loadPosts(0, true);
  }, [currentTeam?.id, loadPosts]);

  const handleRefresh = () => {
    void loadPosts(0, true);
  };

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      void loadPosts(offset, false);
    }
  };

  if (!currentTeam) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Select a team to view the feed</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create post form */}
      {canPost && <CreatePostForm onSuccess={handleRefresh} />}

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={handleRefresh}
            className="mt-3 rounded-md bg-white px-3 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {/* Posts list */}
      {posts.length === 0 && !isLoading && !loadError ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-6xl mb-4">📢</div>
          <h2 className="text-xl font-semibold mb-2">No Posts Yet</h2>
          <p className="text-gray-600">
            {canPost
              ? 'Be the first to share something with your team!'
              : 'There are no posts to show yet.'}
          </p>
        </div>
      ) : posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onUpdate={handleRefresh} />
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center py-4">
              <button
                onClick={handleLoadMore}
                disabled={isLoading}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Loading state */}
      {isLoading && posts.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
}
