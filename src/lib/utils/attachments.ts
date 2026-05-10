export const SAFE_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
export const SAFE_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime']);
export const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export const SAFE_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
export const SAFE_VIDEO_EXTENSIONS = new Set(['mp4', 'mov']);
export const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx']);

export const CHAT_ATTACHMENT_MIME_TYPES = new Set([
  ...SAFE_IMAGE_MIME_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
export const CHAT_ATTACHMENT_EXTENSIONS = new Set([
  ...SAFE_IMAGE_EXTENSIONS,
  'pdf',
  'doc',
  'docx',
]);

export const POST_ATTACHMENT_MIME_TYPES = new Set([
  ...SAFE_IMAGE_MIME_TYPES,
  ...SAFE_VIDEO_MIME_TYPES,
  ...DOCUMENT_MIME_TYPES,
]);
export const POST_ATTACHMENT_EXTENSIONS = new Set([
  ...SAFE_IMAGE_EXTENSIONS,
  ...SAFE_VIDEO_EXTENSIONS,
  ...DOCUMENT_EXTENSIONS,
]);

export const DRILL_MEDIA_MIME_TYPES = new Set([
  ...SAFE_IMAGE_MIME_TYPES,
  ...SAFE_VIDEO_MIME_TYPES,
  'application/pdf',
]);
export const DRILL_MEDIA_EXTENSIONS = new Set([
  ...SAFE_IMAGE_EXTENSIONS,
  ...SAFE_VIDEO_EXTENSIONS,
  'pdf',
]);

const GENERIC_MIME_TYPES = new Set(['', 'application/octet-stream']);
const EXTENSION_BY_MIME_TYPE = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
  ['video/mp4', 'mp4'],
  ['video/quicktime', 'mov'],
  ['application/pdf', 'pdf'],
  ['application/msword', 'doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['application/vnd.ms-excel', 'xls'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
]);

function normalizeMimeType(type: string | undefined) {
  return (type || '').toLowerCase();
}

export function getFileExtension(file: Pick<File, 'name'>) {
  return file.name.split('.').pop()?.toLowerCase() || '';
}

export function getSafeFileExtension(
  file: Pick<File, 'name' | 'type'>,
  allowedExtensions: ReadonlySet<string>,
  fallback = 'bin'
) {
  const extension = getFileExtension(file);
  if (allowedExtensions.has(extension)) return extension;

  return EXTENSION_BY_MIME_TYPE.get(normalizeMimeType(file.type)) || fallback;
}

export function isTrustedAttachmentFile(
  file: Pick<File, 'name' | 'type'>,
  allowedMimeTypes: ReadonlySet<string>,
  allowedExtensions: ReadonlySet<string>
) {
  const mimeType = normalizeMimeType(file.type);
  if (!GENERIC_MIME_TYPES.has(mimeType)) {
    return allowedMimeTypes.has(mimeType);
  }

  return allowedExtensions.has(getFileExtension(file));
}

export function isSafeImageFile(file: Pick<File, 'name' | 'type'>) {
  return isTrustedAttachmentFile(file, SAFE_IMAGE_MIME_TYPES, SAFE_IMAGE_EXTENSIONS);
}

export function isSafeVideoFile(file: Pick<File, 'name' | 'type'>) {
  return isTrustedAttachmentFile(file, SAFE_VIDEO_MIME_TYPES, SAFE_VIDEO_EXTENSIONS);
}
