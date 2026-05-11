'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { getBrowserSupabaseClient } from '@/lib/auth/supabase-browser';
import { sanitizeLocalRedirect } from '@/lib/utils/redirect';
import type { Profile, TeamMember, Team, Player, ParentPlayerLink, Organization, OrganizationMember, OrgRole } from '@/types/database';

const AUTH_INIT_TIMEOUT_MS = 30000;
const TEAM_PUBLIC_SELECT =
  'id, organization_id, name, sport, logo_url, settings, created_by, created_at, updated_at';
const ORGANIZATION_PUBLIC_SELECT =
  'id, name, logo_url, settings, created_by, created_at, updated_at';
const MANAGER_TEAM_ROLES = new Set<TeamMember['role']>(['admin', 'coach']);

function logAuth(...args: unknown[]) {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
}

function hideTeamInviteCode(team: Partial<Team>): Team {
  return {
    ...(team as Team),
    team_code: null,
  };
}

function withOrganizationInviteCode(
  organization: Partial<Organization>,
  inviteCode: string | null
): Organization {
  return {
    ...(organization as Organization),
    organization_code: inviteCode,
  };
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;
}

interface TeamMembership extends TeamMember {
  team: Team;
}

interface LinkedPlayer extends Player {
  link: ParentPlayerLink;
}

interface OrganizationMembership extends OrganizationMember {
  organization: Organization;
}

interface AuthContextValue extends AuthState {
  // Auth actions
  signUp: (
    email: string,
    password: string,
    metadata?: Record<string, unknown>,
    redirectTo?: string
  ) => Promise<{ error: AuthError | null; session: Session | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: (redirectTo?: string) => Promise<{ error: AuthError | null }>;
  signInWithApple: (redirectTo?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (password: string) => Promise<{ error: AuthError | null }>;

  // Profile actions
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;

  // Team membership
  teamMemberships: TeamMembership[];
  currentTeam: Team | null;
  setCurrentTeam: (team: Team | null) => void;
  refreshTeamMemberships: () => Promise<void>;

  // Parent-player links (for parent role)
  linkedPlayers: LinkedPlayer[];
  refreshLinkedPlayers: () => Promise<void>;

  // Organization memberships
  organizationMemberships: OrganizationMembership[];
  currentOrganization: Organization | null;
  currentOrganizationRole: OrgRole | null;
  setCurrentOrganization: (org: Organization | null) => void;
  refreshOrganizationMemberships: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  logAuth('AuthProvider mounted');

  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    isLoading: true,
    isInitialized: false,
  });

  const [teamMemberships, setTeamMemberships] = useState<TeamMembership[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [linkedPlayers, setLinkedPlayers] = useState<LinkedPlayer[]>([]);
  const [organizationMemberships, setOrganizationMemberships] = useState<OrganizationMembership[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);

  const supabase = getBrowserSupabaseClient();

  // Get the user's role in the current organization
  const currentOrganizationRole = organizationMemberships.find(
    (m) => m.organization.id === currentOrganization?.id
  )?.role || null;

  // Fetch user profile
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    return data;
  }, [supabase]);

  // Fetch team memberships
  const refreshTeamMemberships = useCallback(async () => {
    if (!state.user) {
      logAuth('[Auth] refreshTeamMemberships: No user, skipping');
      setTeamMemberships([]);
      return;
    }

    logAuth('[Auth] refreshTeamMemberships: Fetching for user', state.user.id);

    const { data, error } = await supabase
      .from('team_members')
      .select(`
        *,
        team:teams(${TEAM_PUBLIC_SELECT})
      `)
      .eq('user_id', state.user.id);

    logAuth('[Auth] team_members query result:', { data, error, count: data?.length });

    if (error) {
      console.error('[Auth] Error fetching team memberships:', error);
      return;
    }

    const memberships = await Promise.all(
      (data || []).map(async (item: TeamMember & { team: Partial<Team> }) => {
        const team = hideTeamInviteCode(item.team);

        if (MANAGER_TEAM_ROLES.has(item.role)) {
          const { data: inviteCode, error: inviteError } = await supabase.rpc('get_team_invite_code', {
            team_uuid: team.id,
          });

          if (inviteError) {
            console.error('[Auth] Error fetching team invite code:', inviteError);
          } else {
            team.team_code = inviteCode;
          }
        }

        return {
          ...item,
          team,
        } as TeamMembership;
      })
    );

    logAuth('[Auth] Setting teamMemberships:', memberships.length, 'teams');
    setTeamMemberships(memberships);

    const preferredMembership =
      memberships.find((membership) => MANAGER_TEAM_ROLES.has(membership.role)) ??
      memberships[0];

    // Prefer a coach/admin team by default, and recover if currentTeam isn't one of the user's memberships.
    setCurrentTeam((previousTeam) => {
      const matchingMembership = previousTeam
        ? memberships.find((membership) => membership.team.id === previousTeam.id)
        : null;
      const nextTeam = matchingMembership?.team ?? preferredMembership?.team ?? null;
      if (nextTeam) {
        logAuth('[Auth] Setting currentTeam to:', nextTeam.name);
      }
      return nextTeam;
    });
  }, [supabase, state.user]);

  // Fetch linked players (for parents) and set their team context
  const refreshLinkedPlayers = useCallback(async () => {
    if (!state.user) {
      setLinkedPlayers([]);
      return;
    }

    logAuth('[Auth] Fetching linked players for parent...');

    // For parents, fetch player links with their team data
    const { data, error } = await supabase
      .from('parent_player_links')
      .select(`
        *,
        player:players(
          *,
          team:teams(${TEAM_PUBLIC_SELECT})
        )
      `)
      .eq('parent_user_id', state.user.id);

    if (error) {
      console.error('[Auth] Error fetching linked players:', error);
      return;
    }

    logAuth('[Auth] Linked players result:', data?.length || 0, 'players found');

    const players = (data || []).map((item: ParentPlayerLink & { player: Player & { team?: Team } }) => ({
      ...item.player,
      link: {
        id: item.id,
        parent_user_id: item.parent_user_id,
        player_id: item.player_id,
        relationship: item.relationship,
        can_rsvp: item.can_rsvp,
        receives_notifications: item.receives_notifications,
        created_at: item.created_at,
      },
    })) as LinkedPlayer[];

    setLinkedPlayers(players);

    // If user is a parent (no team memberships) and has linked players,
    // set their current team from the first linked player's team
    if (!currentTeam && teamMemberships.length === 0 && data && data.length > 0) {
      const firstPlayerWithTeam = data.find((item: { player: Player & { team?: Team } }) => item.player?.team);
      if (firstPlayerWithTeam?.player?.team) {
        logAuth('[Auth] Setting parent team from linked player:', firstPlayerWithTeam.player.team.name);
        setCurrentTeam(hideTeamInviteCode(firstPlayerWithTeam.player.team));
      }
    }
  }, [supabase, state.user, currentTeam, teamMemberships.length]);

  // Fetch organization memberships
  const refreshOrganizationMemberships = useCallback(async () => {
    if (!state.user) {
      setOrganizationMemberships([]);
      setCurrentOrganization(null);
      return;
    }

    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        *,
        organization:organizations(${ORGANIZATION_PUBLIC_SELECT})
      `)
      .eq('user_id', state.user.id);

    if (error) {
      console.error('Error fetching organization memberships:', error);
      return;
    }

    const memberships = await Promise.all(
      (data || []).map(async (item: OrganizationMember & { organization: Partial<Organization> }) => {
        const organization = withOrganizationInviteCode(item.organization, null);

        if (item.role === 'admin') {
          const { data: inviteCode, error: inviteError } = await supabase.rpc(
            'get_organization_invite_code',
            {
              org_uuid: organization.id,
            }
          );

          if (inviteError) {
            console.error('[Auth] Error fetching organization invite code:', inviteError);
          } else {
            organization.organization_code = inviteCode;
          }
        }

        return {
          ...item,
          organization,
        } as OrganizationMembership;
      })
    );

    setOrganizationMemberships(memberships);
    setCurrentOrganization((previousOrganization) => {
      if (memberships.length === 0) {
        return null;
      }

      if (!previousOrganization) {
        return memberships[0].organization;
      }

      const nextOrganization = memberships.find(
        (membership) => membership.organization.id === previousOrganization.id
      )?.organization;

      return nextOrganization || memberships[0].organization;
    });
  }, [supabase, state.user]);

  // Refresh profile
  const refreshProfile = useCallback(async () => {
    if (!state.user) return;

    const profile = await fetchProfile(state.user.id);
    setState((prev) => ({ ...prev, profile }));
  }, [state.user, fetchProfile]);

  // Initialize auth state
  useEffect(() => {
    logAuth('[Auth] useEffect running');
    let mounted = true;

    const initializeAuth = async () => {
      try {
        logAuth('[Auth] Starting session check...');

        // Protect against indefinite hangs, while allowing enough time for cold starts.
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`getSession timeout after ${AUTH_INIT_TIMEOUT_MS / 1000}s`)), AUTH_INIT_TIMEOUT_MS)
        );

        const sessionPromise = supabase.auth.getSession();

        const { data, error } = await Promise.race([sessionPromise, timeoutPromise]) as Awaited<typeof sessionPromise>;
        logAuth('[Auth] Session result:', { hasSession: !!data?.session, userId: data?.session?.user?.id, error });

        if (!mounted) return;

        if (error) {
          console.error('[Auth] Session error:', error);
          setState({
            user: null,
            session: null,
            profile: null,
            isLoading: false,
            isInitialized: true,
          });
          return;
        }

        const session = data?.session;
        let profile = null;
        if (session?.user) {
          logAuth('[Auth] Fetching profile for user:', session.user.id);
          profile = await fetchProfile(session.user.id);
        }

        setState({
          user: session?.user ?? null,
          session: session ?? null,
          profile,
          isLoading: false,
          isInitialized: true,
        });
        logAuth('[Auth] Initialization complete, user:', session?.user?.id);
      } catch (error) {
        console.error('🔴 [Auth] Initialization error:', error);
        if (mounted) {
          setState({
            user: null,
            session: null,
            profile: null,
            isLoading: false,
            isInitialized: true,
          });
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: string, session: Session | null) => {
        const nextUser = session?.user ?? null;

        // Keep auth callback synchronous to avoid auth lock contention/deadlocks.
        setState((prev) => ({
          ...prev,
          user: nextUser,
          session,
          profile: nextUser && prev.user?.id === nextUser.id ? prev.profile : null,
          isLoading: false,
          isInitialized: true,
        }));

        // Clear team data on sign out
        if (event === 'SIGNED_OUT') {
          setTeamMemberships([]);
          setCurrentTeam(null);
          setLinkedPlayers([]);
          setOrganizationMemberships([]);
          setCurrentOrganization(null);
          return;
        }

        // Defer profile loading until after the auth callback returns.
        if (nextUser) {
          setTimeout(() => {
            void (async () => {
              const profile = await fetchProfile(nextUser.id);
              if (!mounted) return;

              setState((prev) => {
                if (prev.user?.id !== nextUser.id) {
                  return prev;
                }

                return {
                  ...prev,
                  profile,
                };
              });
            })();
          }, 0);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  // Fetch team memberships when user changes
  useEffect(() => {
    if (state.user && state.isInitialized) {
      refreshTeamMemberships();
      refreshLinkedPlayers();
      refreshOrganizationMemberships();
    }
  }, [state.user, state.isInitialized, refreshTeamMemberships, refreshLinkedPlayers, refreshOrganizationMemberships]);

  // Auth actions
  const buildCallbackUrl = (redirectTo?: string) => {
    const callbackUrl = new URL('/callback', window.location.origin);
    const nextPath = sanitizeLocalRedirect(redirectTo, '');
    if (nextPath) {
      callbackUrl.searchParams.set('next', nextPath);
    }
    return callbackUrl.toString();
  };

  const signUp = async (
    email: string,
    password: string,
    metadata?: Record<string, unknown>,
    redirectTo?: string
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: buildCallbackUrl(redirectTo),
      },
    });
    return { error, session: data.session };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signInWithGoogle = async (redirectTo?: string) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: buildCallbackUrl(redirectTo),
      },
    });
    return { error };
  };

  const signInWithApple = async (redirectTo?: string) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: buildCallbackUrl(redirectTo),
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  };

  // Profile actions
  const updateProfile = async (updates: Partial<Profile>) => {
    if (!state.user) {
      return { error: new Error('Not authenticated') };
    }

    const { error } = await (supabase as any)
      .from('profiles')
      .update(updates)
      .eq('id', state.user.id);

    if (!error) {
      await refreshProfile();
    }

    return { error: error ? new Error(error.message) : null };
  };

  const value: AuthContextValue = {
    ...state,
    signUp,
    signIn,
    signInWithGoogle,
    signInWithApple,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    refreshProfile,
    teamMemberships,
    currentTeam,
    setCurrentTeam,
    refreshTeamMemberships,
    linkedPlayers,
    refreshLinkedPlayers,
    organizationMemberships,
    currentOrganization,
    currentOrganizationRole,
    setCurrentOrganization,
    refreshOrganizationMemberships,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
