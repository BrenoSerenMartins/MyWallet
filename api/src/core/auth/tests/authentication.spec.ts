import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { AuthenticatedUserGuard } from '../index.js';
const now = Math.floor(Date.now() / 1000);
function guard(claims: Record<string, unknown>) {
  const g = new AuthenticatedUserGuard({
    supabaseUrl: 'https://example.supabase.co',
    publishableKey: 'test-public',
  } as never);
  (g as unknown as { client: unknown }).client = {
    auth: { getClaims: async () => ({ data: { claims }, error: null }) },
  };
  return g;
}
function context(authorization?: string) {
  const request = { headers: { authorization } };
  return { request, context: { switchToHttp: () => ({ getRequest: () => request }) } as never };
}
describe('Verified identity boundary', () => {
  it('rejects missing authentication', async () => {
    const c = context();
    await expect(guard({}).canActivate(c.context)).rejects.toThrow('Entre');
  });
  it('rejects wrong issuer, audience or expired claims', async () => {
    for (const patch of [
      { iss: 'https://other.test/auth/v1' },
      { aud: 'anon' },
      { exp: now - 100 },
    ]) {
      const c = context('Bearer test');
      await expect(
        guard({
          sub: '123',
          iss: 'https://example.supabase.co/auth/v1',
          aud: 'authenticated',
          exp: now + 100,
          ...patch,
        }).canActivate(c.context),
      ).rejects.toThrow('expirou');
    }
  });
  it('binds the verified subject, never a body owner', async () => {
    const c = context('Bearer test');
    expect(
      await guard({
        sub: 'verified-subject',
        iss: 'https://example.supabase.co/auth/v1',
        aud: 'authenticated',
        exp: now + 100,
      }).canActivate(c.context),
    ).toBe(true);
    expect((c.request as unknown as { identity: { id: string } }).identity.id).toBe(
      'verified-subject',
    );
  });
});
