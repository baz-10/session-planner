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
import type { Profile, TeamMember, Team, Player, ParentPlayerLink } from '@/types/database';

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

interface AuthContextValue extends AuthState {
  // Auth actions
  signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signInWithApple: () => Promise<{ error: AuthError | null }>;
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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
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

  const supabase = getBrowserSupabaseClient();

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
      setTeamMemberships([]);
      return;
    }

    const { data, error } = await supabase
      .from('team_members')
      .select(`
        *,
        team:teams(*)
      `)
      .eq('user_id', state.user.id);

    if (error) {
      console.error('Error fetching team memberships:', error);
      return;
    }

    const memberships = (data || []).map((item: TeamMember & { team: Team }) => ({
      ...item,
      team: item.team as Team,
    })) as TeamMembership[];

    setTeamMemberships(memberships);

    // Set current team to first one if not set
    if (!currentTeam && memberships.length > 0) {
      setCurrentTeam(memberships[0].team);
    }
  }, [supabase, state.user, currentTeam]);

  // Fetch linked players (for parents)
  const refreshLinkedPlayers = useCallback(async () => {
    if (!state.user) {
      setLinkedPlayers([]);
      return;
    }

    const { data, error } = await supabase
      .from('parent_player_links')
      .select(`
        *,
        player:players(*)
      `)
      .eq('parent_user_id', state.user.id);

    if (error) {
      console.error('Error fetching linked players:', error);
      return;
    }

    const players = (data || []).map((item: ParentPlayerLink & { player: Player }) => ({
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
  }, [supabase, state.user]);

  // Refresh profile
  const refreshProfile = useCallback(async () => {
    if (!state.user) return;

    const profile = await fetchProfile(state.user.id);
    setState((prev) => ({ ...prev, profile }));
  }, [state.user, fetchProfile]);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      let profile = null;
      if (session?.user) {
        profile = await fetchProfile(session.user.id);
      }

      setState({
        user: session?.user ?? null,
        session,
        profile,
        isLoading: false,
        isInitialized: true,
      });
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: Session | null) => {
        let profile = null;
        if (session?.user) {
          profile = await fetchProfile(session.user.id);
        }

        setState((prev) => ({
          ...prev,
          user: session?.user ?? null,
          session,
          profile,
          isLoading: false,
        }));

        // Clear team data on sign out
        if (event === 'SIGNED_OUT') {
          setTeamMemberships([]);
          setCurrentTeam(null);
          setLinkedPlayers([]);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  // Fetch team memberships when user changes
  useEffect(() => {
    if (state.user && state.isInitialized) {
      refreshTeamMemberships();
      refreshLinkedPlayers();
    }
  }, [state.user, state.isInitialized, refreshTeamMemberships, refreshLinkedPlayers]);

  // Auth actions
  const signUp = async (email: string, password: string, metadata?: Record<string, unknown>) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: `${window.location.origin}/callback`,
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/callback`,
      },
    });
    return { error };
  };

  const signInWithApple = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/callback`,
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
