/**
 * AI Drill Discovery API Route
 *
 * POST /api/ai/drills - Get AI-powered drill suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/auth/supabase-server';
import { createDrillAIService } from '@/lib/ai/drill-ai-service';
import type { DrillQueryContext } from '@/lib/ai/openai-config';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { apiKey, query, context } = body as {
      apiKey: string;
      query: string;
      context?: DrillQueryContext;
    };
    const normalizedApiKey = apiKey?.trim();
    const normalizedQuery = query?.trim();

    if (!normalizedApiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      );
    }

    if (!normalizedQuery) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    const aiService = createDrillAIService(normalizedApiKey);
    const result = await aiService.getSuggestions(normalizedQuery, context);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('AI Drills API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
