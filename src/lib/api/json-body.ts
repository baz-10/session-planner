import { NextRequest, NextResponse } from 'next/server';

type JsonBodyResult<T> =
  | { ok: true; body: T }
  | { ok: false; response: NextResponse };

const DEFAULT_MAX_JSON_BODY_BYTES = 256 * 1024;

const DEFAULT_INVALID_JSON_BODY = {
  success: false,
  error: 'Invalid JSON request body.',
};

const DEFAULT_BODY_TOO_LARGE = {
  success: false,
  error: 'Request body is too large.',
};

export async function parseJsonObjectBody<T>(
  request: NextRequest,
  invalidBody: Record<string, unknown> = DEFAULT_INVALID_JSON_BODY,
  options: { maxBytes?: number; bodyTooLarge?: Record<string, unknown> } = {}
): Promise<JsonBodyResult<T>> {
  try {
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BODY_BYTES;
    const sizeGuard = checkContentLength(request, maxBytes, options.bodyTooLarge);
    if (!sizeGuard.ok) return sizeGuard;

    const rawBody = await request.text();
    const rawBodyBytes = new TextEncoder().encode(rawBody).byteLength;
    if (rawBodyBytes > maxBytes) {
      return bodyTooLargeResponse(options.bodyTooLarge);
    }

    if (!rawBody.trim()) {
      throw new Error('JSON body is empty');
    }

    return { ok: true, body: parseJsonObject<T>(rawBody) };
  } catch {
    return invalidJsonResponse(invalidBody);
  }
}

export async function parseOptionalJsonObjectBody<T>(
  request: NextRequest,
  fallbackBody: T,
  invalidBody: Record<string, unknown> = DEFAULT_INVALID_JSON_BODY,
  options: { maxBytes?: number; bodyTooLarge?: Record<string, unknown> } = {}
): Promise<JsonBodyResult<T>> {
  try {
    const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BODY_BYTES;
    const sizeGuard = checkContentLength(request, maxBytes, options.bodyTooLarge);
    if (!sizeGuard.ok) return sizeGuard;

    const rawBody = await request.text();
    const rawBodyBytes = new TextEncoder().encode(rawBody).byteLength;
    if (rawBodyBytes > maxBytes) {
      return bodyTooLargeResponse(options.bodyTooLarge);
    }

    if (!rawBody.trim()) {
      return { ok: true, body: fallbackBody };
    }

    return { ok: true, body: parseJsonObject<T>(rawBody) };
  } catch {
    return invalidJsonResponse(invalidBody);
  }
}

function parseJsonObject<T>(rawBody: string): T {
  const parsedBody = JSON.parse(rawBody);
  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    throw new Error('JSON body must be an object');
  }

  return parsedBody as T;
}

function checkContentLength<T>(
  request: NextRequest,
  maxBytes: number,
  bodyTooLarge?: Record<string, unknown>
): JsonBodyResult<T> {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return bodyTooLargeResponse(bodyTooLarge);
  }

  return { ok: true, body: undefined as T };
}

function invalidJsonResponse<T>(invalidBody: Record<string, unknown>): JsonBodyResult<T> {
  return {
    ok: false,
    response: NextResponse.json(invalidBody, { status: 400 }),
  };
}

function bodyTooLargeResponse<T>(
  bodyTooLarge: Record<string, unknown> = DEFAULT_BODY_TOO_LARGE
): JsonBodyResult<T> {
  return {
    ok: false,
    response: NextResponse.json(bodyTooLarge, { status: 413 }),
  };
}
