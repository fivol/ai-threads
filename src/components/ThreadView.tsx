/**
 * Thread view - the infinite thought stream
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate, useParams } from 'react-router-dom';
import { useStores } from '../stores';
import type { Thought } from '../types';
import { IconBack, IconStar, IconSend, IconSettings, IconEdit, IconTrash, IconSparkles, IconClose } from './Icons';

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
  const longPressTimer = useRef<number | undefined>(undefined);

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
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const lastScrollTop = useRef(0);
  const isNearBottom = useRef(true);
  const candidatesDividerRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);
  const thoughtsLoaded = useRef(false);

  // Load thread and thoughts, focus input
  useEffect(() => {
    if (id) {
      initialScrollDone.current = false;
      thoughtsLoaded.current = false;
      threadsStore.loadThoughts(id).then(() => {
        thoughtsLoaded.current = true;
      });
      // Focus textarea when entering thread
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [id, threadsStore]);

  // On initial load, scroll to the beginning of candidates (end of selected)
  useEffect(() => {
    if (!contentRef.current || initialScrollDone.current) return;
    
    const thoughts = threadsStore.thoughts.get(id || '') || [];
    if (thoughts.length === 0) return;
    
    const selected = thoughts.filter(t => t.selected);
    const unselected = thoughts.filter(t => !t.selected);
    
    // Wait a bit for DOM to render
    requestAnimationFrame(() => {
      if (selected.length > 0 && unselected.length > 0 && candidatesDividerRef.current) {
        // Scroll to the divider (beginning of candidates)
        candidatesDividerRef.current.scrollIntoView({ block: 'start' });
      } else if (selected.length === 0 && unselected.length > 0) {
        // Only candidates exist, scroll to top
        contentRef.current!.scrollTop = 0;
      } else {
        // Only selected (or empty), scroll to bottom
        contentRef.current!.scrollTop = contentRef.current!.scrollHeight;
      }
      initialScrollDone.current = true;
    });
  }, [id, threadsStore.thoughts.get(id || '')?.length]);

  // Note: We intentionally don't auto-scroll when new thoughts are generated.
  // The loader is replaced by new thoughts in place, keeping the scroll position static.

  // Cleanup on unmount: cancel generation, delete empty thread, generate title async
  useEffect(() => {
    return () => {
      // Cancel any ongoing generation when leaving the thread
      threadsStore.cancelGeneration();
      
      if (id && thoughtsLoaded.current) {
        // Only check for empty thread if thoughts were actually loaded
        const thoughts = threadsStore.thoughts.get(id) || [];
        const selectedCount = thoughts.filter(t => t.selected).length;
        
        if (selectedCount === 0) {
          // Delete empty thread
          threadsStore.deleteThread(id);
        } else {
          // Generate title asynchronously (don't block)
          threadsStore.generateThreadTitle(id);
        }
      }
    };
  }, [id, threadsStore]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    const lineHeight = 24; // approx line height
    const maxHeight = lineHeight * 4; // max 4 lines
    textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
  };

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
    
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    
    // Focus back on input immediately after clearing
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    
    await threadsStore.addUserThought(id, text);
    
    // Regenerate candidates after user input (delete existing and create new)
    if (settingsStore.isConfigured) {
      setTimeout(() => {
        threadsStore.generateBatch(id, true); // regenerate = true
      }, 300);
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

  const handleTitleClick = () => {
    if (thread) {
      setTitleInput(thread.title === 'Untitled' ? '' : thread.title);
      setEditingTitle(true);
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  };

  const handleTitleSave = async () => {
    if (!id || !thread) return;
    const newTitle = titleInput.trim() || 'Untitled';
    thread.title = newTitle;
    setEditingTitle(false);
    // Save to db
    const { saveThread } = await import('../db');
    await saveThread(thread);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setEditingTitle(false);
    }
  };

  const thread = threadsStore.threads.find(t => t.id === id);
  const thoughts = id ? threadsStore.visibleStream(id) : [];
  const selectedThoughts = thoughts.filter(t => t.selected);
  const unselectedThoughts = thoughts.filter(t => !t.selected);

  // If thread not found, redirect to home (don't show loading state)
  useEffect(() => {
    if (!thread && id) {
      // Thread not found - might be deleted or invalid id
      // Wait a moment in case threads are still loading, then redirect
      const timer = setTimeout(() => {
        if (!threadsStore.threads.find(t => t.id === id)) {
          navigate('/');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [thread, id, navigate, threadsStore.threads]);

  if (!thread) {
    // Show minimal loading state while checking
    return (
      <div className="app">
        <header className="header">
          <button className="header-btn" onClick={() => navigate('/')}>
            <IconBack />
          </button>
          <h1 className="header-title"></h1>
          <div className="header-btn" />
        </header>
        <div className="content" />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <button
          className="header-btn"
          onClick={() => navigate('/')}
        >
          <IconBack />
        </button>
        {editingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            className="header-title-input"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={handleTitleKeyDown}
            placeholder="Thread title..."
          />
        ) : (
          <h1 
            className="header-title header-title-clickable" 
            onClick={handleTitleClick}
            title="Click to edit"
          >
            {thread.title}
          </h1>
        )}
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
          <div ref={candidatesDividerRef} className="divider">candidates</div>
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

        {/* Loading indicator with cancel on hover */}
        {threadsStore.isGenerating && (
          <div 
            className="generation-loader"
            onClick={() => threadsStore.cancelGeneration()}
            title="Click to cancel"
          >
            <div className="spinner-icon" />
            <div className="cancel-icon">
              <IconClose />
            </div>
          </div>
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
            onClick={() => {
              if (!id) return;
              // If there are existing candidates, regenerate (delete them and create new)
              const shouldRegenerate = threadsStore.hasUnselectedCandidates(id);
              threadsStore.generateBatch(id, shouldRegenerate);
            }}
            disabled={threadsStore.isGenerating || !settingsStore.isConfigured}
            title={!settingsStore.isConfigured ? 'Configure API key in settings' : 'Generate thoughts'}
          >
            <IconSparkles />
          </button>
          <div className="input-wrapper">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
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
