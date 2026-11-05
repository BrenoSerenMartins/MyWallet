import { migrateProductStorage } from './shared/migrate-product-state';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import { ThemeProvider } from './app/providers/theme-provider';
import { AuthProvider } from './features/auth/auth-provider';
import { Application } from './app/application';
import './app/styles/tokens.css';
import './app/styles/layout.css';
import './app/styles/components.css';
import './app/styles/refinements.css';
import './app/styles/experience.css';
import './app/styles/task-layouts.css';
import './shared/feedback/feedback.css';
import './app/styles/motion.css';
import './app/styles/topbar.css';
import './app/styles/editorial-system.css';
import './shared/ui/controls/controls.css';
import './app/styles/mobile.css';
import './app/styles/disclosures.css';
// Installed workers can lag one version behind the newly loaded application bundle.
try {
  migrateProductStorage(localStorage);
} catch {
  /* Storage is optional. */
}
try {
  migrateProductStorage(sessionStorage);
} catch {
  /* Storage is optional. */
}
const client = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <Application />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
