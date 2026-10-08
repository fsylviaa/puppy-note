/* Browser storage for this standalone development version (IndexedDB with localStorage fallback). */
(function () {
  'use strict';
  const DB_NAME = 'puppy-notebook';
  const STORE = 'state';
  const KEY = 'puppy-notebook-state-v2';
  const LEGACY_KEY = 'puppy-notebook-state-v1';
  const VERSION = 2;

  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!('indexedDB' in window)) { reject(new Error('IndexedDB 不可用')); return; }
      let request;
      try {
        request = indexedDB.open(DB_NAME, 1);
      } catch (err) { reject(err); return; }
      request.onupgradeneeded = function () {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function getItem(db, key) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function setItem(db, key, value) {
    return new Promise(function (resolve, reject) {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = function () { resolve(true); };
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error || new Error('aborted')); };
    });
  }

  function readLegacy() {
    try {
      const value = JSON.parse(localStorage.getItem(LEGACY_KEY));
      return value && value.version === 1 ? value : null;
    } catch (_) { return null; }
  }

  window.puppyNotebookStore = {
    key: KEY,
    read: function (callback) {
      const legacy = readLegacy();
      openDB().then(function (db) {
        getItem(db, KEY).then(function (value) {
          if (value && value.version === VERSION) { callback(value); return; }
          if (legacy) {
            const migrated = Object.assign({}, legacy, { version: VERSION });
            setItem(db, KEY, migrated).then(function () {
              try { localStorage.removeItem(LEGACY_KEY); } catch (_) {}
              callback(migrated);
            }, function () { callback(migrated); });
            return;
          }
          callback(null);
        }, function () {
          callback(legacy ? Object.assign({}, legacy, { version: VERSION }) : null);
        });
      }, function () {
        callback(legacy ? Object.assign({}, legacy, { version: VERSION }) : null);
      });
    },
    write: function (state, callback) {
      openDB().then(function (db) {
        setItem(db, KEY, state).then(function () {
          if (callback) callback(true);
        }, function () {
          if (callback) callback(false);
        });
      }, function () {
        if (callback) callback(false);
      });
    }
  };
})();
