/** Also runs from the new bundle when an installed worker still serves the old theme bootstrap. */
export function migrateProductStorage(
  storage: Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>,
) {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  for (const key of keys) {
    if (!key) continue;
    const renamed = key.startsWith('mywallet-')
      ? 'plannedwallet-' + key.slice('mywallet-'.length)
      : key.startsWith('mywallet:')
        ? 'plannedwallet:' + key.slice('mywallet:'.length)
        : key;
    if (renamed === key) continue;
    if (storage.getItem(renamed) === null) storage.setItem(renamed, storage.getItem(key)!);
    storage.removeItem(key);
  }
}
