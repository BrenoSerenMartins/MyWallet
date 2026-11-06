import { expect, it, vi } from 'vitest';
import { completeAuthCallback } from '../../../shared/api/auth-callback';
it('exchanges a recovery code once before initialization is considered complete', async () => {
  const order: string[] = [];
  const auth = {
    initialize: vi.fn(async () => {
      order.push('initialize');
      return { error: null };
    }),
    exchangeCodeForSession: vi.fn(async () => {
      order.push('exchange');
      return { error: null };
    }),
  };
  const replace = vi.fn();
  const ready = completeAuthCallback(
    auth,
    new URL('https://example.test/reset-password?code=one-time&sb_flow_id=flow&keep=value'),
    replace,
  );
  await Promise.all([ready, ready]);
  expect(order).toEqual(['initialize', 'exchange']);
  expect(auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith('one-time', {
    flowId: 'flow',
  });
  expect(replace.mock.calls[0][0].href).toBe('https://example.test/reset-password?keep=value');
});
it('handles signup callbacks but does not redeem codes on unrelated pages', async () => {
  const auth = {
    initialize: vi.fn(async () => ({ error: null })),
    exchangeCodeForSession: vi.fn(async () => ({ error: null })),
  };
  await completeAuthCallback(auth, new URL('https://example.test/?code=unrelated'), vi.fn());
  expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  await completeAuthCallback(
    auth,
    new URL('https://example.test/auth/callback?code=signup'),
    vi.fn(),
  );
  expect(auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith('signup', undefined);
});
it('preserves failed callback errors and does not hide failure by removing the code', async () => {
  const failure = { name: 'AuthPKCECodeVerifierMissingError' };
  const replace = vi.fn();
  const auth = {
    initialize: vi.fn(async () => ({ error: null })),
    exchangeCodeForSession: vi.fn(async () => ({ error: failure })),
  };
  expect(
    await completeAuthCallback(
      auth,
      new URL('https://example.test/reset-password?code=missing-verifier'),
      replace,
    ),
  ).toEqual({ error: failure });
  expect(replace).not.toHaveBeenCalled();
});
it('does not redeem a code when initialization failed', async () => {
  const error = { code: 'network_error' };
  const auth = {
    initialize: vi.fn(async () => ({ error })),
    exchangeCodeForSession: vi.fn(async () => ({ error: null })),
  };
  expect(
    await completeAuthCallback(
      auth,
      new URL('https://example.test/reset-password?code=code'),
      vi.fn(),
    ),
  ).toEqual({ error });
  expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
});

it('creates a persisted recovery session with the real Supabase SDK and one PKCE token request', async () => {
  const { createClient } = await import('@supabase/supabase-js');
  const values = new Map<string, string>([
    ['sb-recovery-fixture-auth-token-code-verifier', JSON.stringify('test-verifier/recovery')],
  ]);
  const fetchToken = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          access_token: 'fixture-access-token',
          refresh_token: 'fixture-refresh-token',
          token_type: 'bearer',
          expires_in: 3600,
          user: {
            id: '11111111-1111-4111-8111-111111111111',
            aud: 'authenticated',
            email: 'preview@example.test',
            created_at: '2026-01-01T00:00:00Z',
            app_metadata: {},
            user_metadata: {},
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
  );
  const client = createClient('https://recovery-fixture.supabase.co', 'fixture-public-key', {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      autoRefreshToken: false,
      storage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => {
          values.set(key, value);
        },
        removeItem: (key) => {
          values.delete(key);
        },
      },
    },
    global: { fetch: fetchToken },
  });
  const replace = vi.fn();
  const result = await completeAuthCallback(
    client.auth,
    new URL('https://example.test/reset-password?code=single-use-fixture'),
    replace,
  );
  expect(result.error).toBeNull();
  expect(fetchToken).toHaveBeenCalledTimes(1);
  const request = fetchToken.mock.calls[0] as unknown as [string, RequestInit];
  expect(request[0]).toContain('/token?grant_type=pkce');
  expect(JSON.parse(String(request[1].body))).toMatchObject({
    auth_code: 'single-use-fixture',
    code_verifier: 'test-verifier',
  });
  expect((await client.auth.getSession()).data.session?.user.email).toBe('preview@example.test');
  expect(values.has('sb-recovery-fixture-auth-token')).toBe(true);
  expect(replace.mock.calls[0][0].href).toBe('https://example.test/reset-password');
  await client.auth.stopAutoRefresh();
});

it('finishes startup with an error rather than leaving the page loading when the SDK throws', async () => {
  const auth = {
    initialize: vi.fn(async () => ({ error: null })),
    exchangeCodeForSession: vi.fn(async () => {
      throw new Error('private provider details');
    }),
  };
  expect(
    await completeAuthCallback(
      auth,
      new URL('https://example.test/reset-password?code=code'),
      vi.fn(),
    ),
  ).toEqual({ error: { name: 'Error' } });
});
