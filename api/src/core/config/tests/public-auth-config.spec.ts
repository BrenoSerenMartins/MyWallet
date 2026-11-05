import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Configuration } from '../index.js';

afterEach(() => vi.unstubAllEnvs());
const marker = 'synthetic-public-key-not-for-logs';
const cases = [
  { url: '', key: '', missing: ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'] },
  { url: 'https://example.supabase.co', key: '', missing: ['SUPABASE_PUBLISHABLE_KEY'] },
  { url: '', key: marker, missing: ['SUPABASE_URL'] },
  { url: '  ', key: '\t', missing: ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'] },
];
function checkBuild(url: string, key: string) {
  const process = { env: { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key }, exitCode: 0 };
  const stdout: string[] = [],
    stderr: string[] = [];
  runInNewContext(readFileSync('scripts/check-public-auth-config.mjs', 'utf8'), {
    process,
    console: {
      log: (value: string) => stdout.push(value),
      error: (value: string) => stderr.push(value),
    },
  });
  return { status: process.exitCode, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
}
describe('missing public auth deployment configuration', () => {
  it.each(cases)(
    'identifies missing runtime variables without displaying configured values: $missing',
    ({ url, key, missing }) => {
      vi.stubEnv('NODE_ENV', 'test');
      vi.stubEnv('PORT', '8083');
      vi.stubEnv('SUPABASE_URL', url);
      vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', key);
      let message = '';
      try {
        new Configuration();
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toContain(`Missing Supabase environment variables: ${missing.join(', ')}`);
      expect(message).not.toContain(marker);
      expect(message).not.toContain('https://example.supabase.co');
    },
  );
  it.each(cases)(
    'rejects an unconfigured Docker frontend before compilation: $missing',
    ({ url, key, missing }) => {
      const result = checkBuild(url, key);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        `Missing public auth build configuration: ${missing.join(', ')}`,
      );
      expect(result.stderr).not.toContain(marker);
      expect(result.stderr).not.toContain('https://example.supabase.co');
    },
  );
  it('accepts configured builds and trims public runtime settings without printing their values', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('PORT', '8083');
    vi.stubEnv('SUPABASE_URL', ' https://example.supabase.co ');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', ` ${marker} `);
    expect(new Configuration().supabaseUrl).toBe('https://example.supabase.co');
    expect(new Configuration().publishableKey).toBe(marker);
    const result = checkBuild(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain(marker);
    expect(result.stdout).not.toContain('https://example.supabase.co');
  });
});
