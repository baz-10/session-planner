/**
 * OpenAI API Key Validation Route
 *
 * POST /api/ai/validate-key - Validate an OpenAI API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/auth/supabase-server';
import { DrillAIService } from '@/lib/ai/drill-ai-service';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { valid: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { apiKey } = body as { apiKey: string };
    const normalizedApiKey = apiKey?.trim();

    if (!normalizedApiKey) {
      return NextResponse.json(
        { valid: false, error: 'API key is required' },
        { status: 400 }
      );
    }

    const result = await DrillAIService.validateApiKey(normalizedApiKey);
    return NextResponse.json(result);
  } catch (error) {
    console.error('API key validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Validation failed' },
      { status: 500 }
    );
  }
}
