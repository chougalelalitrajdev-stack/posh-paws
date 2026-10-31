// Browser-storage helpers that never throw (private mode or blocked storage just means nothing is saved).
// Pass sessionStorage to keep a value only until the tab closes.

export function readJson<T>(key: string, fallback: T, storage: Storage = localStorage): T {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown, storage: Storage = localStorage): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: the value lasts until reload.
  }
}

export function removeItem(key: string, storage: Storage = localStorage): void {
  try {
    storage.removeItem(key);
  } catch {
    // Nothing was stored.
  }
}
