'use client';

import { useCallback, useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';
import type {
  Conversation,
  ConversationParticipant,
  Message,
  Profile,
  ChatType,
  MessageType,
  MessageMetadata,
  CreateMessageInput,
} from '@/types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface ConversationWithDetails extends Conversation {
  participants: ParticipantWithProfile[];
  last_message: Message | null;
  unread_count: number;
}

interface ParticipantWithProfile extends ConversationParticipant {
  user: Profile;
}

interface MessageWithSender extends Message {
  sender: Profile;
}

export function useChat() {
  const { user, currentTeam } = useAuth();
  const supabase = getBrowserSupabaseClient();
  const [isLoading, setIsLoading] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  /**
   * Get all conversations for the current user
   */
  const getConversations = useCallback(async (): Promise<ConversationWithDetails[]> => {
    if (!user) return [];

    // Get conversations where user is a participant
    const { data: participations, error: partError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (partError || !participations?.length) {
      return [];
    }

    const conversationIds = participations.map((p: { conversation_id: string }) => p.conversation_id);

    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        *,
        participants:conversation_participants(*, user:profiles!user_id(*))
      `)
      .in('id', conversationIds)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }

    // Get last message and unread count for each conversation
    const result = await Promise.all(
      conversations.map(async (conv) => {
        // Get last message
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Get user's last read timestamp
        const { data: participant } = await supabase
          .from('conversation_participants')
          .select('last_read_at')
          .eq('conversation_id', conv.id)
          .eq('user_id', user.id)
          .single();

        // Count unread messages
        let unreadCount = 0;
        if (participant?.last_read_at) {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .gt('created_at', participant.last_read_at)
            .neq('sender_id', user.id);
          unreadCount = count || 0;
        } else {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user.id);
          unreadCount = count || 0;
        }

        return {
          ...conv,
          last_message: lastMsg || null,
          unread_count: unreadCount,
        };
      })
    );

    return result as ConversationWithDetails[];
  }, [user, supabase]);

  /**
   * Get or create a team chat conversation
   */
  const getTeamChat = useCallback(
    async (type: 'team' | 'coaches' = 'team'): Promise<Conversation | null> => {
      if (!currentTeam || !user) return null;

      // Check if team chat exists
      const { data: existing, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('team_id', currentTeam.id)
        .eq('type', type)
        .single();

      if (existing) return existing as Conversation;

      // Create team chat
      const { data: conv, error: createError } = await supabase
        .from('conversations')
        .insert({
          team_id: currentTeam.id,
          type,
          name: type === 'coaches' ? 'Coaches Chat' : currentTeam.name,
          created_by: user.id,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating team chat:', createError);
        return null;
      }

      // Add current user as participant
      await supabase.from('conversation_participants').insert({
        conversation_id: conv.id,
        user_id: user.id,
      });

      return conv as Conversation;
    },
    [user, currentTeam, supabase]
  );

  /**
   * Get or create a direct message conversation
   */
  const getOrCreateDM = useCallback(
    async (otherUserId: string): Promise<Conversation | null> => {
      if (!user) return null;

      // Try using the database function
      const { data: convId, error } = await supabase.rpc('get_or_create_dm', {
        other_user_id: otherUserId,
      });

      if (error) {
        console.error('Error getting/creating DM:', error);
        return null;
      }

      // Fetch the conversation
      const { data: conv } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', convId)
        .single();

      return conv as Conversation | null;
    },
    [user, supabase]
  );

  /**
   * Create a group conversation
   */
  const createGroupChat = useCallback(
    async (
      name: string,
      participantIds: string[]
    ): Promise<{ success: boolean; conversation?: Conversation; error?: string }> => {
      if (!user || !currentTeam) {
        return { success: false, error: 'Not authenticated' };
      }

      const { data: conv, error } = await supabase
        .from('conversations')
        .insert({
          team_id: currentTeam.id,
          type: 'group' as ChatType,
          name,
          created_by: user.id,
        })
        .select()
        .single();

      if (error || !conv) {
        console.error('Error creating group chat:', error);
        return { success: false, error: 'Failed to create group chat' };
      }

      // Add participants including creator
      const participants = [...new Set([user.id, ...participantIds])].map((id) => ({
        conversation_id: conv.id,
        user_id: id,
      }));

      await supabase.from('conversation_participants').insert(participants);

      return { success: true, conversation: conv as Conversation };
    },
    [user, currentTeam, supabase]
  );

  /**
   * Get messages for a conversation
   */
  const getMessages = useCallback(
    async (conversationId: string, limit = 50, before?: string): Promise<MessageWithSender[]> => {
      let query = supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!sender_id(*)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (before) {
        query = query.lt('created_at', before);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching messages:', error);
        return [];
      }

      return (data || []).reverse() as MessageWithSender[];
    },
    [supabase]
  );

  /**
   * Send a message
   */
  const sendMessage = useCallback(
    async (input: CreateMessageInput): Promise<{ success: boolean; message?: Message; error?: string }> => {
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { data: message, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: input.conversation_id,
          sender_id: user.id,
          content: input.content || null,
          type: input.type || 'text',
          metadata: input.metadata || {},
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        return { success: false, error: 'Failed to send message' };
      }

      // Update conversation updated_at
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', input.conversation_id);

      return { success: true, message: message as Message };
    },
    [user, supabase]
  );

  /**
   * Upload a file and send as message
   */
  const sendFileMessage = useCallback(
    async (
      conversationId: string,
      file: File
    ): Promise<{ success: boolean; message?: Message; error?: string }> => {
      if (!user || !currentTeam) {
        return { success: false, error: 'Not authenticated' };
      }

      const fileExt = file.name.split('.').pop();
      const filePath = `${currentTeam.id}/chat/${conversationId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        return { success: false, error: 'Failed to upload file' };
      }

      const { data: publicUrl } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      // Determine message type
      let messageType: MessageType = 'file';
      if (file.type.startsWith('image/')) messageType = 'image';

      const metadata: MessageMetadata = {
        file_url: publicUrl.publicUrl,
        file_name: file.name,
        file_size: file.size,
      };

      return sendMessage({
        conversation_id: conversationId,
        type: messageType,
        metadata,
      });
    },
    [user, currentTeam, supabase, sendMessage]
  );

  /**
   * Mark conversation as read
   */
  const markAsRead = useCallback(
    async (conversationId: string): Promise<void> => {
      if (!user) return;

      await supabase
        .from('conversation_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    },
    [user, supabase]
  );

  /**
   * Subscribe to new messages in a conversation
   */
  const subscribeToMessages = useCallback(
    (conversationId: string, onMessage: (message: MessageWithSender) => void) => {
      // Unsubscribe from previous channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      const channel = supabase
        .channel(`messages:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          async (payload) => {
            // Fetch the full message with sender
            const { data } = await supabase
              .from('messages')
              .select(`
                *,
                sender:profiles!sender_id(*)
              `)
              .eq('id', payload.new.id)
              .single();

            if (data) {
              onMessage(data as MessageWithSender);
            }
          }
        )
        .subscribe();

      channelRef.current = channel;

      return () => {
        supabase.removeChannel(channel);
      };
    },
    [supabase]
  );

  /**
   * Subscribe to conversation updates (new messages, etc.)
   */
  const subscribeToConversations = useCallback(
    (onUpdate: () => void) => {
      if (!user) return () => {};

      const channel = supabase
        .channel('conversations-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          () => {
            onUpdate();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
    [user, supabase]
  );

  /**
   * Get total unread count across all conversations
   */
  const getTotalUnreadCount = useCallback(async (): Promise<number> => {
    const conversations = await getConversations();
    return conversations.reduce((sum, conv) => sum + conv.unread_count, 0);
  }, [getConversations]);

  /**
   * Toggle mute for a conversation
   */
  const toggleMute = useCallback(
    async (conversationId: string, muted: boolean): Promise<void> => {
      if (!user) return;

      await supabase
        .from('conversation_participants')
        .update({ is_muted: muted })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    },
    [user, supabase]
  );

  /**
   * Leave a conversation (for group chats)
   */
  const leaveConversation = useCallback(
    async (conversationId: string): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { error } = await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error leaving conversation:', error);
        return { success: false, error: 'Failed to leave conversation' };
      }

      return { success: true };
    },
    [user, supabase]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [supabase]);

  return {
    isLoading,
    getConversations,
    getTeamChat,
    getOrCreateDM,
    createGroupChat,
    getMessages,
    sendMessage,
    sendFileMessage,
    markAsRead,
    subscribeToMessages,
    subscribeToConversations,
    getTotalUnreadCount,
    toggleMute,
    leaveConversation,
  };
}
