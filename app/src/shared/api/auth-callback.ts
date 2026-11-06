interface AuthFailure {
  code?: string;
  name?: string;
}
interface CallbackAuth {
  initialize: () => Promise<{ error: AuthFailure | null }>;
  exchangeCodeForSession: (
    code: string,
    options?: { flowId?: string },
  ) => Promise<{ error: AuthFailure | null }>;
}
export function isAuthCodeCallback(url: URL) {
  return (
    ['/reset-password', '/auth/callback'].includes(url.pathname) && !!url.searchParams.get('code')
  );
}
/** Called once at client startup, before publishing the first authentication state. */
export async function completeAuthCallback(
  auth: CallbackAuth,
  url: URL,
  replaceUrl: (url: URL) => void,
) {
  try {
    const initialization = await auth.initialize();
    if (initialization.error || !isAuthCodeCallback(url)) return initialization;
    const code = url.searchParams.get('code')!;
    const flowId = url.searchParams.get('sb_flow_id');
    const result = await auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (!result.error) {
      const clean = new URL(url);
      clean.searchParams.delete('code');
      clean.searchParams.delete('sb_flow_id');
      replaceUrl(clean);
    }
    return { error: result.error };
  } catch (error) {
    return { error: { name: error instanceof Error ? error.name : 'AuthCallbackError' } };
  }
}
