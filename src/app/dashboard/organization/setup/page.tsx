'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useOrganization } from '@/hooks/use-organization';

type SetupMode = 'choose' | 'create' | 'join';

export default function OrganizationSetupPage() {
  const router = useRouter();
  const { createOrganization, joinOrganization } = useOrganization();

  const [mode, setMode] = useState<SetupMode>('choose');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [orgName, setOrgName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // Join form state
  const [organizationId, setOrganizationId] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      setError('Please enter an organization name');
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await createOrganization(orgName.trim(), logoUrl.trim() || undefined);

    if (result.success) {
      router.push('/dashboard/organization');
    } else {
      setError(result.error || 'Failed to create organization');
      setIsLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId.trim()) {
      setError('Please enter an organization ID');
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await joinOrganization(organizationId.trim());

    if (result.success) {
      router.push('/dashboard/organization');
    } else {
      setError(result.error || 'Failed to join organization');
      setIsLoading(false);
    }
  };

  // Choose mode view
  if (mode === 'choose') {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            href="/dashboard/organization"
            className="inline-flex items-center gap-2 text-text-secondary hover:text-navy mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-navy mb-2">Organization Setup</h1>
          <p className="text-text-secondary">Create a new organization or join an existing one.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Option */}
          <button
            onClick={() => setMode('create')}
            className="card card-hover p-6 text-left transition-all hover:border-teal"
          >
            <div className="w-12 h-12 bg-teal-glow rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-navy mb-2">Create Organization</h3>
            <p className="text-text-secondary text-sm">
              Start a new organization and invite others to join. Perfect for clubs, leagues, or schools.
            </p>
          </button>

          {/* Join Option */}
          <button
            onClick={() => setMode('join')}
            className="card card-hover p-6 text-left transition-all hover:border-teal"
          >
            <div className="w-12 h-12 bg-navy/10 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-navy mb-2">Join Organization</h3>
            <p className="text-text-secondary text-sm">
              Join an existing organization with an invite. Ask your admin for the organization ID.
            </p>
          </button>
        </div>
      </div>
    );
  }

  // Create organization view
  if (mode === 'create') {
    return (
      <div className="p-6 md:p-8 max-w-xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => {
              setMode('choose');
              setError(null);
            }}
            className="inline-flex items-center gap-2 text-text-secondary hover:text-navy mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-navy mb-2">Create Organization</h1>
          <p className="text-text-secondary">Set up your new organization.</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="card p-6">
          <div className="form-group">
            <label htmlFor="orgName" className="label">
              Organization Name *
            </label>
            <input
              id="orgName"
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g., Springfield Youth Basketball League"
              required
              className="input"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="logoUrl" className="label">
              Logo URL (optional)
            </label>
            <input
              id="logoUrl"
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="input"
              disabled={isLoading}
            />
            <p className="text-xs text-text-muted mt-1">
              Enter a URL to your organization logo image.
            </p>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setMode('choose');
                setError(null);
              }}
              className="btn-secondary flex-1"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create Organization
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Join organization view
  return (
    <div className="p-6 md:p-8 max-w-xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => {
            setMode('choose');
            setError(null);
          }}
          className="inline-flex items-center gap-2 text-text-secondary hover:text-navy mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-navy mb-2">Join Organization</h1>
        <p className="text-text-secondary">Enter the organization ID provided by your admin.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleJoin} className="card p-6">
        <div className="form-group">
          <label htmlFor="organizationId" className="label">
            Organization ID *
          </label>
          <input
            id="organizationId"
            type="text"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            placeholder="e.g., abc123-def456-..."
            required
            className="input font-mono text-sm"
            disabled={isLoading}
          />
          <p className="text-xs text-text-muted mt-1">
            Ask your organization admin for this ID.
          </p>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={() => {
              setMode('choose');
              setError(null);
            }}
            className="btn-secondary flex-1"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1" disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                  />
                </svg>
                Join Organization
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
