'use client';

import { Component, type ErrorInfo, type ReactNode, useState } from 'react';
import { PlayEditor } from './play-editor';

interface PlayEditorShellProps {
  playId?: string;
  initialTemplateId?: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

class PlayEditorErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unexpected play editor error.',
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error('PlayEditor crashed:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: null });
    this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-700">Editor crashed</h2>
          <p className="text-sm text-red-600 mt-1">
            {this.state.message || 'A client-side exception occurred while rendering the play editor.'}
          </p>
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={this.handleReset}
              className="px-3 py-1.5 text-sm rounded-md bg-primary text-white hover:bg-primary-light"
            >
              Reset Editor
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function PlayEditorShell({ playId, initialTemplateId }: PlayEditorShellProps) {
  const [resetKey, setResetKey] = useState(0);

  return (
    <PlayEditorErrorBoundary onReset={() => setResetKey((prev) => prev + 1)}>
      <PlayEditor
        key={`play-editor-${playId || 'new'}-${resetKey}`}
        playId={playId}
        initialTemplateId={initialTemplateId}
      />
    </PlayEditorErrorBoundary>
  );
}

