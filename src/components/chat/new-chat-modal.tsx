'use client';

import { useState, useEffect, useCallback } from 'react';
import { useChat } from '@/hooks/use-chat';
import { useAuth } from '@/contexts/auth-context';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';
import type { Profile, TeamMember } from '@/types/database';

interface TeamMemberWithProfile extends TeamMember {
  profile: Profile | null;
}

interface NewChatModalProps {
  onClose: () => void;
  onConversationCreated: (conversationId: string) => void | Promise<void>;
}

export function NewChatModal({ onClose, onConversationCreated }: NewChatModalProps) {
  const { user, currentTeam } = useAuth();
  const { getOrCreateDM, createGroupChat } = useChat();
  const supabase = getBrowserSupabaseClient();

  const [mode, setMode] = useState<'dm' | 'group'>('dm');
  const [members, setMembers] = useState<TeamMemberWithProfile[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [memberLoadError, setMemberLoadError] = useState('');
  const [error, setError] = useState('');

  const loadMembers = useCallback(async () => {
    if (!currentTeam) {
      setMembers([]);
      setMemberLoadError('');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setMemberLoadError('');
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select(`
          *,
          profile:profiles!user_id(id, email, full_name, avatar_url)
        `)
        .eq('team_id', currentTeam.id)
        .neq('user_id', user?.id);

      if (error) {
        console.error('Error loading chat members:', error);
        setMembers([]);
        setMemberLoadError('Unable to load team members. Check your connection and try again.');
      } else if (data) {
        setMembers(data as TeamMemberWithProfile[]);
      }
    } catch (loadError) {
      console.error('Unexpected error loading chat members:', loadError);
      setMembers([]);
      setMemberLoadError('Unable to load team members. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [currentTeam, supabase, user?.id]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const getMemberDisplayName = (member: TeamMemberWithProfile) => {
    return member.profile?.full_name || member.profile?.email || 'Team member';
  };

  const filteredMembers = members.filter((member) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;

    return [
      member.profile?.full_name,
      member.profile?.email,
      member.role,
    ].some((value) => value?.toLowerCase().includes(query));
  });

  const toggleSelection = (userId: string) => {
    setError('');
    if (mode === 'dm') {
      setSelectedIds([userId]);
    } else {
      setSelectedIds((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      );
    }
  };

  const handleCreate = async () => {
    if (isCreating) return;
    if (selectedIds.length === 0) return;

    setIsCreating(true);
    setError('');

    try {
      if (mode === 'dm') {
        const result = await getOrCreateDM(selectedIds[0]);
        if (result.success && result.conversation) {
          await onConversationCreated(result.conversation.id);
          onClose();
        } else {
          setError(result.error || 'Failed to create direct message. Please try again.');
        }
        return;
      }

      if (!groupName.trim()) {
        setError('Enter a group name before creating the chat.');
        return;
      }

      const result = await createGroupChat(groupName.trim(), selectedIds);
      if (result.success && result.conversation) {
        await onConversationCreated(result.conversation.id);
        onClose();
      } else {
        setError(result.error || 'Failed to create group chat. Please try again.');
      }
    } catch (createError) {
      console.error('Error creating conversation:', createError);
      setError('Conversation could not be created. Check your connection and try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-conversation-title"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 id="new-conversation-title" className="text-lg font-semibold">New Conversation</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            className="p-1 text-gray-500 hover:text-gray-700 rounded disabled:cursor-wait disabled:opacity-50"
            aria-label="Close new conversation dialog"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div role="alert" className="mx-4 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Mode toggle */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => {
                setMode('dm');
                setSelectedIds([]);
                setError('');
              }}
              disabled={isCreating}
              aria-pressed={mode === 'dm'}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'dm' ? 'bg-white shadow' : 'text-gray-500'
              }`}
            >
              Direct Message
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('group');
                setSelectedIds([]);
                setError('');
              }}
              disabled={isCreating}
              aria-pressed={mode === 'group'}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'group' ? 'bg-white shadow' : 'text-gray-500'
              }`}
            >
              Group Chat
            </button>
          </div>
        </div>

        {/* Group name input */}
        {mode === 'group' && (
          <div className="px-4 py-3 border-b border-gray-100">
            <input
              type="text"
              value={groupName}
              onChange={(e) => {
                setGroupName(e.target.value);
                setError('');
              }}
              disabled={isCreating}
              placeholder="Group name"
              aria-label="Group chat name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        {/* Search */}
        <div className="px-4 py-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isCreating}
            placeholder="Search team members..."
            aria-label="Search team members"
            className="w-full px-3 py-2 bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Members list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8" role="status" aria-label="Loading team members">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" aria-hidden="true"></div>
            </div>
          ) : memberLoadError ? (
            <div role="alert" className="px-4 py-8 text-center">
              <p className="mb-3 text-sm font-medium text-red-700">{memberLoadError}</p>
              <button
                type="button"
                onClick={loadMembers}
                className="px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5 rounded-md"
              >
                Try again
              </button>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {members.length === 0 ? 'No other team members yet' : 'No matching members'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredMembers.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleSelection(member.user_id)}
                  disabled={isCreating}
                  aria-pressed={selectedIds.includes(member.user_id)}
                  aria-label={`Select ${getMemberDisplayName(member)} for chat`}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                >
                  {/* Checkbox/Radio */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedIds.includes(member.user_id)
                      ? 'border-primary bg-primary'
                      : 'border-gray-300'
                  }`}>
                    {selectedIds.includes(member.user_id) && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gray-300 text-white flex items-center justify-center font-medium">
                    {getMemberDisplayName(member).charAt(0).toUpperCase() || 'U'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900 truncate">
                      {getMemberDisplayName(member)}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      <span className="capitalize">{member.role}</span>
                      {member.profile?.email ? ` - ${member.profile.email}` : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md disabled:cursor-wait disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={
              selectedIds.length === 0 ||
              (mode === 'group' && !groupName.trim()) ||
              isCreating
            }
            aria-busy={isCreating}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : mode === 'dm' ? 'Start Chat' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}
