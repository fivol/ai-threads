/**
 * Home view - thread list
 */

import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { useStores } from '../stores';
import { IconPlus, IconSettings, IconStar, IconPin, IconTrash, IconExport, IconImport, IconHelp } from './Icons';
import { exportAllData } from '../db';

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  // Less than 24 hours
  if (diff < 86400000) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Less than 7 days
  if (diff < 604800000) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const Home = observer(function Home() {
  const { threadsStore, settingsStore } = useStores();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    threadsStore.loadThreads();
  }, [threadsStore]);

  const handleNewThread = async () => {
    const thread = await threadsStore.createThread();
    navigate(`/thread/${thread.id}`);
  };

  const handleOpenThread = (threadId: string) => {
    navigate(`/thread/${threadId}`);
  };

  const handleDeleteThread = async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    if (confirm('Delete this thread?')) {
      await threadsStore.deleteThread(threadId);
    }
  };

  const handleTogglePin = async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation();
    await threadsStore.togglePinned(threadId);
  };

  const getThoughtCountLabel = (threadId: string) => {
    const count = threadsStore.selectedCounts.get(threadId) ?? 0;
    return `${count} ${count === 1 ? 'thought' : 'thoughts'}`;
  };

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-threads-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await threadsStore.importData(data);
    } catch (error) {
      console.error('Import failed:', error);
    }

    // Reset input
    e.target.value = '';
  };

  if (threadsStore.isLoading) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-btn" />
          <h1 className="header-title">Threads</h1>
          <button className="header-btn" onClick={() => navigate('/settings')}>
            <IconSettings />
          </button>
        </header>
        <div className="content">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      
      <header className="header">
        <button className="header-btn" onClick={() => navigate('/starred')}>
          <IconStar />
        </button>
        <h1 className="header-title">Threads</h1>
        <button className="header-btn" onClick={() => navigate('/settings')}>
          <IconSettings />
        </button>
      </header>
      
      <div className="content content-with-toolbar">
        {threadsStore.threads.length === 0 ? (
          <div className="empty-state">
            <IconPlus />
            <p className="empty-state-title">No threads yet</p>
            <p>Tap the + button to start thinking</p>
          </div>
        ) : (
          <div className="thread-list">
            {/* Pinned threads */}
            {threadsStore.pinnedThreads.length > 0 && (
              <>
                <div className="divider">Pinned</div>
                {threadsStore.pinnedThreads.map(thread => (
                  <div
                    key={thread.id}
                    className="thread-item"
                    onClick={() => handleOpenThread(thread.id)}
                  >
                    <span className="thread-item-pin">
                      <IconPin filled />
                    </span>
                    <div className="thread-item-content">
                      <div className="thread-item-title">{thread.title}</div>
                      <div className="thread-item-meta">
                        {formatDate(thread.updatedAt)} · {getThoughtCountLabel(thread.id)}
                      </div>
                    </div>
                    <div className="thread-item-actions">
                      <button
                        className="thread-action-btn"
                        onClick={(e) => handleTogglePin(e, thread.id)}
                      >
                        <IconPin filled />
                      </button>
                      <button
                        className="thread-action-btn"
                        onClick={(e) => handleDeleteThread(e, thread.id)}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
            
            {/* Unpinned threads */}
            {threadsStore.unpinnedThreads.length > 0 && (
              <>
                {threadsStore.pinnedThreads.length > 0 && (
                  <div className="divider">Recent</div>
                )}
                {threadsStore.unpinnedThreads.map(thread => (
                  <div
                    key={thread.id}
                    className="thread-item"
                    onClick={() => handleOpenThread(thread.id)}
                  >
                    <div className="thread-item-content">
                      <div className="thread-item-title">{thread.title}</div>
                      <div className="thread-item-meta">
                        {formatDate(thread.updatedAt)} · {getThoughtCountLabel(thread.id)}
                      </div>
                    </div>
                    <div className="thread-item-actions">
                      <button
                        className="thread-action-btn"
                        onClick={(e) => handleTogglePin(e, thread.id)}
                      >
                        <IconPin />
                      </button>
                      <button
                        className="thread-action-btn"
                        onClick={(e) => handleDeleteThread(e, thread.id)}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      <div className="toolbar">
        <button className="toolbar-btn toolbar-btn-primary" onClick={handleNewThread} title="New Thread">
          <IconPlus />
        </button>
        <div className="toolbar-divider" />
        <button className="toolbar-btn" onClick={handleExport} title="Export">
          <IconExport />
        </button>
        <button className="toolbar-btn" onClick={handleImport} title="Import">
          <IconImport />
        </button>
        <div className="toolbar-divider" />
        <button className="toolbar-btn" onClick={() => setShowHelp(true)} title="Help">
          <IconHelp />
        </button>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">AI Threads</h2>
              <button className="modal-close" onClick={() => setShowHelp(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="help-description">
                A thinking tool that generates AI-powered thought continuations to help you explore and develop ideas.
              </p>
              
              <div className="help-section">
                <h3>How it works</h3>
                <ul className="help-list">
                  <li>Create a thread and write your initial thought</li>
                  <li>AI generates multiple continuation candidates</li>
                  <li>Select the ones that resonate with you</li>
                  <li>Keep exploring as new candidates appear</li>
                </ul>
              </div>

              <div className="help-section">
                <h3>Features</h3>
                <ul className="help-list">
                  <li><strong>Infinite stream</strong> — scroll down to generate more ideas</li>
                  <li><strong>Smart selection</strong> — choosing a candidate removes skipped ones</li>
                  <li><strong>Regenerate</strong> — tap sparkle button to get fresh candidates</li>
                  <li><strong>Star thoughts</strong> — mark important ideas for later</li>
                  <li><strong>Export/Import</strong> — backup and restore your threads</li>
                  <li><strong>Custom prompts</strong> — set global or per-thread AI instructions</li>
                </ul>
              </div>

              <div className="help-section">
                <h3>Setup</h3>
                <p className="help-text">
                  To use AI generation, configure your API key in settings. 
                  Supports OpenAI and Anthropic (Claude) models.
                </p>
                {!settingsStore.isConfigured && (
                  <button 
                    className="btn btn-primary help-setup-btn"
                    onClick={() => {
                      setShowHelp(false);
                      navigate('/settings');
                    }}
                  >
                    Setup AI Provider
                  </button>
                )}
                {settingsStore.isConfigured && (
                  <p className="help-configured">✓ AI is configured and ready</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
