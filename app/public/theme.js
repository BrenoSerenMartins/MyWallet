// Move browser state to the selected product identity before React or theme initialization.
(() => {
  const moveKeys = (storage) => {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
    for (const key of keys) {
      if (!key) continue;
      const renamed = key.startsWith('mywallet-')
        ? 'plannedwallet-' + key.slice('mywallet-'.length)
        : key.startsWith('mywallet:')
          ? 'plannedwallet:' + key.slice('mywallet:'.length)
          : key;
      if (renamed === key) continue;
      if (storage.getItem(renamed) === null) storage.setItem(renamed, storage.getItem(key));
      storage.removeItem(key);
    }
  };
  try {
    moveKeys(localStorage);
  } catch {
    /* Storage may be unavailable. */
  }
  try {
    moveKeys(sessionStorage);
  } catch {
    /* Storage may be unavailable. */
  }
  try {
    const mode = localStorage.getItem('plannedwallet-theme') || 'system';
    const dark =
      mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]').content = dark ? '#141715' : '#f6f5f1';
  } catch {
    document.documentElement.dataset.theme = 'dark';
  }
})();
