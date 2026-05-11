'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ShieldCheck, Users } from 'lucide-react';
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
  sender: Profile | null;
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
  const [loadError, setLoadError] = useState('');
  const [readStatusError, setReadStatusError] = useState('');

  const getConversationName = () => {
    if (conversation.name) return conversation.name;

    // For DMs, show the other person's name
    if (conversation.type === 'direct') {
      const otherParticipant = conversation.participants.find((p) => p.user_id !== user?.id);
      return otherParticipant?.user?.full_name || 'Unknown';
    }

    return 'Conversation';
  };

  const markConversationRead = useCallback(async () => {
    const result = await markAsRead(conversation.id);
    setReadStatusError(result.success ? '' : result.error || 'Read status could not update.');
  }, [conversation.id, markAsRead]);

  const loadMessages = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }

    try {
      setLoadError('');
      const data = await getMessages(conversation.id, 50, undefined, { throwOnError: true });
      setMessages(data);

      // Mark as read after a successful load.
      await markConversationRead();
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Messages could not load. Check your connection and try again.'
      );
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [conversation.id, getMessages, markConversationRead]);

  useEffect(() => {
    loadMessages();

    // Subscribe to new messages
    const unsubscribe = subscribeToMessages(conversation.id, (newMessage) => {
      setMessages((prev) => (
        prev.some((message) => message.id === newMessage.id) ? prev : [...prev, newMessage]
      ));
      void markConversationRead();
    });

    return unsubscribe;
  }, [conversation.id, loadMessages, subscribeToMessages, markConversationRead]);

  const handleSendMessage = async (content: string) => {
    const result = await sendMessage({ conversation_id: conversation.id, content });
    if (result.success) {
      await loadMessages(false);
    }
    return result;
  };

  const handleSendFile = async (file: File) => {
    const result = await sendFileMessage(conversation.id, file);
    if (result.success) {
      await loadMessages(false);
    }
    return result;
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-1 text-gray-500 hover:text-gray-700 rounded md:hidden"
            aria-label="Back to conversations"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
        )}

        {/* Avatar */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
          conversation.type === 'direct' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
        }`}>
          {conversation.type === 'team' && <Users className="h-5 w-5" aria-hidden="true" />}
          {conversation.type === 'coaches' && <ShieldCheck className="h-5 w-5" aria-hidden="true" />}
          {conversation.type === 'group' && <Users className="h-5 w-5" aria-hidden="true" />}
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

      </div>

      {/* Messages */}
      {loadError ? (
        <div className="flex flex-1 items-center justify-center bg-background px-6 text-center">
          <div>
            <p role="alert" className="text-sm font-semibold text-red-600">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadMessages()}
              className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        </div>
      ) : (
        <>
          {readStatusError && (
            <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
              {readStatusError}
            </div>
          )}
          <MessageList messages={messages} isLoading={isLoading} />
        </>
      )}

      {/* Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onSendFile={handleSendFile}
        disabled={Boolean(loadError)}
      />
    </div>
  );
}
