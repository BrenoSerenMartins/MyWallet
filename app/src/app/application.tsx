import { WorkspaceProvider } from '../features/workspaces/workspace-provider';
import { WorkspaceBoundary } from '../features/workspaces/workspace-boundary';
import { WorkspacesPage } from '../features/workspaces/workspaces-page';
import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-provider';
import { AuthPage } from '../features/auth/auth-page';
import { Loading } from '../shared/ui/primitives';
import { AppShell } from './app-shell';
const DashboardPage = lazy(() =>
  import('../features/dashboard/dashboard-page').then((module) => ({
    default: module.DashboardPage,
  })),
);
const AccountsPage = lazy(() =>
  import('../features/accounts/accounts-page').then((module) => ({ default: module.AccountsPage })),
);
const TransactionsPage = lazy(() =>
  import('../features/transactions/transactions-page').then((module) => ({
    default: module.TransactionsPage,
  })),
);
const ImportsPage = lazy(() =>
  import('../features/imports/imports-page').then((module) => ({ default: module.ImportsPage })),
);
const SettingsPage = lazy(() =>
  import('../features/settings/settings-page').then((module) => ({ default: module.SettingsPage })),
);
export function Application() {
  const { session, loading } = useAuth();
  if (loading)
    return (
      <div className="startup">
        <Loading />
      </div>
    );
  return (
    <>
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      <WorkspaceSession>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/reset-password" element={<AuthPage />} />
            {!session ? (
              <Route path="*" element={<AuthPage />} />
            ) : (
              <>
                <Route path="workspaces" element={<WorkspacesPage />} />
                <Route element={<WorkspaceBoundary />}>
                  <Route element={<AppShell />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="accounts" element={<AccountsPage />} />
                    <Route path="accounts/:accountId" element={<TransactionsPage />} />
                    <Route path="transactions" element={<TransactionsPage />} />
                    <Route path="imports" element={<ImportsPage />} />
                    <Route path="imports/:importId" element={<ImportsPage />} />
                    <Route path="settings/*" element={<SettingsPage />} />
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
          </Routes>
        </Suspense>
      </WorkspaceSession>
    </>
  );
}

function WorkspaceSession({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  return session ? (
    <WorkspaceProvider key={session.user.id}>{children}</WorkspaceProvider>
  ) : (
    children
  );
}
