/**
 * AI Drill Discovery Service
 *
 * Uses OpenAI to provide intelligent drill suggestions based on natural language queries.
 * Users provide their own API key which is stored securely in their profile.
 */

import {
  OpenAIConfig,
  DrillSuggestion,
  DrillQueryContext,
  DEFAULT_MODEL,
  DRILL_SUGGESTION_SYSTEM_PROMPT,
  buildDrillQueryPrompt,
  parseOpenAIResponse,
} from './openai-config';

export interface AIDrillServiceResult {
  success: boolean;
  suggestions?: DrillSuggestion[];
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class DrillAIService {
  private config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    this.config = {
      ...config,
      model: config.model || DEFAULT_MODEL,
      maxTokens: config.maxTokens || 2000,
    };
  }

  async getSuggestions(
    query: string,
    context?: DrillQueryContext
  ): Promise<AIDrillServiceResult> {
    if (!this.config.apiKey) {
      return {
        success: false,
        error: 'OpenAI API key not configured. Please add your API key in Settings.',
      };
    }

    if (!query.trim()) {
      return {
        success: false,
        error: 'Please enter a search query.',
      };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: DRILL_SUGGESTION_SYSTEM_PROMPT,
            },
            {
              role: 'user',
              content: buildDrillQueryPrompt(query, context),
            },
          ],
          max_tokens: this.config.maxTokens,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          return {
            success: false,
            error: 'Invalid API key. Please check your OpenAI API key in Settings.',
          };
        }

        if (response.status === 429) {
          return {
            success: false,
            error: 'Rate limit exceeded. Please try again later.',
          };
        }

        if (response.status === 402) {
          return {
            success: false,
            error: 'Insufficient credits on your OpenAI account.',
          };
        }

        return {
          success: false,
          error: errorData.error?.message || `API error: ${response.status}`,
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return {
          success: false,
          error: 'No response received from AI.',
        };
      }

      const suggestions = parseOpenAIResponse(content);

      if (suggestions.length === 0) {
        return {
          success: false,
          error: 'Could not parse drill suggestions. Please try a different query.',
        };
      }

      return {
        success: true,
        suggestions,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      console.error('DrillAIService error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect to AI service.',
      };
    }
  }

  /**
   * Generate a drill description using AI
   */
  async generateDescription(
    drillName: string,
    category: string,
    sport: string = 'basketball'
  ): Promise<{ success: boolean; description?: string; error?: string }> {
    if (!this.config.apiKey) {
      return {
        success: false,
        error: 'OpenAI API key not configured.',
      };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: `You are a ${sport} coaching expert. Generate clear, concise drill descriptions.`,
            },
            {
              role: 'user',
              content: `Write a brief, practical description for a ${sport} drill called "${drillName}" in the "${category}" category. Include setup, execution, and key coaching points. Keep it under 200 words.`,
            },
          ],
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: 'Failed to generate description.',
        };
      }

      const data = await response.json();
      const description = data.choices?.[0]?.message?.content?.trim();

      return {
        success: true,
        description,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to connect to AI service.',
      };
    }
  }

  /**
   * Suggest drill progressions
   */
  async suggestProgressions(
    drillName: string,
    currentLevel: 'beginner' | 'intermediate' | 'advanced' = 'beginner'
  ): Promise<{ success: boolean; progressions?: string[]; error?: string }> {
    if (!this.config.apiKey) {
      return {
        success: false,
        error: 'OpenAI API key not configured.',
      };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content:
                'You are a sports coaching expert. Suggest drill progressions to increase difficulty.',
            },
            {
              role: 'user',
              content: `Suggest 3 progressions to make the "${drillName}" drill more challenging. Current level: ${currentLevel}. Respond with a JSON array of strings describing each progression.`,
            },
          ],
          max_tokens: 400,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: 'Failed to suggest progressions.',
        };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const progressions = JSON.parse(jsonMatch[0]);
          return {
            success: true,
            progressions,
          };
        }
      } catch {
        // If JSON parsing fails, try to extract list items
        const lines = content
          .split('\n')
          .filter((line: string) => line.trim().match(/^[-\d.]/))
          .map((line: string) => line.replace(/^[-\d.]+\s*/, '').trim());

        if (lines.length > 0) {
          return {
            success: true,
            progressions: lines,
          };
        }
      }

      return {
        success: false,
        error: 'Could not parse progressions.',
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to connect to AI service.',
      };
    }
  }

  /**
   * Validate API key
   */
  static async validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        return { valid: true };
      }

      if (response.status === 401) {
        return { valid: false, error: 'Invalid API key' };
      }

      return { valid: false, error: `API error: ${response.status}` };
    } catch (error) {
      return { valid: false, error: 'Failed to validate API key' };
    }
  }
}

/**
 * Create a DrillAIService instance from user settings
 */
export function createDrillAIService(apiKey: string): DrillAIService {
  return new DrillAIService({ apiKey });
}
