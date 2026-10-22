let selectedWorkspaceId: string | null = null;
export function setRequestWorkspace(id: string | null) {
  selectedWorkspaceId = id;
}
export function getRequestWorkspace() {
  return selectedWorkspaceId;
}
