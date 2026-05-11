'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useChat } from '@/hooks/use-chat';
import { useAuth } from '@/contexts/auth-context';
import type { Conversation, Message, Profile, ConversationParticipant } from '@/types/database';

interface ParticipantWithProfile extends ConversationParticipant {
  user: Profile;
}

interface ConversationWithDetails extends Conversation {
  participants: ParticipantWithProfile[];
  last_message: Message | null;
  unread_count: number;
}

interface ConversationListProps {
  onSelectConversation: (conversation: ConversationWithDetails) => void;
  selectedId?: string;
}

export function ConversationList({ onSelectConversation, selectedId }: ConversationListProps) {
  const { user } = useAuth();
  const { getConversations, subscribeToConversations } = useChat();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const conversationIdKey = useMemo(
    () => conversations.map((conversation) => conversation.id).sort().join('|'),
    [conversations]
  );

  const loadConversations = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    setLoadError('');

    try {
      const data = await getConversations({ throwOnError: true });
      setConversations(data);
    } catch (error) {
      console.error('Error loading conversations:', error);
      setConversations([]);
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Conversations could not load. Check your connection and try again.'
      );
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [getConversations]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const conversationIds = conversationIdKey ? conversationIdKey.split('|') : [];
    const unsubscribe = subscribeToConversations(() => {
      loadConversations(false);
    }, conversationIds);

    return unsubscribe;
  }, [conversationIdKey, loadConversations, subscribeToConversations]);

  const getConversationName = (conv: ConversationWithDetails) => {
    if (conv.name) return conv.name;

    // For DMs, show the other person's name
    if (conv.type === 'direct') {
      const otherParticipant = conv.participants.find((p) => p.user_id !== user?.id);
      return otherParticipant?.user?.full_name || 'Unknown';
    }

    return 'Conversation';
  };

  const getConversationAvatar = (conv: ConversationWithDetails) => {
    if (conv.type === 'team') return '👥';
    if (conv.type === 'coaches') return '🏀';
    if (conv.type === 'group') return '👥';

    // For DMs, show the other person's initial
    if (conv.type === 'direct') {
      const otherParticipant = conv.participants.find((p) => p.user_id !== user?.id);
      return otherParticipant?.user?.full_name?.charAt(0)?.toUpperCase() || 'U';
    }

    return '💬';
  };

  const getLastMessagePreview = (message: Message | null) => {
    if (!message) return 'No messages yet';
    if (message.type === 'image') return '📷 Image';
    if (message.type === 'file') return '📎 File';
    return message.content || '';
  };

  const getConversationActionLabel = (conv: ConversationWithDetails) => {
    const name = getConversationName(conv);
    const unreadText = conv.unread_count > 0
      ? `, ${conv.unread_count} unread message${conv.unread_count === 1 ? '' : 's'}`
      : '';
    const preview = getLastMessagePreview(conv.last_message);
    return `Open ${name}${unreadText}. Last message: ${preview}`;
  };

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center" role="status" aria-label="Loading conversations">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" aria-hidden="true"></div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {loadError ? (
          <>
            <p role="alert" className="px-4 text-sm font-medium text-red-600">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadConversations()}
              className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              Try again
            </button>
          </>
        ) : (
          <p>No conversations yet</p>
        )}
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          type="button"
          onClick={() => onSelectConversation(conv)}
          aria-label={getConversationActionLabel(conv)}
          aria-current={selectedId === conv.id ? 'true' : undefined}
          className={`w-full flex items-center gap-3 p-4 hover:bg-gray-50 text-left ${
            selectedId === conv.id ? 'bg-primary/5' : ''
          }`}
        >
          {/* Avatar */}
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold flex-shrink-0 ${
            conv.type === 'direct' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            {getConversationAvatar(conv)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-900 truncate">
                {getConversationName(conv)}
              </span>
              {conv.last_message && (
                <span className="text-xs text-gray-500 flex-shrink-0">
                  {formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: true })}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 truncate">
                {getLastMessagePreview(conv.last_message)}
              </p>
              {conv.unread_count > 0 && (
                <span className="ml-2 w-5 h-5 bg-primary text-white text-xs rounded-full flex items-center justify-center flex-shrink-0">
                  {conv.unread_count > 9 ? '9+' : conv.unread_count}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
