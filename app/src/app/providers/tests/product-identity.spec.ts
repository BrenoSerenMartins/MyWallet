import { migrateProductStorage } from '../../../shared/migrate-product-state';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
const script = readFileSync('app/public/theme.js', 'utf8');
function storage(initial: Record<string, string>) {
  const items = new Map(Object.entries(initial));
  return {
    get length() {
      return items.size;
    },
    key: (index: number) => [...items.keys()][index] ?? null,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
  };
}
describe('product identity browser migration', () => {
  it('migrates before React initialization even if an installed worker serves an older HTML bootstrap', () => {
    const local = storage({ 'mywallet-theme': 'light', 'mywallet-workspace:user': 'selected' });
    migrateProductStorage(local);
    expect(local.getItem('plannedwallet-theme')).toBe('light');
    expect(local.getItem('plannedwallet-workspace:user')).toBe('selected');
    expect(local.getItem('mywallet-workspace:user')).toBeNull();
  });
  it('keeps the theme, selected workspace and entry state without disturbing authentication', () => {
    const local = storage({
      'mywallet-theme': 'light',
      'mywallet-workspace:user': 'workspace',
      'sb-project-auth-token': 'auth',
    });
    const session = storage({ 'mywallet:entered': 'yes' });
    const document = {
      documentElement: { dataset: { theme: '' } },
      querySelector: () => ({ content: '' }),
    };
    const environment = {
      localStorage: local,
      sessionStorage: session,
      document,
      matchMedia: () => ({ matches: true }),
    };
    runInNewContext(script, environment);
    expect(local.getItem('plannedwallet-theme')).toBe('light');
    expect(local.getItem('plannedwallet-workspace:user')).toBe('workspace');
    expect(local.getItem('mywallet-theme')).toBeNull();
    expect(local.getItem('mywallet-workspace:user')).toBeNull();
    expect(local.getItem('sb-project-auth-token')).toBe('auth');
    expect(session.getItem('plannedwallet:entered')).toBe('yes');
    expect(session.getItem('mywallet:entered')).toBeNull();
    expect(document.documentElement.dataset.theme).toBe('light');
    runInNewContext(script, environment);
    expect(local.getItem('plannedwallet-workspace:user')).toBe('workspace');
  });
  it('keeps an already selected new preference and tolerates unavailable storage', () => {
    const local = storage({ 'mywallet-theme': 'light', 'plannedwallet-theme': 'dark' });
    const document = {
      documentElement: { dataset: { theme: '' } },
      querySelector: () => ({ content: '' }),
    };
    runInNewContext(script, { localStorage: local, sessionStorage: storage({}), document });
    expect(local.getItem('plannedwallet-theme')).toBe('dark');
    expect(local.getItem('mywallet-theme')).toBeNull();
    runInNewContext(script, { document });
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
