import { getRequestWorkspace } from './workspace-selection';
import { authClient } from './auth-client';
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function fetchResponse(path: string, options: RequestInit = {}): Promise<Response> {
  const workspaceId = getRequestWorkspace();
  if (!navigator.onLine)
    throw new ApiError(
      'Você está sem conexão. Seus dados serão carregados quando a internet voltar.',
      0,
    );
  const { data } = await authClient.auth.getSession();
  const headers = new Headers(options.headers);
  if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`);
  if (workspaceId && !/^\/workspaces(?:$|[/?])/.test(path))
    headers.set('X-Workspace-Id', workspaceId);
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  const response = await fetch('/v1' + path, { ...options, headers, cache: 'no-store' });
  if (!response.ok) {
    const problem = await response.json().catch(() => ({}));
    throw new ApiError(
      typeof problem.title === 'string' ? problem.title : 'Não foi possível concluir a operação.',
      response.status,
    );
  }
  return response;
}
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  return (await fetchResponse(path, options)).json();
}
export async function requestBlob(path: string): Promise<Blob> {
  return (await fetchResponse(path)).blob();
}
export const jsonBody = (data: unknown) => JSON.stringify(data);
