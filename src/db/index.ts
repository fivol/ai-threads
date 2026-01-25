/**
 * IndexedDB persistence layer using idb library
 */

import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Thread, Thought, Settings } from '../types';
import { DEFAULT_SETTINGS } from '../types';

const DB_NAME = 'ai-threads-db';
const DB_VERSION = 1;

interface ThinkingEngineDB extends DBSchema {
  threads: {
    key: string;
    value: Thread;
    indexes: { 'by-updated': number };
  };
  thoughts: {
    key: string;
    value: Thought;
    indexes: {
      'by-thread': string;
      'by-starred': number;
      'by-thread-order': [string, number];
    };
  };
  settings: {
    key: string;
    value: Settings;
  };
}

let dbInstance: IDBPDatabase<ThinkingEngineDB> | null = null;

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Initialize and return the database connection
 */
export async function getDB(): Promise<IDBPDatabase<ThinkingEngineDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<ThinkingEngineDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Threads store
      if (!db.objectStoreNames.contains('threads')) {
        const threadStore = db.createObjectStore('threads', { keyPath: 'id' });
        threadStore.createIndex('by-updated', 'updatedAt');
      }

      // Thoughts store
      if (!db.objectStoreNames.contains('thoughts')) {
        const thoughtStore = db.createObjectStore('thoughts', { keyPath: 'id' });
        thoughtStore.createIndex('by-thread', 'threadId');
        thoughtStore.createIndex('by-starred', 'starred');
        thoughtStore.createIndex('by-thread-order', ['threadId', 'order']);
      }

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }
    },
  });

  return dbInstance;
}

// Thread operations
export async function getAllThreads(): Promise<Thread[]> {
  const db = await getDB();
  const threads = await db.getAllFromIndex('threads', 'by-updated');
  return threads.reverse(); // Most recent first
}

export async function getThread(id: string): Promise<Thread | undefined> {
  const db = await getDB();
  return db.get('threads', id);
}

export async function saveThread(thread: Thread): Promise<void> {
  const db = await getDB();
  await db.put('threads', toPlain(thread));
}

export async function deleteThread(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['threads', 'thoughts'], 'readwrite');
  
  // Delete thread
  await tx.objectStore('threads').delete(id);
  
  // Delete all thoughts in thread
  const thoughts = await tx.objectStore('thoughts').index('by-thread').getAllKeys(id);
  for (const thoughtId of thoughts) {
    await tx.objectStore('thoughts').delete(thoughtId);
  }
  
  await tx.done;
}

// Thought operations
export async function getThoughtsByThread(threadId: string): Promise<Thought[]> {
  const db = await getDB();
  const thoughts = await db.getAllFromIndex('thoughts', 'by-thread', threadId);
  return thoughts.sort((a, b) => a.order - b.order);
}

export async function getStarredThoughts(): Promise<Thought[]> {
  const db = await getDB();
  const allThoughts = await db.getAll('thoughts');
  return allThoughts.filter(t => t.starred).sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveThought(thought: Thought): Promise<void> {
  const db = await getDB();
  await db.put('thoughts', toPlain(thought));
}

export async function saveThoughts(thoughts: Thought[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('thoughts', 'readwrite');
  for (const thought of thoughts) {
    await tx.store.put(toPlain(thought));
  }
  await tx.done;
}

export async function deleteThought(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('thoughts', id);
}

export async function deleteThoughts(ids: string[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('thoughts', 'readwrite');
  for (const id of ids) {
    await tx.store.delete(id);
  }
  await tx.done;
}

// Settings operations
export async function getSettings(): Promise<Settings> {
  const db = await getDB();
  const settings = await db.get('settings', 'main');
  if (!settings) return DEFAULT_SETTINGS;
  const { id: _id, ...rest } = settings as Settings & { id: string };
  return rest;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await getDB();
  await db.put('settings', toPlain({ ...settings, id: 'main' } as Settings & { id: string }));
}

export async function getThoughtCountByThread(threadId: string): Promise<number> {
  const db = await getDB();
  const count = await db.countFromIndex('thoughts', 'by-thread', threadId);
  return count;
}
