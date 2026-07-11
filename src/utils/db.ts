import { Channel } from '../app/api/parse/route';

const DB_NAME = 'JCM_IPTV_DB';
const DB_VERSION = 1;
const STORE_NAME = 'playlist';
const CHANNELS_KEY = 'cached_channels';

/**
 * Opens a connection to the IndexedDB database.
 */
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB is only available in the browser'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Saves the parsed channel list to IndexedDB.
 */
export async function saveChannelsToCache(channels: Channel[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(channels, CHANNELS_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error saving channels to IndexedDB:', error);
  }
}

/**
 * Retrieves the cached channel list from IndexedDB.
 */
export async function getCachedChannels(): Promise<Channel[] | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(CHANNELS_KEY);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error reading channels from IndexedDB:', error);
    return null;
  }
}

/**
 * Clears the cached channel list from IndexedDB.
 */
export async function clearCachedChannels(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(CHANNELS_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error clearing IndexedDB:', error);
  }
}
