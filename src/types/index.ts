/**
 * Core data types for the thinking engine
 */

export interface Thought {
  id: string;
  threadId: string;
  author: 'user' | 'ai';
  text: string;
  createdAt: number;
  selected: boolean;
  starred: boolean;
  edited: boolean;
  order: number;
}

export interface Thread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  threadPrompt: string | null;
  generationCount: number;
  stats: {
    tokensIn: number;
    tokensOut: number;
  };
}

export type AIProvider = 'openai' | 'anthropic';

export interface Settings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  globalPrompt: string;
  maxContextTokens: number;
  totalTokensIn: number;
  totalTokensOut: number;
}

export interface AIModel {
  id: string;
  name: string;
  tier: 'fast' | 'balanced' | 'best';
}

export const DEFAULT_SETTINGS: Settings = {
  provider: 'openai',
  apiKey: '',
  model: '',
  globalPrompt: 'You are helping the user develop their thoughts. Generate diverse, thought-provoking continuations.',
  maxContextTokens: 8000,
  totalTokensIn: 0,
  totalTokensOut: 0,
};
