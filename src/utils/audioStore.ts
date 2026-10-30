/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ذخیرهٔ ماندگار فایل‌های صوتی انتخاب‌شده توسط کاربر (IndexedDB).
 * آدرس‌های blob: بعد از بستن برنامه از بین می‌روند؛ به همین دلیل خود فایل صوتی
 * در IndexedDB نگه‌داری می‌شود و هنگام اجرای بعدی دوباره آدرس تازه برایش ساخته می‌شود.
 */

const DB_NAME = 'tanin_maddahi_audio';
const STORE_NAME = 'audio';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB در دسترس نیست'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('خطا در باز کردن پایگاه داده'));
  });
}

export async function saveAudio(trackId: string, blob: Blob): Promise<boolean> {
  try {
    const db = await openDb();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(blob, trackId);
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
      tx.onabort = () => {
        db.close();
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}

export async function loadAudio(trackId: string): Promise<Blob | null> {
  try {
    const db = await openDb();
    return await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(trackId);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as Blob) || null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

export async function deleteAudio(trackId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(trackId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // ignore
  }
}

/** آدرس‌هایی که با بستن برنامه بی‌اعتبار می‌شوند و نباید در localStorage بمانند. */
export function isVolatileUrl(url?: string): boolean {
  return Boolean(url && (url.startsWith('blob:') || url.startsWith('data:')));
}

/** خواندن مدت‌زمان واقعی فایل صوتی (با مهلت زمانی تا برنامه گیر نکند). */
export function measureAudioDuration(url: string, timeoutMs = 5000): Promise<number | null> {
  return new Promise((resolve) => {
    let done = false;
    const audio = new Audio();
    const finish = (value: number | null) => {
      if (done) return;
      done = true;
      audio.removeAttribute('src');
      resolve(value);
    };
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', () => {
      const d = audio.duration;
      finish(d && isFinite(d) ? Math.round(d) : null);
    });
    audio.addEventListener('error', () => finish(null));
    window.setTimeout(() => finish(null), timeoutMs);
    audio.src = url;
  });
}
