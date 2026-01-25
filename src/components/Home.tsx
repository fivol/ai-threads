/**
 * Home view - thread list
 */

import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { useStores } from '../stores';
import { IconPlus, IconSettings, IconStar, IconPin, IconTrash } from './Icons';

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
  const { threadsStore } = useStores();
  const navigate = useNavigate();

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
    const count = threadsStore.threadCounts.get(threadId) ?? 0;
    return `${count} ${count === 1 ? 'thought' : 'thoughts'}`;
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
      <header className="header">
        <button className="header-btn" onClick={() => navigate('/starred')}>
          <IconStar />
        </button>
        <h1 className="header-title">Threads</h1>
        <button className="header-btn" onClick={() => navigate('/settings')}>
          <IconSettings />
        </button>
      </header>
      
      <div className="content">
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

      <button className="new-thread-btn" onClick={handleNewThread}>
        <IconPlus />
      </button>
    </div>
  );
});
