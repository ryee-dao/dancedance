/**
 * Local beat-map cache.
 *
 * Keyed by YouTube video ID, or for dropped files by `fileKey()` (name + size
 * + lastModified). Better maps replace worse ones (see `isBetterMap`).
 *
 * Backed by IndexedDB; if IndexedDB is missing or fails (private windows,
 * blocked site data, quota), it silently falls back to an in-memory map for
 * the rest of the session.
 */
import { parse, serialize, shouldReplace, type BeatMap } from '../core/analysis';
import { noteCachedBpm } from './bpmIndex';
import { mapCoverageEnd } from './timeline';

/** Minimal async key-value store (IndexedDB, memory, or a test fake). */
export interface KVStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

interface Entry {
  json: string;
  savedAt: number;
}

/**
 * Cache policy. `shouldReplace` decides (complete beats partial, then
 * cloud > device > file > tab > mic); on top of that, between two partial
 * maps a shorter one never replaces a longer one, so a brief replay can't
 * throw away a longer recording.
 */
export function isBetterMap(existing: BeatMap | null | undefined, incoming: BeatMap): boolean {
  if (!shouldReplace(existing, incoming)) return false;
  if (existing && existing.partial && incoming.partial) {
    return mapCoverageEnd(incoming) >= mapCoverageEnd(existing) - 0.5;
  }
  return true;
}

export function fileKey(file: { name: string; size: number; lastModified: number }): string {
  return `file:${file.name}:${file.size}:${file.lastModified}`;
}

export class BeatMapCache {
  /** `onStored` runs after a map is written (e.g. to remember its tempo for tile badges). */
  constructor(
    private readonly store: KVStore,
    private readonly onStored?: (key: string, map: BeatMap) => void,
  ) {}

  /** The cached map, or null (missing, unreadable or invalid entries count as missing). */
  async get(key: string): Promise<BeatMap | null> {
    let raw: unknown;
    try {
      raw = await this.store.get(key);
    } catch {
      return null;
    }
    if (!raw || typeof raw !== 'object' || typeof (raw as Entry).json !== 'string') return null;
    try {
      return parse((raw as Entry).json);
    } catch {
      return null;
    }
  }

  /**
   * Store `map` under `key` if it is better than what is cached.
   * Resolves true when stored. Never rejects.
   */
  async offer(key: string, map: BeatMap): Promise<boolean> {
    let json: string;
    try {
      json = serialize(map);
    } catch {
      return false; // invalid map: never cache it
    }
    const existing = await this.get(key);
    if (!isBetterMap(existing, map)) return false;
    try {
      await this.store.set(key, { json, savedAt: Date.now() } satisfies Entry);
    } catch {
      return false;
    }
    try {
      this.onStored?.(key, map);
    } catch {
      /* listeners must not break caching */
    }
    return true;
  }
}

export function memoryStore(): KVStore {
  const m = new Map<string, unknown>();
  return {
    get: (k) => Promise.resolve(m.get(k)),
    set: (k, v) => {
      m.set(k, v);
      return Promise.resolve();
    },
  };
}

/**
 * IndexedDB-backed store with a memory fallback. Any failure (open, read,
 * write) switches the rest of the session to memory; values already written
 * to memory stay readable.
 */
export function idbStore(dbName = 'dancedance', storeName = 'beatmaps'): KVStore {
  const mem = memoryStore();
  let dbP: Promise<IDBDatabase | null> | null = null;

  const open = (): Promise<IDBDatabase | null> => {
    if (!dbP) {
      dbP = new Promise<IDBDatabase | null>((resolve) => {
        try {
          const idb = typeof indexedDB !== 'undefined' ? indexedDB : null;
          if (!idb) return resolve(null);
          const req = idb.open(dbName, 1);
          const timer = setTimeout(() => resolve(null), 3000); // blocked / hung
          req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(storeName)) req.result.createObjectStore(storeName);
          };
          req.onsuccess = () => {
            clearTimeout(timer);
            resolve(req.result);
          };
          req.onerror = () => {
            clearTimeout(timer);
            resolve(null);
          };
        } catch {
          resolve(null);
        }
      });
    }
    return dbP;
  };

  const run = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
    open().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          if (!db) return reject(new Error('no IndexedDB'));
          try {
            const req = fn(db.transaction(storeName, mode).objectStore(storeName));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        }),
    );

  let failed = false;
  return {
    async get(key) {
      const m = await mem.get(key);
      if (m !== undefined || failed) return m;
      try {
        return await run('readonly', (s) => s.get(key));
      } catch {
        failed = true;
        return undefined;
      }
    },
    async set(key, value) {
      await mem.set(key, value);
      if (failed) return;
      try {
        await run('readwrite', (s) => s.put(value, key));
      } catch {
        failed = true;
      }
    },
  };
}

let shared: BeatMapCache | null = null;

/** The app-wide cache (IndexedDB with memory fallback). */
export function beatCache(): BeatMapCache {
  if (!shared) shared = new BeatMapCache(idbStore(), (key, map) => noteCachedBpm(key, map.bpm));
  return shared;
}
