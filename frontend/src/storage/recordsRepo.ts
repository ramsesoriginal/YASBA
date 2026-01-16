import type { DomainRecord } from "../domain/types";
import { openDb, STORES, withTx } from "./db";

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

export async function appendRecord(record: DomainRecord): Promise<void> {
  const db = await openDb();

  try {
    await withTx(db, [STORES.records], "readwrite", async (tx) => {
      const store = tx.objectStore(STORES.records);
      // Append-only. If id already exists, fail loudly.
      const req = store.add(record);
      await requestToPromise(req);
    });
  } finally {
    db.close();
  }
}

export async function listAllRecords(): Promise<DomainRecord[]> {
  const db = await openDb();

  try {
    return await withTx(db, [STORES.records], "readonly", async (tx) => {
      const store = tx.objectStore(STORES.records);

      // getAll() is fine for Slice 1.
      const req = store.getAll();
      const rows = await requestToPromise(req);

      // IndexedDB returns `any[]`; assert as DomainRecord[]
      return rows as DomainRecord[];
    });
  } finally {
    db.close();
  }
}

export async function clearAllRecords(): Promise<void> {
  const db = await openDb();
  try {
    await withTx(db, [STORES.records], "readwrite", async (tx) => {
      tx.objectStore(STORES.records).clear();
    });
  } finally {
    db.close();
  }
}
