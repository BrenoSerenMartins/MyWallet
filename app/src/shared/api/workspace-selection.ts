let selectedWorkspaceId: string | null = null;
let selectedRole: string = 'owner';
export function setRequestWorkspace(id: string | null, role = 'owner') {
  if (selectedWorkspaceId === id && selectedRole === role) return;
  selectedRole = role;
  selectedWorkspaceId = id;
  if (typeof window !== 'undefined')
    window.dispatchEvent(new Event('plannedwallet:workspace-changed'));
}
export function getRequestWorkspace() {
  return selectedWorkspaceId;
}

export function getRequestWorkspaceRole() {
  return selectedRole;
}
