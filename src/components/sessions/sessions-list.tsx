'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSessions } from '@/hooks/use-sessions';
import { formatDuration } from '@/lib/utils/time';
import type { Session } from '@/types/database';

export function SessionsList() {
  const { getSessions, deleteSession, duplicateSession } = useSessions();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setIsLoading(true);
    const data = await getSessions();
    setSessions(data);
    setIsLoading(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    const result = await deleteSession(id);
    if (result.success) {
      setSessions((prev) => prev.filter((s) => s.id !== id));
    }
  };

  const handleDuplicate = async (id: string, name: string) => {
    const newName = prompt('Enter name for the copy:', `${name} (Copy)`);
    if (!newName) return;

    const result = await duplicateSession(id, newName);
    if (result.success) {
      loadSessions();
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-teal border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="empty-state-icon mx-auto mb-4">
          <svg className="w-16 h-16 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-navy mb-2">No Practice Plans Yet</h2>
        <p className="text-text-secondary mb-6 max-w-sm mx-auto">
          Create your first practice plan to start organizing your sessions with timed activities.
        </p>
        <Link href="/dashboard/sessions/new" className="btn-accent">
          Create Your First Plan
        </Link>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead className="bg-whisper border-b border-border">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Name
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Date
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Duration
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Location
            </th>
            <th className="px-6 py-4 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Created
            </th>
            <th className="px-6 py-4 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sessions.map((session) => (
            <tr key={session.id} className="hover:bg-whisper transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <Link
                  href={`/dashboard/sessions/${session.id}`}
                  className="text-navy hover:text-teal font-medium transition-colors"
                >
                  {session.name}
                </Link>
                {session.is_template && (
                  <span className="ml-2 badge-teal">Template</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-text-secondary">
                {formatDate(session.date)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {session.duration ? (
                  <span className="time-display">{formatDuration(session.duration)}</span>
                ) : (
                  <span className="text-text-muted">-</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-text-secondary">
                {session.location || '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-text-secondary">
                {formatDate(session.created_at)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <div className="flex items-center justify-end gap-1">
                  <Link
                    href={`/dashboard/sessions/${session.id}`}
                    className="p-2 text-text-secondary hover:text-navy hover:bg-whisper rounded-md transition-colors"
                    title="Edit"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </Link>
                  <button
                    onClick={() => handleDuplicate(session.id, session.name)}
                    className="p-2 text-text-secondary hover:text-navy hover:bg-whisper rounded-md transition-colors"
                    title="Duplicate"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(session.id, session.name)}
                    className="p-2 text-text-secondary hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
