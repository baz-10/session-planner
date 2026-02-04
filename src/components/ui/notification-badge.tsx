'use client';

import { useState, useEffect } from 'react';
import { usePosts } from '@/hooks/use-posts';
import { useChat } from '@/hooks/use-chat';

interface NotificationBadgeProps {
  type: 'posts' | 'chat' | 'combined';
  className?: string;
}

export function NotificationBadge({ type, className = '' }: NotificationBadgeProps) {
  const { getUnreadCount: getUnreadPosts } = usePosts();
  const { getTotalUnreadCount: getUnreadMessages } = useChat();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const loadCount = async () => {
      let total = 0;

      if (type === 'posts' || type === 'combined') {
        total += await getUnreadPosts();
      }

      if (type === 'chat' || type === 'combined') {
        total += await getUnreadMessages();
      }

      setCount(total);
    };

    loadCount();

    // Refresh every 30 seconds
    const interval = setInterval(loadCount, 30000);

    return () => clearInterval(interval);
  }, [type, getUnreadPosts, getUnreadMessages]);

  if (count === 0) return null;

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-red-500 rounded-full ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
