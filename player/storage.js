/* Pack persistence. IndexedDB is the primary store; localStorage remains a fallback. */
(function () {
  const DB_NAME = "lorekeeper";
  const DB_VERSION = 1;
  const PACK_STORE = "packs";
  const SETTING_STORE = "settings";
  const LEGACY_PREFIX = "lorekeeper:pack:";

  let db = null;
  let opening = null;
  const packs = new Map();
  const settings = new Map();

  function openDatabase() {
    if (!("indexedDB" in window)) return Promise.resolve(null);
    if (opening) return opening;
    opening = new Promise((resolve) => {
      let request;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch {
        resolve(null);
        return;
      }
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(PACK_STORE)) {
          database.createObjectStore(PACK_STORE, { keyPath: "id" });
        }
        if (!database.objectStoreNames.contains(SETTING_STORE)) {
          database.createObjectStore(SETTING_STORE, { keyPath: "key" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    return opening;
  }

  function requestPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
    });
  }

  function legacyPacks() {
    const found = [];
    try {
      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith(LEGACY_PREFIX)) continue;
        try {
          const pack = JSON.parse(localStorage.getItem(key) || "null");
          if (pack && pack.id) found.push(pack);
        } catch {
          /* ignore a broken legacy entry */
        }
      }
    } catch {
      /* storage disabled */
    }
    return found;
  }

  async function migrateLegacy() {
    if (!db) return;
    const found = legacyPacks();
    for (const pack of found) {
      try {
        const transaction = db.transaction(PACK_STORE, "readwrite");
        await requestPromise(transaction.objectStore(PACK_STORE).put(pack));
        packs.set(pack.id, pack);
        localStorage.removeItem(`${LEGACY_PREFIX}${pack.id}`);
      } catch {
        /* keep the legacy entry if the write failed */
      }
    }
  }

  async function ready() {
    if (db) return;
    db = await openDatabase();
    if (db) {
      const packTx = db.transaction(PACK_STORE, "readonly");
      const packRows = await requestPromise(packTx.objectStore(PACK_STORE).getAll());
      for (const pack of packRows || []) packs.set(pack.id, pack);
      const settingTx = db.transaction(SETTING_STORE, "readonly");
      const settingRows = await requestPromise(settingTx.objectStore(SETTING_STORE).getAll());
      for (const row of settingRows || []) settings.set(row.key, row.value);
      await migrateLegacy();
      return;
    }
    for (const pack of legacyPacks()) packs.set(pack.id, pack);
  }

  function allPacks() {
    return [...packs.values()];
  }

  function getPack(id) {
    return packs.get(String(id)) || null;
  }

  async function putPack(pack) {
    packs.set(pack.id, pack);
    if (db) {
      const transaction = db.transaction(PACK_STORE, "readwrite");
      await requestPromise(transaction.objectStore(PACK_STORE).put(pack));
      return;
    }
    try {
      localStorage.setItem(`${LEGACY_PREFIX}${pack.id}`, JSON.stringify(pack));
    } catch {
      throw new Error("Browser storage is full.");
    }
  }

  async function deletePack(id) {
    packs.delete(String(id));
    if (db) {
      const transaction = db.transaction(PACK_STORE, "readwrite");
      await requestPromise(transaction.objectStore(PACK_STORE).delete(String(id)));
      return;
    }
    try {
      localStorage.removeItem(`${LEGACY_PREFIX}${id}`);
    } catch {
      /* ignore */
    }
  }

  function getSetting(key, fallback = null) {
    return settings.has(key) ? settings.get(key) : fallback;
  }

  async function setSetting(key, value) {
    settings.set(key, value);
    if (db) {
      const transaction = db.transaction(SETTING_STORE, "readwrite");
      await requestPromise(transaction.objectStore(SETTING_STORE).put({ key, value }));
      return;
    }
    try {
      localStorage.setItem(`lorekeeper:setting:${key}`, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }

  window.LorekeeperPackStorage = {
    ready,
    allPacks,
    getPack,
    putPack,
    deletePack,
    getSetting,
    setSetting,
  };
})();
