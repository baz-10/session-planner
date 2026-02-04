'use client';

import { useState, useEffect, useCallback } from 'react';
import { useChat } from '@/hooks/use-chat';
import { useAuth } from '@/contexts/auth-context';
import { MessageList } from './message-list';
import { MessageInput } from './message-input';
import type { Conversation, Message, Profile, ConversationParticipant } from '@/types/database';

interface ParticipantWithProfile extends ConversationParticipant {
  user: Profile;
}

interface ConversationWithDetails extends Conversation {
  participants: ParticipantWithProfile[];
  last_message: Message | null;
  unread_count: number;
}

interface MessageWithSender extends Message {
  sender: Profile;
}

interface ChatViewProps {
  conversation: ConversationWithDetails;
  onBack?: () => void;
}

export function ChatView({ conversation, onBack }: ChatViewProps) {
  const { user } = useAuth();
  const { getMessages, sendMessage, sendFileMessage, markAsRead, subscribeToMessages } = useChat();
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const getConversationName = () => {
    if (conversation.name) return conversation.name;

    // For DMs, show the other person's name
    if (conversation.type === 'direct') {
      const otherParticipant = conversation.participants.find((p) => p.user_id !== user?.id);
      return otherParticipant?.user?.full_name || 'Unknown';
    }

    return 'Conversation';
  };

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    const data = await getMessages(conversation.id);
    setMessages(data);
    setIsLoading(false);

    // Mark as read
    markAsRead(conversation.id);
  }, [conversation.id, getMessages, markAsRead]);

  useEffect(() => {
    loadMessages();

    // Subscribe to new messages
    const unsubscribe = subscribeToMessages(conversation.id, (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
      markAsRead(conversation.id);
    });

    return unsubscribe;
  }, [conversation.id, loadMessages, subscribeToMessages, markAsRead]);

  const handleSendMessage = async (content: string) => {
    await sendMessage({ conversation_id: conversation.id, content });
  };

  const handleSendFile = async (file: File) => {
    await sendFileMessage(conversation.id, file);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="p-1 text-gray-500 hover:text-gray-700 rounded md:hidden"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Avatar */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
          conversation.type === 'direct' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
        }`}>
          {conversation.type === 'team' && '👥'}
          {conversation.type === 'coaches' && '🏀'}
          {conversation.type === 'group' && '👥'}
          {conversation.type === 'direct' && (() => {
            const otherParticipant = conversation.participants.find((p) => p.user_id !== user?.id);
            return otherParticipant?.user?.full_name?.charAt(0)?.toUpperCase() || 'U';
          })()}
        </div>

        <div className="flex-1">
          <h2 className="font-semibold text-gray-900">{getConversationName()}</h2>
          {conversation.type !== 'direct' && (
            <p className="text-sm text-gray-500">
              {conversation.participants.length} members
            </p>
          )}
        </div>

        {/* Menu button */}
        <button className="p-2 text-gray-400 hover:text-gray-600 rounded">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <MessageList messages={messages} isLoading={isLoading} />

      {/* Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onSendFile={handleSendFile}
      />
    </div>
  );
}
