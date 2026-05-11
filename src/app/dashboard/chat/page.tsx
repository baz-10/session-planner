'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, Plus, ShieldCheck, Users } from 'lucide-react';
import { useChat } from '@/hooks/use-chat';
import { useAuth } from '@/contexts/auth-context';
import { ConversationList, ChatView, NewChatModal } from '@/components/chat';
import type { Conversation, Message, Profile, ConversationParticipant } from '@/types/database';

interface ParticipantWithProfile extends ConversationParticipant {
  user: Profile | null;
}

interface ConversationWithDetails extends Conversation {
  participants: ParticipantWithProfile[];
  last_message: Message | null;
  unread_count: number;
}

export default function ChatPage() {
  const { currentTeam, teamMemberships } = useAuth();
  const { getTeamChat, getConversations } = useChat();
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [quickChatError, setQuickChatError] = useState('');
  const [openingQuickChat, setOpeningQuickChat] = useState<'team' | 'coaches' | null>(null);
  const currentMembership = teamMemberships.find((membership) => membership.team.id === currentTeam?.id);
  const canUseCoachesChat = currentMembership?.role === 'coach' || currentMembership?.role === 'admin';

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setSelectedConversation(null);
    setShowNewChat(false);
    setQuickChatError('');
    setOpeningQuickChat(null);
  }, [currentTeam?.id]);

  const handleSelectConversation = (conversation: ConversationWithDetails) => {
    setQuickChatError('');
    setSelectedConversation(conversation);
  };

  const handleNewConversationCreated = async (conversationId: string) => {
    setQuickChatError('');

    try {
      // Refresh conversations and select the new one
      const conversations = await getConversations({ throwOnError: true });
      const newConv = conversations.find((c) => c.id === conversationId);
      if (newConv) {
        setSelectedConversation(newConv);
      } else {
        setQuickChatError('Conversation was created but is not visible yet. Refresh messages and try again.');
      }
      setShowNewChat(false);
    } catch (error) {
      console.error('Error selecting new conversation:', error);
      setQuickChatError(
        error instanceof Error
          ? error.message
          : 'Conversation was created, but messages could not refresh. Try again.'
      );
      setShowNewChat(false);
    }
  };

  const handleBack = () => {
    setSelectedConversation(null);
  };

  const openTeamConversation = async (type: 'team' | 'coaches') => {
    if (openingQuickChat) return;

    setQuickChatError('');
    setOpeningQuickChat(type);
    try {
      const result = await getTeamChat(type);
      if (!result.success || !result.conversation) {
        setQuickChatError(result.error || 'Team chat could not be opened. Refresh and try again.');
        return;
      }

      const conversations = await getConversations({ throwOnError: true });
      const conversation = conversations.find((item) => item.id === result.conversation?.id);
      if (conversation) {
        setSelectedConversation(conversation);
      } else {
        setQuickChatError('Team chat was created but is not visible yet. Refresh messages and try again.');
      }
    } catch (error) {
      console.error('Error selecting team chat:', error);
      setQuickChatError(
        error instanceof Error
          ? error.message
          : 'Team chat was opened, but messages could not refresh. Try again.'
      );
    } finally {
      setOpeningQuickChat(null);
    }
  };

  if (!currentTeam) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 text-text-muted">
            <Users className="h-full w-full" aria-hidden="true" />
          </div>
          <p className="text-text-secondary">Select a team to view messages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-96px)] min-h-[560px] md:h-[calc(100vh-64px)]">
      {/* Conversation list - hidden on mobile when chat is open */}
      <div
        className={`${
          isMobileView && selectedConversation ? 'hidden' : 'w-full md:w-80'
        } border-r border-border bg-white flex flex-col`}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h1 className="text-xl font-bold text-navy">Messages</h1>
          <button
            type="button"
            onClick={() => setShowNewChat(true)}
            className="p-2 text-teal hover:bg-teal-glow rounded-full transition-colors"
            aria-label="Start a new conversation"
            title="New conversation"
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        {/* Quick access - Team chats */}
        <div className="space-y-1 p-2 border-b border-border">
          {quickChatError && (
            <div role="alert" className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {quickChatError}
            </div>
          )}
          <button
            type="button"
            onClick={() => openTeamConversation('team')}
            disabled={openingQuickChat !== null}
            aria-busy={openingQuickChat === 'team'}
            className="w-full flex items-center gap-3 p-3 hover:bg-whisper rounded-lg transition-colors disabled:cursor-wait disabled:opacity-60"
          >
            <div className="w-10 h-10 rounded-full bg-teal-glow text-teal flex items-center justify-center">
              <Users className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="text-left">
              <div className="font-medium text-navy">Team Chat</div>
              <div className="text-sm text-text-secondary">
                {openingQuickChat === 'team' ? 'Opening...' : 'Message everyone'}
              </div>
            </div>
          </button>
          {canUseCoachesChat && (
            <button
              type="button"
              onClick={() => openTeamConversation('coaches')}
              disabled={openingQuickChat !== null}
              aria-busy={openingQuickChat === 'coaches'}
              className="w-full flex items-center gap-3 p-3 hover:bg-whisper rounded-lg transition-colors disabled:cursor-wait disabled:opacity-60"
            >
              <div className="w-10 h-10 rounded-full bg-navy/10 text-navy flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="text-left">
                <div className="font-medium text-navy">Coaches Chat</div>
                <div className="text-sm text-text-secondary">
                  {openingQuickChat === 'coaches' ? 'Opening...' : 'Coach/admin thread'}
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          <ConversationList
            onSelectConversation={handleSelectConversation}
            selectedId={selectedConversation?.id}
          />
        </div>
      </div>

      {/* Chat view */}
      <div
        className={`${
          isMobileView && !selectedConversation ? 'hidden' : 'flex-1'
        } flex flex-col`}
      >
        {selectedConversation ? (
          <ChatView
            conversation={selectedConversation}
            onBack={isMobileView ? handleBack : undefined}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-background">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 text-text-muted">
                <MessageCircle className="h-full w-full" aria-hidden="true" />
              </div>
              <p className="text-navy font-medium mb-1">No conversation selected</p>
              <p className="text-text-secondary text-sm">Choose a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* New chat modal */}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onConversationCreated={handleNewConversationCreated}
        />
      )}
    </div>
  );
}
