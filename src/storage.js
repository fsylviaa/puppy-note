/* Browser storage for this standalone development version. */
(function () {
  'use strict';
  const key = 'puppy-notebook-state-v1';
  window.puppyNotebookStore = {
    key,
    read: function () {
      try {
        const value = JSON.parse(localStorage.getItem(key));
        return value && value.version === 1 ? value : null;
      } catch (_) { return null; }
    },
    write: function (state) {
      try {
        localStorage.setItem(key, JSON.stringify(state));
        return true;
      } catch (_) { return false; }
    }
  };
})();
