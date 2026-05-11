'use client';

import { useState } from 'react';

interface ReactionSummary {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface ReactionPickerProps {
  reactions: ReactionSummary[];
  onReact: (emoji: string) => void | Promise<void>;
  disabled?: boolean;
}

const QUICK_REACTIONS = ['👍', '❤️', '🎉', '😂', '😮', '😢'];

export function ReactionPicker({ reactions, onReact, disabled = false }: ReactionPickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleReact = (emoji: string) => {
    if (disabled) return;
    onReact(emoji);
    setShowPicker(false);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Existing reactions */}
      {reactions.map((reaction) => (
        <button
          type="button"
          key={reaction.emoji}
          onClick={() => handleReact(reaction.emoji)}
          disabled={disabled}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
            reaction.hasReacted
              ? 'bg-primary/10 text-primary border border-primary/30'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          <span>{reaction.emoji}</span>
          <span className="text-xs">{reaction.count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          disabled={disabled}
          aria-expanded={showPicker}
          aria-label="Add reaction"
          className="flex items-center justify-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-md disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {showPicker && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowPicker(false)}
            />
            <div className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 z-20 p-2">
              <div className="flex gap-1">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    disabled={disabled}
                    className="w-8 h-8 flex items-center justify-center text-xl hover:bg-gray-100 rounded disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
