const CONTROL_CHAR_PATTERN = /[\x00-\x1F\x7F]/;

export function sanitizeLocalRedirect(value: string | null | undefined, fallback: string): string {
  if (!value || CONTROL_CHAR_PATTERN.test(value)) {
    return fallback;
  }

  let decodedValue: string;
  try {
    decodedValue = decodeURIComponent(value);
  } catch {
    return fallback;
  }

  if (
    CONTROL_CHAR_PATTERN.test(decodedValue) ||
    !decodedValue.startsWith('/') ||
    decodedValue.startsWith('//') ||
    decodedValue.startsWith('/\\')
  ) {
    return fallback;
  }

  return value;
}
