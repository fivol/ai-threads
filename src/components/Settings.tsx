/**
 * Global settings view
 */

import { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { useStores } from '../stores';
import type { AIProvider } from '../types';
import { MODEL_PRESETS, testModelConnection } from '../services/ai';
import { IconBack } from './Icons';

function formatTokens(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(2)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

export const Settings = observer(function Settings() {
  const navigate = useNavigate();
  const { settingsStore } = useStores();
  const { settings, availableModels, isLoadingModels } = settingsStore;

  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [globalPrompt, setGlobalPrompt] = useState(settings.globalPrompt);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    setApiKey(settings.apiKey);
    setGlobalPrompt(settings.globalPrompt);
  }, [settings.apiKey, settings.globalPrompt]);

  const handleProviderChange = async (provider: AIProvider) => {
    await settingsStore.setProvider(provider);
  };

  const handleApiKeyBlur = async () => {
    if (apiKey !== settings.apiKey) {
      await settingsStore.setApiKey(apiKey);
    }
  };

  const handleGlobalPromptBlur = async () => {
    if (globalPrompt !== settings.globalPrompt) {
      await settingsStore.setGlobalPrompt(globalPrompt);
    }
  };

  const handleModelChange = async (model: string) => {
    await settingsStore.setModel(model);
  };

  const handlePresetClick = async (tier: 'fast' | 'balanced' | 'best') => {
    const preset = MODEL_PRESETS[settings.provider][tier];
    await settingsStore.setModel(preset);
  };

  const handleMaxTokensChange = async (tokens: number) => {
    await settingsStore.setMaxContextTokens(tokens);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    const result = await testModelConnection(
      settings.provider,
      settings.apiKey,
      settings.model
    );
    setTestResult(result);
    setIsTesting(false);
  };

  return (
    <div className="app">
      <header className="header">
        <button className="header-btn" onClick={() => navigate('/')}>
          <IconBack />
        </button>
        <h1 className="header-title">Settings</h1>
        <div className="header-btn" />
      </header>

      <div className="content">
        {/* Provider selection */}
        <div className="settings-section">
          <label className="settings-label">Provider</label>
          <div className="model-presets">
            <button
              className={`preset-btn ${settings.provider === 'openai' ? 'active' : ''}`}
              onClick={() => handleProviderChange('openai')}
            >
              OpenAI
            </button>
            <button
              className={`preset-btn ${settings.provider === 'anthropic' ? 'active' : ''}`}
              onClick={() => handleProviderChange('anthropic')}
            >
              Anthropic
            </button>
          </div>
        </div>

        {/* API Key */}
        <div className="settings-section">
          <label className="settings-label">API Key</label>
          <input
            type="password"
            className="settings-input"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onBlur={handleApiKeyBlur}
            placeholder={`Enter your ${settings.provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key`}
          />
        </div>

        {/* Model selection */}
        <div className="settings-section">
          <label className="settings-label">Model</label>
          
          {/* Quick presets */}
          <div className="model-presets">
            <button
              className={`preset-btn ${settings.model === MODEL_PRESETS[settings.provider].fast ? 'active' : ''}`}
              onClick={() => handlePresetClick('fast')}
            >
              Fast
            </button>
            <button
              className={`preset-btn ${settings.model === MODEL_PRESETS[settings.provider].balanced ? 'active' : ''}`}
              onClick={() => handlePresetClick('balanced')}
            >
              Balanced
            </button>
            <button
              className={`preset-btn ${settings.model === MODEL_PRESETS[settings.provider].best ? 'active' : ''}`}
              onClick={() => handlePresetClick('best')}
            >
              Best
            </button>
          </div>

          {/* Model dropdown */}
          <select
            className="settings-select"
            value={settings.model}
            onChange={(e) => handleModelChange(e.target.value)}
            disabled={isLoadingModels}
          >
            <option value="">Select a model...</option>
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          
          {isLoadingModels && (
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
              Loading models...
            </p>
          )}

          <div style={{ marginTop: '12px' }}>
            <button
              className="btn btn-secondary"
              onClick={handleTestConnection}
              disabled={isTesting}
            >
              {isTesting ? 'Checking...' : 'Check API Key & Model'}
            </button>
          </div>
        </div>

        {/* Max context tokens */}
        <div className="settings-section">
          <label className="settings-label">Max Context Tokens</label>
          <div className="model-presets">
            <button
              className={`preset-btn ${settings.maxContextTokens === 8000 ? 'active' : ''}`}
              onClick={() => handleMaxTokensChange(8000)}
            >
              8K
            </button>
            <button
              className={`preset-btn ${settings.maxContextTokens === 16000 ? 'active' : ''}`}
              onClick={() => handleMaxTokensChange(16000)}
            >
              16K
            </button>
            <button
              className={`preset-btn ${settings.maxContextTokens === 0 ? 'active' : ''}`}
              onClick={() => handleMaxTokensChange(0)}
            >
              Unlimited
            </button>
          </div>
        </div>

        {/* Global prompt */}
        <div className="settings-section">
          <label className="settings-label">Global Prompt</label>
          <textarea
            className="settings-textarea"
            value={globalPrompt}
            onChange={(e) => setGlobalPrompt(e.target.value)}
            onBlur={handleGlobalPromptBlur}
            placeholder="Enter a global system prompt..."
            rows={4}
          />
        </div>

        {/* Token usage */}
        <div className="settings-section">
          <label className="settings-label">Total Token Usage</label>
          <div className="settings-row">
            <span>Input tokens</span>
            <span className="settings-value">{formatTokens(settings.totalTokensIn)}</span>
          </div>
          <div className="settings-row">
            <span>Output tokens</span>
            <span className="settings-value">{formatTokens(settings.totalTokensOut)}</span>
          </div>
        </div>
      </div>

      {testResult && (
        <div className="modal-overlay" onClick={() => setTestResult(null)}>
          <div
            className={`modal ${testResult.ok ? 'modal-success' : 'modal-error'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">
                {testResult.ok ? 'Connection OK' : 'Connection Failed'}
              </h2>
            </div>
            <div className="modal-body">
              <p>{testResult.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setTestResult(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
