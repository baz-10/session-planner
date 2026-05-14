const PENDING_PARENT_TEAM_SETUP_KEY_PREFIX = 'sessionPlanner.pendingParentTeamSetup';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSessionStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function getPendingParentTeamSetupKey(userId: string): string {
  return `${PENDING_PARENT_TEAM_SETUP_KEY_PREFIX}:${userId}`;
}

export function isValidPendingParentTeamSetupId(teamId: string | null | undefined): teamId is string {
  return Boolean(teamId && UUID_PATTERN.test(teamId));
}

export function getPendingParentTeamSetupIdFromSearch(search: string): string | null {
  try {
    const teamId = new URLSearchParams(search).get('parentTeamId');
    return isValidPendingParentTeamSetupId(teamId) ? teamId : null;
  } catch {
    return null;
  }
}

export function storePendingParentTeamSetupId(userId: string, teamId: string): boolean {
  if (!isValidPendingParentTeamSetupId(teamId)) return false;

  try {
    const storage = getSessionStorage();
    if (!storage) return false;
    storage.setItem(getPendingParentTeamSetupKey(userId), teamId);
    return true;
  } catch {
    return false;
  }
}

export function getStoredPendingParentTeamSetupId(userId: string): string | null {
  const storage = getSessionStorage();
  if (!storage) return null;

  const key = getPendingParentTeamSetupKey(userId);
  const teamId = storage.getItem(key);
  if (!teamId) return null;

  if (!isValidPendingParentTeamSetupId(teamId)) {
    storage.removeItem(key);
    return null;
  }

  return teamId;
}

export function clearPendingParentTeamSetupId(userId: string): void {
  try {
    getSessionStorage()?.removeItem(getPendingParentTeamSetupKey(userId));
  } catch {
    // Storage access can fail in some browser privacy modes.
  }
}
