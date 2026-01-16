import type { DomainRecord } from "../domain/types";

const DB_NAME = "yasba";
const DB_VERSION = 1;

export const STORES = {
  records: "records",
  meta: "meta",
} as const;

export type MetaKey = "schemaVersion" | "createdAt";

export type MetaValue =
  | { key: "schemaVersion"; value: number }
  | { key: "createdAt"; value: string };

export type RecordsStoreValue = DomainRecord;

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

export async function openDb(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      // records store: append-only, keyed by record.id
      if (!db.objectStoreNames.contains(STORES.records)) {
        const records = db.createObjectStore(STORES.records, { keyPath: "id" });

        // Minimal indexes (add more only when needed)
        records.createIndex("byType", "type", { unique: false });
        records.createIndex("byCreatedAt", "createdAt", { unique: false });

        // For TransactionCreated only; for others the index key will be undefined
        records.createIndex("byOccurredAt", "occurredAt", { unique: false });
        records.createIndex("byCategoryId", "categoryId", { unique: false });
      }

      // meta store: key/value
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: "key" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB"));
    req.onblocked = () => reject(new Error("IndexedDB open blocked (another tab?)"));
  });
}

export async function withTx<T>(
  db: IDBDatabase,
  storeNames: string[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => Promise<T> | T
): Promise<T> {
  const tx = db.transaction(storeNames, mode);
  try {
    const result = await fn(tx);
    // Wait for tx completion deterministically
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
      tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
    });
    return result;
  } catch (err) {
    try {
      tx.abort();
    } catch {
      // ignore abort errors
    }
    throw err;
  }
}

export async function initMetaIfMissing(db: IDBDatabase): Promise<void> {
  await withTx(db, [STORES.meta], "readwrite", async (tx) => {
    const store = tx.objectStore(STORES.meta);

    const schema = await requestToPromise(store.get("schemaVersion"));
    if (!schema) {
      store.put({ key: "schemaVersion", value: DB_VERSION } satisfies MetaValue);
    }

    const createdAt = await requestToPromise(store.get("createdAt"));
    if (!createdAt) {
      store.put({ key: "createdAt", value: new Date().toISOString() } satisfies MetaValue);
    }
  });
}
