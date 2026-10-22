import type { components } from './generated';
// Transport shapes are generated from the server's OpenAPI document.
export type Account = components['schemas']['AccountResourceDto'];
export type Category = components['schemas']['CategoryResourceDto'];
export type Transaction = components['schemas']['TransactionResourceDto'];
export type Dashboard = components['schemas']['DashboardResourceDto'];
export type ImportItem = components['schemas']['ImportItemResourceDto'];
export type ImportBatch = components['schemas']['ImportBatchResourceDto'];
export interface Collection<T> {
  items: T[];
  nextCursor: string | null;
}

export type Workspace = components['schemas']['WorkspaceResourceDto'];
