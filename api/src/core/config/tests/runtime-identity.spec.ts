import { describe, expect, it } from 'vitest';
import { runtimeConnectionString } from '../runtime-identity.js';
describe('runtime connection identity transition', () => {
  it.each(['mywallet_runtime', 'mywallet_runtime.project'])(
    'renames only the role in %s',
    (username) => {
      const before = new URL(
        `postgresql://${username}:synthetic%21password@pooler.example.test:6543/postgres?sslmode=require`,
      );
      const after = new URL(runtimeConnectionString(before.href));
      expect(after.username).toBe(username.replace('mywallet_runtime', 'plannedwallet_runtime'));
      expect(after.password).toBe(before.password);
      expect(after.host).toBe(before.host);
      expect(after.pathname).toBe(before.pathname);
      expect(after.search).toBe(before.search);
    },
  );
  it.each([
    '',
    'postgresql://plannedwallet_runtime:synthetic@db.example.test/postgres',
    'postgresql://postgres:synthetic@db.example.test/postgres',
    'postgresql://mywallet_runtime_other:synthetic@db.example.test/postgres',
    'not-a-url',
  ])('leaves other identities and validation to the existing database guard', (value) => {
    expect(runtimeConnectionString(value)).toBe(value);
  });
});
