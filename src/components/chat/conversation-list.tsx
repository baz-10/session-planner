'use client';

import { useState, useEffect } from 'react';
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

  const loadConversations = async () => {
    const data = await getConversations();
    setConversations(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadConversations();

    // Subscribe to updates
    const unsubscribe = subscribeToConversations(() => {
      loadConversations();
    });

    return unsubscribe;
  }, []);

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No conversations yet</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => onSelectConversation(conv)}
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
