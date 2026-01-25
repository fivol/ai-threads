/**
 * AI provider abstraction for OpenAI and Anthropic (Claude)
 */

import type { AIProvider, AIModel, Thought } from '../types';

// Model presets for quick selection
export const MODEL_PRESETS: Record<AIProvider, { fast: string; balanced: string; best: string }> = {
  openai: {
    fast: 'gpt-4o-mini',
    balanced: 'gpt-4o',
    best: 'gpt-4.1',
  },
  anthropic: {
    fast: 'claude-3-5-haiku-20241022',
    balanced: 'claude-sonnet-4-20250514',
    best: 'claude-opus-4-20250514',
  },
};

/**
 * Fetch available models from the provider
 */
export async function fetchModels(provider: AIProvider, apiKey: string): Promise<AIModel[]> {
  if (!apiKey) return [];

  try {
    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      
      if (!response.ok) throw new Error('Failed to fetch models');
      
      const data = await response.json();
      const chatModels = data.data
        .filter((m: { id: string }) => 
          m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3')
        )
        .map((m: { id: string }) => ({
          id: m.id,
          name: m.id,
          tier: getTier(m.id, 'openai'),
        }));
      
      return chatModels.sort((a: AIModel, b: AIModel) => a.name.localeCompare(b.name));
    }
    
    if (provider === 'anthropic') {
      // Anthropic doesn't have a models endpoint, return known models
      return [
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', tier: 'fast' },
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', tier: 'balanced' },
        { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', tier: 'best' },
      ];
    }
  } catch (error) {
    console.error('Failed to fetch models:', error);
    throw error;
  }

  return [];
}

function getTier(modelId: string, provider: AIProvider): 'fast' | 'balanced' | 'best' {
  const presets = MODEL_PRESETS[provider];
  if (modelId.includes(presets.fast) || modelId.includes('mini') || modelId.includes('haiku')) return 'fast';
  if (modelId.includes(presets.best) || modelId.includes('opus') || modelId.includes('4.1')) return 'best';
  return 'balanced';
}

interface GenerateOptions {
  thoughts: Thought[];
  globalPrompt: string;
  threadPrompt: string | null;
  provider: AIProvider;
  model: string;
  apiKey: string;
  count?: number;
}

interface GenerateResult {
  thoughts: string[];
  tokensIn: number;
  tokensOut: number;
}

/**
 * Build the context string from selected thoughts
 */
function buildContext(thoughts: Thought[]): string {
  return thoughts
    .sort((a, b) => a.order - b.order)
    .map(t => t.text)
    .join('\n\n');
}

/**
 * Build the system prompt
 */
function buildSystemPrompt(
  globalPrompt: string,
  threadPrompt: string | null,
  count: number
): string {
  const parts = [globalPrompt];
  if (threadPrompt) parts.push(threadPrompt);
  parts.push(`
Generate exactly ${count} distinct thought continuations.
Rules:
- One thought per line
- No numbering or bullet points
- No empty lines
- No markdown formatting
- Each thought should be 1-3 sentences
- Thoughts should be diverse: some expanding, some questioning, some branching
- Match the style of the provided thoughts by analogy
- Expand the idea, make it better, and move it forward
`);
  return parts.join('\n\n');
}

/**
 * Parse the AI response into individual thoughts
 */
function parseResponse(text: string, existingTexts: Set<string>): string[] {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => !line.match(/^\d+[\.\)]/)) // Remove numbered lines
    .filter(line => !line.startsWith('-') && !line.startsWith('*')) // Remove bullet points
    .filter(line => !existingTexts.has(line)); // Remove duplicates
  
  return lines;
}

/**
 * Generate new thought candidates using the AI
 */
export async function generateThoughts(options: GenerateOptions): Promise<GenerateResult> {
  const { thoughts, globalPrompt, threadPrompt, provider, model, apiKey, count = 3 } = options;
  
  if (!apiKey || !model) {
    throw new Error('API key and model are required');
  }

  const context = buildContext(thoughts);
  const systemPrompt = buildSystemPrompt(globalPrompt, threadPrompt, count);
  
  const existingTexts = new Set(thoughts.map(t => t.text));

  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: context || 'Start a new line of thinking.' },
        ],
        temperature: 0.9,
        max_completion_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || '';
    const parsed = parseResponse(text, existingTexts);
    
    if (parsed.length === 0) {
      throw new Error('No valid thoughts generated');
    }

    return {
      thoughts: parsed.slice(0, count),
      tokensIn: data.usage?.prompt_tokens || 0,
      tokensOut: data.usage?.completion_tokens || 0,
    };
  }

  if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: context || 'Start a new line of thinking.' },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Anthropic API error');
    }

    const data = await response.json();
    const text = data.content[0]?.text || '';
    const parsed = parseResponse(text, existingTexts);
    
    if (parsed.length === 0) {
      throw new Error('No valid thoughts generated');
    }

    return {
      thoughts: parsed.slice(0, count),
      tokensIn: data.usage?.input_tokens || 0,
      tokensOut: data.usage?.output_tokens || 0,
    };
  }

  throw new Error(`Unknown provider: ${provider}`);
}

/**
 * Generate a title for a thread based on its thoughts
 */
export async function generateTitle(
  thoughts: Thought[],
  provider: AIProvider,
  model: string,
  apiKey: string
): Promise<string> {
  const context = buildContext(thoughts);
  
  const prompt = `Based on these thoughts, generate a concise 3-6 word title that captures the essence of this thinking thread. Return only the title, no quotes or punctuation.

Thoughts:
${context}`;

  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_completion_tokens: 50,
      }),
    });

    if (!response.ok) throw new Error('Failed to generate title');
    
    const data = await response.json();
    return data.choices[0]?.message?.content?.trim() || 'Untitled';
  }

  if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 50,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error('Failed to generate title');
    
    const data = await response.json();
    return data.content[0]?.text?.trim() || 'Untitled';
  }

  return 'Untitled';
}

export async function testModelConnection(
  provider: AIProvider,
  apiKey: string,
  model: string
): Promise<{ ok: boolean; message: string }> {
  if (!apiKey || !model) {
    return { ok: false, message: 'API key and model are required.' };
  }

  try {
    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Say ok.' }],
          temperature: 0,
          max_completion_tokens: 5,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { ok: false, message: error.error?.message || 'OpenAI API error' };
      }

      return { ok: true, message: 'Connection successful.' };
    }

    if (provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Say ok.' }],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { ok: false, message: error.error?.message || 'Anthropic API error' };
      }

      return { ok: true, message: 'Connection successful.' };
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Connection failed.',
    };
  }

  return { ok: false, message: 'Unknown provider.' };
}
