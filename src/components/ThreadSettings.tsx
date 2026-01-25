/**
 * Thread-specific settings view
 */

import { useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate, useParams } from 'react-router-dom';
import { useStores } from '../stores';
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

export const ThreadSettings = observer(function ThreadSettings() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { threadsStore } = useStores();
  
  const thread = threadsStore.threads.find(t => t.id === id);
  
  const [prompt, setPrompt] = useState(thread?.threadPrompt || '');

  useEffect(() => {
    if (thread) {
      setPrompt(thread.threadPrompt || '');
    }
  }, [thread]);

  const handlePromptBlur = async () => {
    if (id && prompt !== (thread?.threadPrompt || '')) {
      await threadsStore.setThreadPrompt(id, prompt || null);
    }
  };

  if (!thread) {
    return (
      <div className="app">
        <header className="header">
          <button className="header-btn" onClick={() => navigate(-1)}>
            <IconBack />
          </button>
          <h1 className="header-title">Loading...</h1>
          <div className="header-btn" />
        </header>
        <div className="content">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <button
          className="header-btn"
          onClick={async () => {
            if (id) {
              await threadsStore.generateThreadTitle(id);
            }
            navigate(`/thread/${id}`);
          }}
        >
          <IconBack />
        </button>
        <h1 className="header-title">Thread Settings</h1>
        <div className="header-btn" />
      </header>

      <div className="content">
        {/* Thread prompt */}
        <div className="settings-section">
          <label className="settings-label">Thread Prompt</label>
          <textarea
            className="settings-textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onBlur={handlePromptBlur}
            placeholder="Enter a prompt specific to this thread..."
            rows={4}
          />
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
            This prompt will be combined with the global prompt for this thread only.
          </p>
        </div>

        <div className="settings-section">
          <label className="settings-label">Thoughts per Generation</label>
          <div className="model-presets">
            {[3, 5, 7].map((count) => (
              <button
                key={count}
                className={`preset-btn ${thread.generationCount === count ? 'active' : ''}`}
                onClick={() => threadsStore.setGenerationCount(thread.id, count)}
              >
                {count}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
            Used for both manual generate and infinite scroll.
          </p>
        </div>

        {/* Token usage for this thread */}
        <div className="settings-section">
          <label className="settings-label">Thread Token Usage</label>
          <div className="settings-row">
            <span>Input tokens</span>
            <span className="settings-value">{formatTokens(thread.stats.tokensIn)}</span>
          </div>
          <div className="settings-row">
            <span>Output tokens</span>
            <span className="settings-value">{formatTokens(thread.stats.tokensOut)}</span>
          </div>
        </div>

        {/* Thread info */}
        <div className="settings-section">
          <label className="settings-label">Thread Info</label>
          <div className="settings-row">
            <span>Created</span>
            <span className="settings-value">
              {new Date(thread.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="settings-row">
            <span>Last updated</span>
            <span className="settings-value">
              {new Date(thread.updatedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
