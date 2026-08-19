import type { ExplorerFolder, ExplorerPaper, LibrarySummary } from "@/lib/models";

export interface ExplorerSnapshot {
  libraries: LibrarySummary[];
  folders: ExplorerFolder[];
  papers: ExplorerPaper[];
  cachedAt: string;
}

const DATABASE_NAME = "papershelf";
const STORE_NAME = "explorer-snapshots";
const DATABASE_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open the Papershelf cache."));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = operation(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Unable to access the Papershelf cache."));
    });
  } finally {
    database.close();
  }
}

export async function readExplorerSnapshot(cacheKey: string): Promise<ExplorerSnapshot | null> {
  return (await withStore("readonly", (store) => store.get(cacheKey))) ?? null;
}

export async function writeExplorerSnapshot(cacheKey: string, snapshot: ExplorerSnapshot): Promise<void> {
  await withStore("readwrite", (store) => store.put(snapshot, cacheKey));
}

export async function clearExplorerSnapshot(cacheKey: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(cacheKey));
}
