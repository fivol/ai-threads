/**
 * Thread view - the infinite thought stream
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate, useParams } from 'react-router-dom';
import { useStores } from '../stores';
import type { Thought } from '../types';
import { IconBack, IconStar, IconSend, IconSettings, IconEdit, IconTrash, IconSparkles } from './Icons';

interface ThoughtCardProps {
  thought: Thought;
  onToggleSelect: () => void;
  onToggleStar: (e: React.MouseEvent) => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ThoughtCard = observer(function ThoughtCard({
  thought,
  onToggleSelect,
  onToggleStar,
  onEdit,
  onDelete,
}: ThoughtCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<number>();

  const handleTouchStart = () => {
    longPressTimer.current = window.setTimeout(() => {
      setShowMenu(true);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleClick = () => {
    if (!showMenu) {
      onToggleSelect();
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showMenu]);

  return (
    <div
      className={`thought ${thought.selected ? 'selected' : ''}`}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onContextMenu={(e) => {
        e.preventDefault();
        setShowMenu(true);
      }}
    >
      <p className="thought-text">{thought.text}</p>
      <div className="thought-meta">
        <span className="thought-author">{thought.author}</span>
        {thought.edited && <span>edited</span>}
      </div>
      
      <button
        className={`thought-star ${thought.starred ? 'starred' : ''}`}
        onClick={onToggleStar}
      >
        <IconStar filled={thought.starred} />
      </button>

      {showMenu && (
        <div
          ref={menuRef}
          className="modal-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(false);
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Thought Actions</h2>
            </div>
            <div className="modal-body">
              <button
                className="btn btn-secondary"
                style={{ width: '100%', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={() => {
                  setShowMenu(false);
                  onEdit();
                }}
              >
                <IconEdit /> Edit
              </button>
              <button
                className="btn btn-danger"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={() => {
                  setShowMenu(false);
                  onDelete();
                }}
              >
                <IconTrash /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export const ThreadView = observer(function ThreadView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { threadsStore, settingsStore } = useStores();
  
  const [input, setInput] = useState('');
  const [editingThought, setEditingThought] = useState<Thought | null>(null);
  const [editText, setEditText] = useState('');
  
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastScrollTop = useRef(0);
  const isNearBottom = useRef(true);

  // Load thread and thoughts
  useEffect(() => {
    if (id) {
      threadsStore.loadThoughts(id);
    }
  }, [id, threadsStore]);

  // Auto-scroll to bottom when new thoughts appear
  useEffect(() => {
    if (contentRef.current && isNearBottom.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [threadsStore.thoughts.get(id || '')?.length]);

  // Generate title on unmount if needed
  useEffect(() => {
    return () => {
      if (id) {
        threadsStore.generateThreadTitle(id);
      }
    };
  }, [id, threadsStore]);

  const handleScroll = useCallback(() => {
    if (!contentRef.current || !id) return;
    
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const scrollBottom = scrollHeight - scrollTop - clientHeight;
    
    // Track if we're near bottom
    isNearBottom.current = scrollBottom < 100;
    
    // Infinite scroll - generate more when near bottom
    if (scrollBottom < 200 && !threadsStore.isGenerating && settingsStore.isConfigured) {
      // Only generate if we have at least one thought or are explicitly requesting
      const thoughts = threadsStore.thoughts.get(id) || [];
      if (thoughts.length > 0) {
        // Prune old unselected thoughts first
        threadsStore.pruneUnselected(id);
        threadsStore.generateBatch(id);
      }
    }
    
    lastScrollTop.current = scrollTop;
  }, [id, threadsStore, settingsStore.isConfigured]);

  const handleSubmit = async () => {
    if (!input.trim() || !id) return;
    
    const text = input.trim();
    setInput('');
    
    // Focus back on input immediately after clearing
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    
    await threadsStore.addUserThought(id, text);
    
    // Auto-generate after user input if configured
    if (settingsStore.isConfigured) {
      setTimeout(() => {
        threadsStore.generateBatch(id);
      }, 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleEditSave = async () => {
    if (!editingThought || !id) return;
    await threadsStore.editThought(editingThought.id, id, editText);
    setEditingThought(null);
    setEditText('');
  };

  const handleDelete = async (thought: Thought) => {
    if (!id) return;
    if (confirm('Delete this thought?')) {
      await threadsStore.deleteThought(thought.id, id);
    }
  };

  const thread = threadsStore.threads.find(t => t.id === id);
  const thoughts = id ? threadsStore.visibleStream(id) : [];
  const selectedThoughts = thoughts.filter(t => t.selected);
  const unselectedThoughts = thoughts.filter(t => !t.selected);

  if (!thread) {
    return (
      <div className="app">
        <header className="header">
          <button className="header-btn" onClick={() => navigate('/')}>
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
            navigate('/');
          }}
        >
          <IconBack />
        </button>
        <h1 className="header-title">{thread.title}</h1>
        <button className="header-btn" onClick={() => navigate(`/thread/${id}/settings`)}>
          <IconSettings />
        </button>
      </header>

      <div className="content" ref={contentRef} onScroll={handleScroll}>
        {/* Selected thoughts (the thread) */}
        {selectedThoughts.length > 0 && (
          <>
            {selectedThoughts.map(thought => (
              <ThoughtCard
                key={thought.id}
                thought={thought}
                onToggleSelect={() => threadsStore.toggleSelected(thought.id, id!)}
                onToggleStar={(e) => {
                  e.stopPropagation();
                  threadsStore.toggleStarred(thought.id, id!);
                }}
                onEdit={() => {
                  setEditingThought(thought);
                  setEditText(thought.text);
                }}
                onDelete={() => handleDelete(thought)}
              />
            ))}
          </>
        )}

        {/* Divider between selected and candidates */}
        {selectedThoughts.length > 0 && unselectedThoughts.length > 0 && (
          <div className="divider">candidates</div>
        )}

        {/* Unselected thoughts (candidates) */}
        {unselectedThoughts.map(thought => (
          <ThoughtCard
            key={thought.id}
            thought={thought}
            onToggleSelect={() => threadsStore.toggleSelected(thought.id, id!)}
            onToggleStar={(e) => {
              e.stopPropagation();
              threadsStore.toggleStarred(thought.id, id!);
            }}
            onEdit={() => {
              setEditingThought(thought);
              setEditText(thought.text);
            }}
            onDelete={() => handleDelete(thought)}
          />
        ))}

        {/* Loading indicator */}
        {threadsStore.isGenerating && (
          <div className="spinner" />
        )}

        {/* Empty state */}
        {thoughts.length === 0 && !threadsStore.isGenerating && (
          <div className="empty-state">
            <p className="empty-state-title">Start thinking</p>
            <p>Write a thought or tap generate</p>
          </div>
        )}
      </div>

      <div className="footer">
        <div className="input-row">
          <button
            className="header-btn"
            onClick={() => id && threadsStore.generateBatch(id)}
            disabled={threadsStore.isGenerating || !settingsStore.isConfigured}
            title={!settingsStore.isConfigured ? 'Configure API key in settings' : 'Generate thoughts'}
          >
            <IconSparkles />
          </button>
          <div className="input-wrapper">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a thought..."
              rows={1}
            />
          </div>
          <button
            className="send-btn"
            onClick={handleSubmit}
            disabled={!input.trim()}
          >
            <IconSend />
          </button>
        </div>
      </div>

      {/* Edit modal */}
      {editingThought && (
        <div className="modal-overlay" onClick={() => setEditingThought(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Thought</h2>
            </div>
            <div className="modal-body">
              <textarea
                className="settings-textarea"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEditingThought(null)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleEditSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
