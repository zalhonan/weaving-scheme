// Stub `localStorage` in the node test environment so Zustand's `persist`
// middleware can write without "storage unavailable" warnings.

interface SimpleStorage {
  store: Record<string, string>;
}

if (typeof globalThis.localStorage === 'undefined') {
  const data: SimpleStorage = { store: {} };
  globalThis.localStorage = {
    getItem: (key) => data.store[key] ?? null,
    setItem: (key, value) => {
      data.store[key] = String(value);
    },
    removeItem: (key) => {
      delete data.store[key];
    },
    clear: () => {
      data.store = {};
    },
    key: (i) => Object.keys(data.store)[i] ?? null,
    get length() {
      return Object.keys(data.store).length;
    },
  } as Storage;
}
