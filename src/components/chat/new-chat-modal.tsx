'use client';

import { useState, useEffect } from 'react';
import { useChat } from '@/hooks/use-chat';
import { useAuth } from '@/contexts/auth-context';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';
import type { Profile, TeamMember } from '@/types/database';

interface TeamMemberWithProfile extends TeamMember {
  profile: Profile;
}

interface NewChatModalProps {
  onClose: () => void;
  onConversationCreated: (conversationId: string) => void;
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

  useEffect(() => {
    loadMembers();
  }, [currentTeam?.id]);

  const loadMembers = async () => {
    if (!currentTeam) return;

    const { data, error } = await supabase
      .from('team_members')
      .select(`
        *,
        profile:profiles!user_id(*)
      `)
      .eq('team_id', currentTeam.id)
      .neq('user_id', user?.id);

    if (!error && data) {
      setMembers(data as TeamMemberWithProfile[]);
    }
    setIsLoading(false);
  };

  const filteredMembers = members.filter((m) =>
    m.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelection = (userId: string) => {
    if (mode === 'dm') {
      setSelectedIds([userId]);
    } else {
      setSelectedIds((prev) =>
        prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
      );
    }
  };

  const handleCreate = async () => {
    if (selectedIds.length === 0) return;

    setIsCreating(true);

    if (mode === 'dm') {
      const conv = await getOrCreateDM(selectedIds[0]);
      if (conv) {
        onConversationCreated(conv.id);
      }
    } else {
      if (!groupName.trim()) {
        setIsCreating(false);
        return;
      }
      const result = await createGroupChat(groupName.trim(), selectedIds);
      if (result.success && result.conversation) {
        onConversationCreated(result.conversation.id);
      }
    }

    setIsCreating(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Conversation</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 rounded"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode toggle */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => {
                setMode('dm');
                setSelectedIds([]);
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === 'dm' ? 'bg-white shadow' : 'text-gray-500'
              }`}
            >
              Direct Message
            </button>
            <button
              onClick={() => {
                setMode('group');
                setSelectedIds([]);
              }}
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
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
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
            placeholder="Search team members..."
            className="w-full px-3 py-2 bg-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Members list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No members found
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => toggleSelection(member.user_id)}
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
                    {member.profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900">
                      {member.profile?.full_name || 'Unknown'}
                    </div>
                    <div className="text-sm text-gray-500 capitalize">
                      {member.role}
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
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={
              selectedIds.length === 0 ||
              (mode === 'group' && !groupName.trim()) ||
              isCreating
            }
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-light disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : mode === 'dm' ? 'Start Chat' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}
