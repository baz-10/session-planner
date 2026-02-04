/**
 * OpenAI Configuration and Utilities for AI Drill Discovery
 */

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export interface DrillSuggestion {
  name: string;
  description: string;
  category: string;
  duration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  equipment: string[];
  keyPoints: string[];
  variations?: string[];
}

export interface DrillQueryContext {
  sessionEmphasis?: {
    offensive?: string;
    defensive?: string;
  };
  timeRemaining?: number;
  existingDrills?: string[];
  playerSkillLevel?: 'beginner' | 'intermediate' | 'advanced' | 'mixed';
  sport?: string;
  categoryPreference?: string;
}

export const DEFAULT_MODEL = 'gpt-4o-mini';
export const MAX_SUGGESTIONS = 5;

export const DRILL_SUGGESTION_SYSTEM_PROMPT = `You are an expert sports coach assistant specializing in creating practice drills and training activities. Your role is to suggest drills based on the coach's requirements.

When suggesting drills, you should:
1. Consider the sport type (default to basketball if not specified)
2. Account for skill level of players
3. Provide clear, actionable drill descriptions
4. Include equipment needed and key coaching points
5. Suggest appropriate durations based on drill complexity
6. Offer variations when applicable

Always format your responses as valid JSON matching the DrillSuggestion interface:
{
  "name": "Drill Name",
  "description": "Clear description of the drill execution",
  "category": "Category (e.g., Shooting, Defense, Conditioning)",
  "duration": 10,
  "difficulty": "beginner|intermediate|advanced",
  "equipment": ["basketballs", "cones"],
  "keyPoints": ["Key coaching point 1", "Key coaching point 2"],
  "variations": ["Optional variation 1"]
}

Respond with an array of drill suggestions.`;

export function buildDrillQueryPrompt(
  query: string,
  context?: DrillQueryContext
): string {
  let prompt = `Please suggest ${MAX_SUGGESTIONS} drills based on this request: "${query}"`;

  if (context?.sport) {
    prompt += `\n\nSport: ${context.sport}`;
  }

  if (context?.sessionEmphasis?.offensive || context?.sessionEmphasis?.defensive) {
    prompt += '\n\nSession Emphasis:';
    if (context.sessionEmphasis.offensive) {
      prompt += `\n- Offensive: ${context.sessionEmphasis.offensive}`;
    }
    if (context.sessionEmphasis.defensive) {
      prompt += `\n- Defensive: ${context.sessionEmphasis.defensive}`;
    }
  }

  if (context?.timeRemaining) {
    prompt += `\n\nTime available: ${context.timeRemaining} minutes. Suggest drills that fit within this timeframe.`;
  }

  if (context?.playerSkillLevel) {
    prompt += `\n\nPlayer skill level: ${context.playerSkillLevel}`;
  }

  if (context?.categoryPreference) {
    prompt += `\n\nPreferred category: ${context.categoryPreference}`;
  }

  if (context?.existingDrills && context.existingDrills.length > 0) {
    prompt += `\n\nDrills already in session (avoid duplicates): ${context.existingDrills.join(', ')}`;
  }

  prompt += '\n\nRespond with a JSON array of drill suggestions.';

  return prompt;
}

export function parseOpenAIResponse(response: string): DrillSuggestion[] {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Validate each suggestion has required fields
      return parsed.filter(
        (drill: DrillSuggestion) =>
          drill.name &&
          drill.description &&
          drill.category &&
          typeof drill.duration === 'number'
      );
    }
    return [];
  } catch (error) {
    console.error('Failed to parse OpenAI response:', error);
    return [];
  }
}
