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

export function storePendingParentTeamSetupId(userId: string, teamId: string): void {
  if (!UUID_PATTERN.test(teamId)) return;

  getSessionStorage()?.setItem(getPendingParentTeamSetupKey(userId), teamId);
}

export function getStoredPendingParentTeamSetupId(userId: string): string | null {
  const storage = getSessionStorage();
  if (!storage) return null;

  const key = getPendingParentTeamSetupKey(userId);
  const teamId = storage.getItem(key);
  if (!teamId) return null;

  if (!UUID_PATTERN.test(teamId)) {
    storage.removeItem(key);
    return null;
  }

  return teamId;
}

export function clearPendingParentTeamSetupId(userId: string): void {
  getSessionStorage()?.removeItem(getPendingParentTeamSetupKey(userId));
}
