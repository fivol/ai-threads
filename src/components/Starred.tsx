/**
 * Starred thoughts view
 */

import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { useStores } from '../stores';
import { IconBack, IconStar } from './Icons';

export const Starred = observer(function Starred() {
  const navigate = useNavigate();
  const { threadsStore } = useStores();

  useEffect(() => {
    threadsStore.loadStarredThoughts();
  }, [threadsStore]);

  // Group starred thoughts by thread
  const groupedByThread = threadsStore.starredThoughts.reduce((acc, thought) => {
    if (!acc[thought.threadId]) {
      acc[thought.threadId] = [];
    }
    acc[thought.threadId].push(thought);
    return acc;
  }, {} as Record<string, typeof threadsStore.starredThoughts>);

  // Get thread titles
  const getThreadTitle = (threadId: string) => {
    const thread = threadsStore.threads.find(t => t.id === threadId);
    return thread?.title || 'Unknown Thread';
  };

  return (
    <div className="app">
      <header className="header">
        <button className="header-btn" onClick={() => navigate('/')}>
          <IconBack />
        </button>
        <h1 className="header-title">Starred</h1>
        <div className="header-btn" />
      </header>

      <div className="content">
        {threadsStore.starredThoughts.length === 0 ? (
          <div className="empty-state">
            <IconStar />
            <p className="empty-state-title">No starred thoughts</p>
            <p>Star thoughts to save them here</p>
          </div>
        ) : (
          Object.entries(groupedByThread).map(([threadId, thoughts]) => (
            <div key={threadId} className="starred-section">
              <div className="starred-thread-title">{getThreadTitle(threadId)}</div>
              {thoughts.map(thought => (
                <div
                  key={thought.id}
                  className="thought"
                  onClick={() => navigate(`/thread/${threadId}`)}
                >
                  <p className="thought-text">{thought.text}</p>
                  <div className="thought-meta">
                    <span className="thought-author">{thought.author}</span>
                  </div>
                  <button
                    className="thought-star starred"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await threadsStore.toggleStarred(thought.id, threadId);
                    }}
                  >
                    <IconStar filled />
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
});
