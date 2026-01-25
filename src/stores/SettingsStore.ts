/**
 * MobX store for application settings
 */

import { makeAutoObservable, runInAction } from 'mobx';
import type { Settings, AIProvider, AIModel } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { getSettings, saveSettings } from '../db';
import { fetchModels } from '../services/ai';

export class SettingsStore {
  settings: Settings = DEFAULT_SETTINGS;
  availableModels: AIModel[] = [];
  isLoading = false;
  isLoadingModels = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Load settings from IndexedDB
   */
  async load(): Promise<void> {
    this.isLoading = true;
    try {
      const settings = await getSettings();
      runInAction(() => {
        this.settings = settings;
        this.isLoading = false;
      });
      
      // Fetch models if we have an API key
      if (settings.apiKey) {
        await this.loadModels();
      }
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to load settings';
        this.isLoading = false;
      });
    }
  }

  /**
   * Load available models from the current provider
   */
  async loadModels(): Promise<void> {
    if (!this.settings.apiKey) return;
    
    this.isLoadingModels = true;
    try {
      const models = await fetchModels(this.settings.provider, this.settings.apiKey);
      runInAction(() => {
        this.availableModels = models;
        this.isLoadingModels = false;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to load models';
        this.isLoadingModels = false;
      });
    }
  }

  /**
   * Update provider and reload models
   */
  async setProvider(provider: AIProvider): Promise<void> {
    this.settings.provider = provider;
    this.settings.model = ''; // Reset model when provider changes
    await this.persist();
    await this.loadModels();
  }

  /**
   * Update API key and reload models
   */
  async setApiKey(apiKey: string): Promise<void> {
    this.settings.apiKey = apiKey;
    await this.persist();
    if (apiKey) {
      await this.loadModels();
    }
  }

  /**
   * Update selected model
   */
  async setModel(model: string): Promise<void> {
    this.settings.model = model;
    await this.persist();
  }

  /**
   * Update global prompt
   */
  async setGlobalPrompt(prompt: string): Promise<void> {
    this.settings.globalPrompt = prompt;
    await this.persist();
  }

  /**
   * Update max context tokens
   */
  async setMaxContextTokens(tokens: number): Promise<void> {
    this.settings.maxContextTokens = tokens;
    await this.persist();
  }

  /**
   * Track token usage
   */
  async addTokenUsage(tokensIn: number, tokensOut: number): Promise<void> {
    this.settings.totalTokensIn += tokensIn;
    this.settings.totalTokensOut += tokensOut;
    await this.persist();
  }

  /**
   * Persist settings to IndexedDB
   */
  private async persist(): Promise<void> {
    try {
      await saveSettings(this.settings);
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to save settings';
      });
    }
  }

  /**
   * Clear error
   */
  clearError(): void {
    this.error = null;
  }

  /**
   * Get models by tier for quick selection
   */
  get modelsByTier(): { fast: AIModel[]; balanced: AIModel[]; best: AIModel[] } {
    return {
      fast: this.availableModels.filter(m => m.tier === 'fast'),
      balanced: this.availableModels.filter(m => m.tier === 'balanced'),
      best: this.availableModels.filter(m => m.tier === 'best'),
    };
  }

  /**
   * Check if configuration is valid for generation
   */
  get isConfigured(): boolean {
    return Boolean(this.settings.apiKey && this.settings.model);
  }
}
