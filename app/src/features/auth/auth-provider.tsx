import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { authClient } from '../../shared/api/auth-client';
const AuthContext = createContext<{ session: Session | null; loading: boolean }>({
  session: null,
  loading: true,
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    let owner: string | undefined;
    const update = (next: Session | null) => {
      if (!active) return;
      if (owner !== next?.user.id) {
        client.clear();
        owner = next?.user.id;
      }
      setSession(next);
      setLoading(false);
    };
    void authClient.auth.getSession().then(({ data }) => update(data.session));
    const { data } = authClient.auth.onAuthStateChange((_event, next) => update(next));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);
  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
