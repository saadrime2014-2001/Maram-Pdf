import { StoredPdfFile } from '../types/pdf';

const DB_NAME = 'waraqa_pdf_db';
const DB_VERSION = 1;
const STORE_NAME = 'files';
const SIGNATURE_KEY = 'waraqa_saved_signatures_v1';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveRecentFile(file: Omit<StoredPdfFile, 'id' | 'updatedAt'> & { id?: string }): Promise<StoredPdfFile> {
  const record: StoredPdfFile = {
    id: file.id || `file_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: file.name,
    bytes: file.bytes,
    pageCount: file.pageCount,
    size: file.size,
    updatedAt: Date.now(),
    actionLabel: file.actionLabel,
  };

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // IndexedDB unavailable in restricted mode; continue safely
  }

  return record;
}

export async function listRecentFiles(): Promise<StoredPdfFile[]> {
  try {
    const db = await openDatabase();
    const items = await new Promise<StoredPdfFile[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as StoredPdfFile[]) || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return items.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 25);
  } catch {
    return [];
  }
}

export async function deleteRecentFile(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}

export function getSavedSignatures(): string[] {
  try {
    const raw = localStorage.getItem(SIGNATURE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSignatureDataUrl(dataUrl: string): string[] {
  const existing = getSavedSignatures();
  const next = [dataUrl, ...existing.filter((item) => item !== dataUrl)].slice(0, 6);
  try {
    localStorage.setItem(SIGNATURE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  return next;
}

export function removeSignatureDataUrl(dataUrl: string): string[] {
  const existing = getSavedSignatures();
  const next = existing.filter((item) => item !== dataUrl);
  try {
    localStorage.setItem(SIGNATURE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
