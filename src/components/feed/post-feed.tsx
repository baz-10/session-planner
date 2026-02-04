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
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 20;

  const canPost =
    teamMembership?.role === 'admin' ||
    teamMembership?.role === 'coach' ||
    (teamMembership?.role === 'player' && currentTeam?.settings?.allow_player_posts) ||
    (teamMembership?.role === 'parent' && currentTeam?.settings?.allow_parent_posts);

  const loadPosts = useCallback(async (reset = false) => {
    if (!currentTeam) return;

    const newOffset = reset ? 0 : offset;
    setIsLoading(true);

    const data = await getPosts(LIMIT, newOffset);

    if (reset) {
      setPosts(data);
    } else {
      setPosts((prev) => [...prev, ...data]);
    }

    setHasMore(data.length === LIMIT);
    setOffset(newOffset + data.length);
    setIsLoading(false);
  }, [currentTeam, getPosts, offset]);

  useEffect(() => {
    loadPosts(true);
  }, [currentTeam?.id]);

  const handleRefresh = () => {
    setOffset(0);
    loadPosts(true);
  };

  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      loadPosts(false);
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

      {/* Posts list */}
      {posts.length === 0 && !isLoading ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <div className="text-6xl mb-4">📢</div>
          <h2 className="text-xl font-semibold mb-2">No Posts Yet</h2>
          <p className="text-gray-600">
            {canPost
              ? 'Be the first to share something with your team!'
              : 'There are no posts to show yet.'}
          </p>
        </div>
      ) : (
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
      )}

      {/* Loading state */}
      {isLoading && posts.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
    </div>
  );
}
