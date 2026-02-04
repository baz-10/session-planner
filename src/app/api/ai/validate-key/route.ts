/**
 * OpenAI API Key Validation Route
 *
 * POST /api/ai/validate-key - Validate an OpenAI API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { DrillAIService } from '@/lib/ai/drill-ai-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body as { apiKey: string };

    if (!apiKey) {
      return NextResponse.json(
        { valid: false, error: 'API key is required' },
        { status: 400 }
      );
    }

    const result = await DrillAIService.validateApiKey(apiKey);
    return NextResponse.json(result);
  } catch (error) {
    console.error('API key validation error:', error);
    return NextResponse.json(
      { valid: false, error: 'Validation failed' },
      { status: 500 }
    );
  }
}
