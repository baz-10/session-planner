export const TEAM_CODE_LENGTH = 6;

export function normalizeTeamCode(value: string): string {
  return value
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
    .slice(0, TEAM_CODE_LENGTH);
}
