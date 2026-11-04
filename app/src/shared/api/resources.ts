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
export type MonthlyPlan = components['schemas']['MonthlyPlanResourceDto'];
export type PlanningLine = components['schemas']['PlanningLineResourceDto'];

export type CategoryGroup = components['schemas']['CategoryGroupResourceDto'];

export type SettlementMatch = components['schemas']['SettlementMatchResourceDto'];

export type Counterparty = components['schemas']['CounterpartyResourceDto'];

export type CounterpartyCandidate = components['schemas']['CounterpartyCandidateDto'];

export type BalanceHistory = components['schemas']['BalanceHistoryDto'];

export type DashboardHistory = components['schemas']['DashboardHistoryDto'];

export type TrashedWorkspace = components['schemas']['TrashedWorkspaceResourceDto'];

export type ImportConfirmation = components['schemas']['ImportConfirmationDto'];

export type BalanceReferenceResult = components['schemas']['BalanceReferenceResultDto'];

export type CommitmentSchedule = components['schemas']['CommitmentScheduleDto'];
export type CommitmentOccurrence = components['schemas']['CommitmentOccurrenceDto'];
export type CommitmentsSummary = components['schemas']['CommitmentsSummaryDto'];
export type CommitmentCandidate = components['schemas']['CommitmentCandidateDto'];

export type CreditCard = components['schemas']['CardViewDto'];
export type CardsSummary = components['schemas']['CardsSummaryDto'];
export type CardBill = components['schemas']['CardBillResourceDto'];
export type CardEntry = components['schemas']['CardEntryResourceDto'];
export type CardPayment = components['schemas']['CardPaymentResourceDto'];
export type CardPurchase = components['schemas']['CardPurchaseResourceDto'];
export type ManagedEntry = components['schemas']['ManagedEntryDto'];
export type WealthSummary = components['schemas']['WealthSummaryDto'];
export type WealthTotals = components['schemas']['WealthTotalsDto'];
export type InvestmentHolding = components['schemas']['InvestmentViewDto'];
export type WealthItem = components['schemas']['WealthItemDto'];
