'use client';

import { PostFeed } from '@/components/feed';

export default function FeedPage() {
  return (
    <div className="p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-navy mb-2">Team Feed</h1>
          <p className="text-text-secondary">Stay updated with your team</p>
        </div>

        <PostFeed />
      </div>
    </div>
  );
}
