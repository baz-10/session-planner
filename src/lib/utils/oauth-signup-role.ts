import type { TeamRole } from '@/types/database';

export type OAuthSignupUserType = 'coach' | 'player' | 'parent';

interface StoredOAuthSignupRole {
  userType: OAuthSignupUserType;
  createdAt: number;
}

export interface PendingOAuthSignupRole {
  userType: OAuthSignupUserType;
  defaultRole: TeamRole;
}

const STORAGE_KEY = 'session-planner-oauth-signup-role';
const MAX_AGE_MS = 30 * 60 * 1000;

const DEFAULT_ROLE_BY_USER_TYPE: Record<OAuthSignupUserType, TeamRole> = {
  coach: 'coach',
  player: 'player',
  parent: 'parent',
};

function isOAuthSignupUserType(value: unknown): value is OAuthSignupUserType {
  return value === 'coach' || value === 'player' || value === 'parent';
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function storePendingOAuthSignupRole(userType: OAuthSignupUserType) {
  const storage = getStorage();
  if (!storage) return;

  const storedRole: StoredOAuthSignupRole = {
    userType,
    createdAt: Date.now(),
  };

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(storedRole));
  } catch {
    // A blocked storage write should not prevent OAuth from starting.
  }
}

export function clearPendingOAuthSignupRole() {
  try {
    getStorage()?.removeItem(STORAGE_KEY);
  } catch {
    // A blocked storage write should not prevent normal login.
  }
}

export function consumePendingOAuthSignupRole(): PendingOAuthSignupRole | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const rawValue = storage.getItem(STORAGE_KEY);
    storage.removeItem(STORAGE_KEY);

    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as Partial<StoredOAuthSignupRole>;
    if (!isOAuthSignupUserType(parsed.userType)) return null;

    const createdAt = typeof parsed.createdAt === 'number' ? parsed.createdAt : 0;
    if (Date.now() - createdAt > MAX_AGE_MS) return null;

    return {
      userType: parsed.userType,
      defaultRole: DEFAULT_ROLE_BY_USER_TYPE[parsed.userType],
    };
  } catch {
    return null;
  }
}
