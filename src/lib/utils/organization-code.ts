export const ORGANIZATION_CODE_LENGTH = 8;

export function normalizeOrganizationCode(value: string): string {
  return value
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase()
    .slice(0, ORGANIZATION_CODE_LENGTH);
}
