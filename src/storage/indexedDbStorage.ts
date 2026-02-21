import { STORAGE } from '../config/constants';
import type { StorageService, StorageValue } from './types';

const toPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });

const transactionDone = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
  });

export class IndexedDbStorageService implements StorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  async init(): Promise<void> {
    const db = await this.getDb();
    const version = await this.readFromStore<number>(db, STORAGE.stores.meta, STORAGE.keys.schemaVersion);

    if (version !== STORAGE.schemaVersion) {
      await this.writeToStore(db, STORAGE.stores.meta, STORAGE.keys.schemaVersion, STORAGE.schemaVersion);
    }
  }

  async read<T extends StorageValue>(key: string): Promise<T | undefined> {
    const db = await this.getDb();
    return this.readFromStore<T>(db, STORAGE.stores.kv, key);
  }

  async write<T extends StorageValue>(key: string, value: T): Promise<void> {
    const db = await this.getDb();
    await this.writeToStore(db, STORAGE.stores.kv, key, value);
  }

  async remove(key: string): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(STORAGE.stores.kv, 'readwrite');
    tx.objectStore(STORAGE.stores.kv).delete(key);
    await transactionDone(tx);
  }

  async getSchemaVersion(): Promise<number | undefined> {
    const db = await this.getDb();
    return this.readFromStore<number>(db, STORAGE.stores.meta, STORAGE.keys.schemaVersion);
  }

  async close(): Promise<void> {
    if (!this.dbPromise) {
      return;
    }

    const db = await this.dbPromise;
    db.close();
    this.dbPromise = null;
  }

  private async getDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(STORAGE.dbName, STORAGE.dbVersion);

        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORAGE.stores.kv)) {
            db.createObjectStore(STORAGE.stores.kv);
          }
          if (!db.objectStoreNames.contains(STORAGE.stores.meta)) {
            db.createObjectStore(STORAGE.stores.meta);
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
      });
    }

    return this.dbPromise;
  }

  private async readFromStore<T>(db: IDBDatabase, storeName: string, key: string): Promise<T | undefined> {
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    const value = await toPromise(request);
    await transactionDone(tx);
    return value as T | undefined;
  }

  private async writeToStore(db: IDBDatabase, storeName: string, key: string, value: unknown): Promise<void> {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value, key);
    await transactionDone(tx);
  }
}

export const createStorageService = () => new IndexedDbStorageService();

export const storageService: StorageService = createStorageService();
