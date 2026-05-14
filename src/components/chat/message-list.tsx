'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { Paperclip } from 'lucide-react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { useAuth } from '@/contexts/auth-context';
import type { Message, Profile } from '@/types/database';

interface MessageWithSender extends Message {
  sender: Profile | null;
}

interface MessageListProps {
  messages: MessageWithSender[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const { user } = useAuth();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const formatMessageTime = (date: Date) => {
    return format(date, 'h:mm a');
  };

  const formatDateSeparator = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMMM d, yyyy');
  };

  const shouldShowDateSeparator = (current: Message, previous?: Message) => {
    if (!previous) return true;
    const currentDate = new Date(current.created_at);
    const previousDate = new Date(previous.created_at);
    return !isSameDay(currentDate, previousDate);
  };

  const shouldShowAvatar = (current: MessageWithSender, next?: MessageWithSender) => {
    if (!next) return true;
    return current.sender_id !== next.sender_id;
  };

  const getAttachmentFallbackLabel = (message: MessageWithSender) => {
    if (message.type === 'image') return 'Image could not load. Open the conversation again to retry.';
    return `${message.metadata?.file_name || 'File'} could not load. Open the conversation again to retry.`;
  };

  const getSenderDisplayName = (message: MessageWithSender) => {
    return message.sender?.full_name || message.sender?.email || 'Team member';
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center" role="status" aria-label="Loading messages">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" aria-hidden="true"></div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-500">
        <p>No messages yet. Start the conversation!</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-1">
      {messages.map((message, index) => {
        const isOwn = message.sender_id === user?.id;
        const showDateSeparator = shouldShowDateSeparator(message, messages[index - 1]);
        const showAvatar = shouldShowAvatar(message, messages[index + 1]);
        const messageDate = new Date(message.created_at);

        return (
          <div key={message.id}>
            {/* Date separator */}
            {showDateSeparator && (
              <div className="flex items-center justify-center my-4">
                <span className="px-3 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
                  {formatDateSeparator(messageDate)}
                </span>
              </div>
            )}

            {/* Message */}
            <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${showAvatar ? 'mb-2' : ''}`}>
              <div className={`flex max-w-[75%] min-w-0 items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                {!isOwn && (
                  <div className={`w-8 h-8 flex-shrink-0 ${showAvatar ? '' : 'invisible'}`}>
                    {showAvatar && (
                      <div className="w-8 h-8 rounded-full bg-gray-300 text-white flex items-center justify-center text-sm font-medium">
                        {getSenderDisplayName(message).charAt(0).toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={`min-w-0 rounded-2xl px-4 py-2 ${
                    isOwn
                      ? 'bg-primary text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                  }`}
                >
                  {/* Sender name (for group chats) */}
                  {!isOwn && showAvatar && (
                    <div className="text-xs font-medium text-primary mb-1">
                      {getSenderDisplayName(message)}
                    </div>
                  )}

                  {/* Content */}
                  {message.type === 'text' && (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  )}

                  {message.type === 'image' && message.metadata?.file_url && (
                    <div className="max-w-xs">
                      <a
                        href={message.metadata.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open shared image"
                      >
                        <Image
                          src={message.metadata.file_url}
                          alt="Shared image"
                          width={320}
                          height={256}
                          className="h-auto max-h-64 w-auto cursor-pointer rounded-lg object-contain"
                          unoptimized
                        />
                      </a>
                    </div>
                  )}

                  {message.type === 'image' && !message.metadata?.file_url && (
                    <p className="text-sm italic" role="status">
                      {getAttachmentFallbackLabel(message)}
                    </p>
                  )}

                  {message.type === 'file' && message.metadata?.file_url && (
                    <a
                      href={message.metadata.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open shared file ${message.metadata.file_name || ''}`.trim()}
                      className={`flex max-w-full min-w-0 items-center gap-2 ${isOwn ? 'text-white' : 'text-primary'}`}
                    >
                      <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 break-words underline">
                        {message.metadata.file_name || 'File'}
                      </span>
                    </a>
                  )}

                  {message.type === 'file' && !message.metadata?.file_url && (
                    <p className="text-sm italic" role="status">
                      {getAttachmentFallbackLabel(message)}
                    </p>
                  )}

                  {message.type === 'system' && (
                    <p className="text-sm italic">{message.content}</p>
                  )}

                  {/* Time */}
                  <div className={`text-xs mt-1 ${isOwn ? 'text-white/70' : 'text-gray-400'}`}>
                    {formatMessageTime(messageDate)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
