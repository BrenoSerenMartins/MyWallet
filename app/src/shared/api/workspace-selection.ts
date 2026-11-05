let selectedWorkspaceId: string | null = null;
export function setRequestWorkspace(id: string | null) {
  if (selectedWorkspaceId === id) return;
  selectedWorkspaceId = id;
  if (typeof window !== 'undefined')
    window.dispatchEvent(new Event('plannedwallet:workspace-changed'));
}
export function getRequestWorkspace() {
  return selectedWorkspaceId;
}
