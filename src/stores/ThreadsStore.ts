/**
 * MobX store for threads and thoughts management
 */

import { makeAutoObservable, runInAction } from 'mobx';
import { v4 as uuid } from 'uuid';
import type { Thread, Thought } from '../types';
import {
  getAllThreads,
  getThread,
  saveThread,
  deleteThread as dbDeleteThread,
  getThoughtsByThread,
  getThoughtCountByThread,
  getSelectedThoughtCountByThread,
  getStarredThoughts,
  saveThought,
  saveThoughts,
  deleteThought as dbDeleteThought,
  deleteThoughts,
} from '../db';
import { generateThoughts, generateTitle } from '../services/ai';
import { SettingsStore } from './SettingsStore';

export class ThreadsStore {
  threads: Thread[] = [];
  thoughts: Map<string, Thought[]> = new Map();
  starredThoughts: Thought[] = [];
  currentThreadId: string | null = null;
  threadCounts: Map<string, number> = new Map();
  selectedCounts: Map<string, number> = new Map();
  
  isLoading = false;
  isGenerating = false;
  error: string | null = null;

  private settingsStore: SettingsStore;
  private abortController: AbortController | null = null;

  constructor(settingsStore: SettingsStore) {
    this.settingsStore = settingsStore;
    makeAutoObservable(this);
  }

  /**
   * Load all threads from IndexedDB
   */
  async loadThreads(): Promise<void> {
    this.isLoading = true;
    try {
      const threads = await getAllThreads();
      const normalizedThreads = threads.map(thread => ({
        ...thread,
        generationCount: thread.generationCount ?? 3,
      }));
      runInAction(() => {
        this.threads = normalizedThreads;
        this.isLoading = false;
      });

      await Promise.all(
        normalizedThreads.map(async (thread) => {
          const [count, selectedCount] = await Promise.all([
            getThoughtCountByThread(thread.id),
            getSelectedThoughtCountByThread(thread.id),
          ]);
          runInAction(() => {
            this.threadCounts.set(thread.id, count);
            this.selectedCounts.set(thread.id, selectedCount);
          });
          if (thread.generationCount === undefined) {
            await saveThread(thread);
          }
        })
      );
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to load threads';
        this.isLoading = false;
      });
    }
  }

  /**
   * Load thoughts for a specific thread
   */
  async loadThoughts(threadId: string): Promise<void> {
    try {
      const thoughts = await getThoughtsByThread(threadId);
      runInAction(() => {
        this.thoughts.set(threadId, thoughts);
        this.threadCounts.set(threadId, thoughts.length);
        this.selectedCounts.set(threadId, thoughts.filter(t => t.selected).length);
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to load thoughts';
      });
    }
  }

  /**
   * Load starred thoughts
   */
  async loadStarredThoughts(): Promise<void> {
    try {
      const starred = await getStarredThoughts();
      runInAction(() => {
        this.starredThoughts = starred;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to load starred thoughts';
      });
    }
  }

  /**
   * Create a new thread
   */
  async createThread(): Promise<Thread> {
    const thread: Thread = {
      id: uuid(),
      title: 'Untitled',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
      threadPrompt: null,
      generationCount: 3,
      stats: { tokensIn: 0, tokensOut: 0 },
    };

    await saveThread(thread);
    runInAction(() => {
      this.threads.unshift(thread);
      this.thoughts.set(thread.id, []);
      this.threadCounts.set(thread.id, 0);
      this.selectedCounts.set(thread.id, 0);
    });

    return thread;
  }

  /**
   * Delete a thread and all its thoughts
   */
  async deleteThread(threadId: string): Promise<void> {
    await dbDeleteThread(threadId);
    runInAction(() => {
      this.threads = this.threads.filter(t => t.id !== threadId);
      this.thoughts.delete(threadId);
      this.threadCounts.delete(threadId);
      this.selectedCounts.delete(threadId);
    });
  }

  /**
   * Toggle thread pinned status
   */
  async togglePinned(threadId: string): Promise<void> {
    const thread = this.threads.find(t => t.id === threadId);
    if (!thread) return;

    thread.pinned = !thread.pinned;
    thread.updatedAt = Date.now();
    await saveThread(thread);
  }

  /**
   * Update thread prompt
   */
  async setThreadPrompt(threadId: string, prompt: string | null): Promise<void> {
    const thread = this.threads.find(t => t.id === threadId);
    if (!thread) return;

    thread.threadPrompt = prompt;
    thread.updatedAt = Date.now();
    await saveThread(thread);
  }

  async setGenerationCount(threadId: string, count: number): Promise<void> {
    const thread = this.threads.find(t => t.id === threadId);
    if (!thread) return;

    thread.generationCount = count;
    thread.updatedAt = Date.now();
    await saveThread(thread);
  }

  /**
   * Add a user thought to a thread
   */
  async addUserThought(threadId: string, text: string): Promise<Thought> {
    const threadThoughts = this.thoughts.get(threadId) || [];
    const maxOrder = threadThoughts.length > 0 
      ? Math.max(...threadThoughts.map(t => t.order)) 
      : -1;

    const thought: Thought = {
      id: uuid(),
      threadId,
      author: 'user',
      text: text.trim(),
      createdAt: Date.now(),
      selected: true, // User thoughts are selected by default
      starred: false,
      edited: false,
      order: maxOrder + 1,
    };

    await saveThought(thought);
    runInAction(() => {
      const thoughts = this.thoughts.get(threadId) || [];
      thoughts.push(thought);
      this.thoughts.set(threadId, thoughts);
      this.threadCounts.set(threadId, thoughts.length);
      // User thoughts are selected by default
      this.selectedCounts.set(threadId, (this.selectedCounts.get(threadId) || 0) + 1);
    });

    // Update thread timestamp
    const thread = this.threads.find(t => t.id === threadId);
    if (thread) {
      thread.updatedAt = Date.now();
      await saveThread(thread);
    }

    return thought;
  }

  /**
   * Toggle thought selection.
   * When selecting a candidate, delete all unselected candidates BEFORE it
   * (user has seen them and didn't select them).
   */
  async toggleSelected(thoughtId: string, threadId: string): Promise<void> {
    const thoughts = this.thoughts.get(threadId);
    const thought = thoughts?.find(t => t.id === thoughtId);
    if (!thought) return;

    const wasSelected = thought.selected;
    thought.selected = !thought.selected;
    await saveThought(thought);

    // Update selected count
    const selectedDelta = thought.selected ? 1 : -1;
    this.selectedCounts.set(threadId, (this.selectedCounts.get(threadId) || 0) + selectedDelta);

    // If we just selected a candidate (AI thought), delete all unselected candidates before it
    if (!wasSelected && thought.author === 'ai') {
      const unselectedBefore = thoughts!.filter(
        t => !t.selected && t.author === 'ai' && t.order < thought.order
      );

      if (unselectedBefore.length > 0) {
        const idsToDelete = unselectedBefore.map(t => t.id);
        await deleteThoughts(idsToDelete);
        
        runInAction(() => {
          const filtered = thoughts!.filter(t => !idsToDelete.includes(t.id));
          this.thoughts.set(threadId, filtered);
          this.threadCounts.set(threadId, filtered.length);
        });
      }
    }
  }

  /**
   * Toggle thought starred status
   */
  async toggleStarred(thoughtId: string, threadId: string): Promise<void> {
    const thoughts = this.thoughts.get(threadId);
    const thought = thoughts?.find(t => t.id === thoughtId);
    if (!thought) return;

    thought.starred = !thought.starred;
    await saveThought(thought);

    // Update starred thoughts cache
    await this.loadStarredThoughts();
  }

  /**
   * Edit a thought's text
   */
  async editThought(thoughtId: string, threadId: string, newText: string): Promise<void> {
    const thoughts = this.thoughts.get(threadId);
    const thought = thoughts?.find(t => t.id === thoughtId);
    if (!thought) return;

    thought.text = newText.trim();
    thought.edited = true;
    await saveThought(thought);
  }

  /**
   * Delete a thought
   */
  async deleteThought(thoughtId: string, threadId: string): Promise<void> {
    const thoughts = this.thoughts.get(threadId);
    const thought = thoughts?.find(t => t.id === thoughtId);
    const wasSelected = thought?.selected || false;

    await dbDeleteThought(thoughtId);
    runInAction(() => {
      if (thoughts) {
        const index = thoughts.findIndex(t => t.id === thoughtId);
        if (index !== -1) {
          thoughts.splice(index, 1);
        }
        this.threadCounts.set(threadId, thoughts.length);
        if (wasSelected) {
          this.selectedCounts.set(threadId, Math.max(0, (this.selectedCounts.get(threadId) || 0) - 1));
        }
      }
    });
  }

  /**
   * Cancel any ongoing generation
   */
  cancelGeneration(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      runInAction(() => {
        this.isGenerating = false;
      });
    }
  }

  /**
   * Generate new AI thought candidates
   * @param regenerate - if true, delete existing unselected candidates before generating
   */
  async generateBatch(threadId: string, regenerate = false): Promise<void> {
    if (this.isGenerating) return;
    if (!this.settingsStore.isConfigured) {
      this.error = 'Please configure API key and model in settings';
      return;
    }

    const thread = this.threads.find(t => t.id === threadId);
    if (!thread) return;

    let thoughts = this.thoughts.get(threadId) || [];

    // If regenerating, delete all existing unselected AI candidates first
    if (regenerate) {
      const unselectedCandidates = thoughts.filter(t => t.author === 'ai' && !t.selected);
      if (unselectedCandidates.length > 0) {
        const idsToDelete = unselectedCandidates.map(t => t.id);
        await deleteThoughts(idsToDelete);
        
        thoughts = thoughts.filter(t => !idsToDelete.includes(t.id));
        runInAction(() => {
          this.thoughts.set(threadId, thoughts);
          this.threadCounts.set(threadId, thoughts.length);
        });
      }
    }

    const selectedThoughts = thoughts.filter(t => t.selected);

    // Create new AbortController for this request
    this.abortController = new AbortController();
    
    this.isGenerating = true;
    this.error = null;

    try {
      const result = await generateThoughts({
        thoughts: selectedThoughts,
        globalPrompt: this.settingsStore.settings.globalPrompt,
        threadPrompt: thread.threadPrompt,
        provider: this.settingsStore.settings.provider,
        model: this.settingsStore.settings.model,
        apiKey: this.settingsStore.settings.apiKey,
        count: thread.generationCount ?? 3,
        signal: this.abortController.signal,
      });

      const maxOrder = thoughts.length > 0 
        ? Math.max(...thoughts.map(t => t.order)) 
        : -1;

      const newThoughts: Thought[] = result.thoughts.map((text, i) => ({
        id: uuid(),
        threadId,
        author: 'ai' as const,
        text,
        createdAt: Date.now(),
        selected: false,
        starred: false,
        edited: false,
        order: maxOrder + 1 + i,
      }));

      await saveThoughts(newThoughts);

      // Update token stats
      thread.stats.tokensIn += result.tokensIn;
      thread.stats.tokensOut += result.tokensOut;
      thread.updatedAt = Date.now();
      await saveThread(thread);
      await this.settingsStore.addTokenUsage(result.tokensIn, result.tokensOut);

      runInAction(() => {
        const currentThoughts = this.thoughts.get(threadId) || [];
        currentThoughts.push(...newThoughts);
        this.thoughts.set(threadId, currentThoughts);
        this.threadCounts.set(threadId, currentThoughts.length);
        this.isGenerating = false;
      });
    } catch (error) {
      // Don't show error if request was cancelled
      if (error instanceof Error && error.name === 'AbortError') {
        runInAction(() => {
          this.isGenerating = false;
        });
        return;
      }
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Generation failed';
        this.isGenerating = false;
      });
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Check if there are existing unselected AI candidates in the thread
   */
  hasUnselectedCandidates(threadId: string): boolean {
    const thoughts = this.thoughts.get(threadId) || [];
    return thoughts.some(t => t.author === 'ai' && !t.selected);
  }

  /**
   * Prune unselected AI thoughts (garbage collection)
   * Keeps only selected thoughts and the most recent batch of unselected AI thoughts
   */
  async pruneUnselected(threadId: string): Promise<void> {
    const thoughts = this.thoughts.get(threadId);
    if (!thoughts) return;

    // Find unselected AI thoughts that are not in the most recent batch
    const unselectedAI = thoughts
      .filter(t => t.author === 'ai' && !t.selected)
      .slice()
      .sort((a, b) => b.order - a.order);

    // Keep the most recent 5 unselected AI thoughts, delete the rest
    const toDelete = unselectedAI.slice(5);
    if (toDelete.length === 0) return;

    const deleteIds = toDelete.map(t => t.id);
    await deleteThoughts(deleteIds);

    runInAction(() => {
      const filtered = thoughts.filter(t => !deleteIds.includes(t.id));
      this.thoughts.set(threadId, filtered);
      this.threadCounts.set(threadId, filtered.length);
    });
  }

  /**
   * Generate title for a thread based on selected thoughts
   */
  async generateThreadTitle(threadId: string): Promise<void> {
    const thread = this.threads.find(t => t.id === threadId);
    if (!thread || thread.title !== 'Untitled') return;
    if (!this.settingsStore.isConfigured) return;

    const thoughts = this.thoughts.get(threadId) || [];
    const selectedThoughts = thoughts.filter(t => t.selected);
    if (selectedThoughts.length === 0) return;

    try {
      const title = await generateTitle(
        selectedThoughts,
        this.settingsStore.settings.provider,
        this.settingsStore.settings.model,
        this.settingsStore.settings.apiKey
      );

      runInAction(() => {
        thread.title = title;
      });
      await saveThread(thread);
    } catch (error) {
      // Silently fail - title generation is not critical
      console.error('Failed to generate title:', error);
    }
  }

  /**
   * Get selected thoughts for a thread
   */
  selectedThoughts(threadId: string): Thought[] {
    const thoughts = this.thoughts.get(threadId) || [];
    return thoughts
      .filter(t => t.selected)
      .slice()
      .sort((a, b) => a.order - b.order);
  }

  /**
   * Get the visible stream for a thread (selected + recent unselected)
   */
  visibleStream(threadId: string): Thought[] {
    const thoughts = this.thoughts.get(threadId) || [];
    return thoughts.slice().sort((a, b) => a.order - b.order);
  }

  /**
   * Clear error
   */
  clearError(): void {
    this.error = null;
  }

  /**
   * Get current thread
   */
  get currentThread(): Thread | undefined {
    return this.threads.find(t => t.id === this.currentThreadId);
  }

  /**
   * Get pinned threads
   */
  get pinnedThreads(): Thread[] {
    return this.threads.filter(t => t.pinned);
  }

  /**
   * Get unpinned threads
   */
  get unpinnedThreads(): Thread[] {
    return this.threads.filter(t => !t.pinned);
  }

  /**
   * Import data from exported JSON
   */
  async importData(data: {
    threads: Array<{
      id: string;
      title: string;
      createdAt: number;
      updatedAt: number;
      pinned: boolean;
      threadPrompt: string | null;
      thoughts: Array<{
        id: string;
        author: 'user' | 'ai';
        text: string;
        createdAt: number;
        starred: boolean;
        edited: boolean;
        order: number;
      }>;
    }>;
  }): Promise<void> {
    if (!data.threads || !Array.isArray(data.threads)) {
      throw new Error('Invalid import data');
    }

    for (const threadData of data.threads) {
      // Create thread
      const thread: Thread = {
        id: uuid(),
        title: threadData.title,
        createdAt: threadData.createdAt || Date.now(),
        updatedAt: threadData.updatedAt || Date.now(),
        pinned: threadData.pinned || false,
        threadPrompt: threadData.threadPrompt || null,
        generationCount: 3,
        stats: { tokensIn: 0, tokensOut: 0 },
      };

      await saveThread(thread);

      // Create thoughts
      const thoughts: Thought[] = (threadData.thoughts || []).map((t, i) => ({
        id: uuid(),
        threadId: thread.id,
        author: t.author,
        text: t.text,
        createdAt: t.createdAt || Date.now(),
        selected: true, // All imported thoughts are selected
        starred: t.starred || false,
        edited: t.edited || false,
        order: t.order ?? i,
      }));

      if (thoughts.length > 0) {
        await saveThoughts(thoughts);
      }

      runInAction(() => {
        this.threads.unshift(thread);
        this.thoughts.set(thread.id, thoughts);
        this.threadCounts.set(thread.id, thoughts.length);
        this.selectedCounts.set(thread.id, thoughts.length);
      });
    }
  }
}
