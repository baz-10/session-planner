import { supabase } from './supabase';
import type {
  Message,
  Post,
  Comment,
  Reaction,
  Rsvp,
  ConversationParticipant,
} from '@/types/database';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type PostgresChangePayload<T extends { [key: string]: any }> = RealtimePostgresChangesPayload<T>;

/**
 * Subscribe to new messages in a conversation
 */
export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: Message) => void
): RealtimeChannel {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload: PostgresChangePayload<Message>) => {
        if (payload.new) {
          onMessage(payload.new as Message);
        }
      }
    )
    .subscribe();
}

/**
 * Subscribe to message updates (edits, deletions)
 */
export function subscribeToMessageUpdates(
  conversationId: string,
  onUpdate: (message: Message) => void,
  onDelete: (messageId: string) => void
): RealtimeChannel {
  return supabase
    .channel(`message-updates:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload: PostgresChangePayload<Message>) => {
        if (payload.new) {
          onUpdate(payload.new as Message);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload: PostgresChangePayload<Message>) => {
        if (payload.old && 'id' in payload.old) {
          onDelete((payload.old as Message).id);
        }
      }
    )
    .subscribe();
}

/**
 * Subscribe to new posts in a team
 */
export function subscribeToTeamPosts(
  teamId: string,
  onNewPost: (post: Post) => void
): RealtimeChannel {
  return supabase
    .channel(`posts:${teamId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'posts',
        filter: `team_id=eq.${teamId}`,
      },
      (payload: PostgresChangePayload<Post>) => {
        if (payload.new) {
          onNewPost(payload.new as Post);
        }
      }
    )
    .subscribe();
}

/**
 * Subscribe to reactions on a post
 */
export function subscribeToPostReactions(
  postId: string,
  onReaction: (reaction: Reaction, eventType: 'INSERT' | 'DELETE') => void
): RealtimeChannel {
  return supabase
    .channel(`reactions:${postId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'reactions',
        filter: `post_id=eq.${postId}`,
      },
      (payload: PostgresChangePayload<Reaction>) => {
        if (payload.new) {
          onReaction(payload.new as Reaction, 'INSERT');
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'reactions',
        filter: `post_id=eq.${postId}`,
      },
      (payload: PostgresChangePayload<Reaction>) => {
        if (payload.old) {
          onReaction(payload.old as Reaction, 'DELETE');
        }
      }
    )
    .subscribe();
}

/**
 * Subscribe to comments on a post
 */
export function subscribeToPostComments(
  postId: string,
  onNewComment: (comment: Comment) => void
): RealtimeChannel {
  return supabase
    .channel(`comments:${postId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'comments',
        filter: `post_id=eq.${postId}`,
      },
      (payload: PostgresChangePayload<Comment>) => {
        if (payload.new) {
          onNewComment(payload.new as Comment);
        }
      }
    )
    .subscribe();
}

/**
 * Subscribe to RSVP changes for an event
 */
export function subscribeToEventRsvps(
  eventId: string,
  onRsvpChange: (rsvp: Rsvp, eventType: 'INSERT' | 'UPDATE') => void
): RealtimeChannel {
  return supabase
    .channel(`rsvps:${eventId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rsvps',
        filter: `event_id=eq.${eventId}`,
      },
      (payload: PostgresChangePayload<Rsvp>) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          onRsvpChange(payload.new as Rsvp, payload.eventType);
        }
      }
    )
    .subscribe();
}

/**
 * Subscribe to typing indicators in a conversation
 * Uses last_read_at updates as a proxy for typing
 */
export function subscribeToTypingIndicators(
  conversationId: string,
  currentUserId: string,
  onTyping: (userId: string, isTyping: boolean) => void
): RealtimeChannel {
  const typingTimers = new Map<string, NodeJS.Timeout>();

  return supabase
    .channel(`typing:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversation_participants',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload: PostgresChangePayload<ConversationParticipant>) => {
        const participant = payload.new as ConversationParticipant;
        if (participant.user_id === currentUserId) return;

        // Clear existing timer
        const existingTimer = typingTimers.get(participant.user_id);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        // Show typing indicator
        onTyping(participant.user_id, true);

        // Hide after 3 seconds of no updates
        const timer = setTimeout(() => {
          onTyping(participant.user_id, false);
          typingTimers.delete(participant.user_id);
        }, 3000);

        typingTimers.set(participant.user_id, timer);
      }
    )
    .subscribe();
}

/**
 * Broadcast a typing indicator update
 */
export async function broadcastTyping(conversationId: string, userId: string): Promise<void> {
  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
}

/**
 * Unsubscribe from a channel
 */
export async function unsubscribe(channel: RealtimeChannel): Promise<void> {
  await supabase.removeChannel(channel);
}

/**
 * Unsubscribe from all channels
 */
export async function unsubscribeAll(): Promise<void> {
  await supabase.removeAllChannels();
}
