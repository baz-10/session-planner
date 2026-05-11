import { NextRequest, NextResponse } from 'next/server';

type JsonBodyResult<T> =
  | { ok: true; body: T }
  | { ok: false; response: NextResponse };

const DEFAULT_INVALID_JSON_BODY = {
  success: false,
  error: 'Invalid JSON request body.',
};

export async function parseJsonObjectBody<T>(
  request: NextRequest,
  invalidBody: Record<string, unknown> = DEFAULT_INVALID_JSON_BODY
): Promise<JsonBodyResult<T>> {
  try {
    const rawBody = await request.text();
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
  invalidBody: Record<string, unknown> = DEFAULT_INVALID_JSON_BODY
): Promise<JsonBodyResult<T>> {
  try {
    const rawBody = await request.text();

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

function invalidJsonResponse<T>(invalidBody: Record<string, unknown>): JsonBodyResult<T> {
  return {
    ok: false,
    response: NextResponse.json(invalidBody, { status: 400 }),
  };
}
