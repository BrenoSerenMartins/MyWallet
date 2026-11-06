import { createClient } from '@supabase/supabase-js';
import { completeAuthCallback, isAuthCodeCallback } from './auth-callback';
const callbackUrl = new URL(window.location.href);
export const authClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      flowType: 'pkce',
      // The shared startup promise exchanges callback codes, avoiding competing consumers.
      detectSessionInUrl: !isAuthCodeCallback(callbackUrl),
    },
  },
);
export const authStartup = completeAuthCallback(authClient.auth, callbackUrl, (url) => {
  window.history.replaceState(window.history.state, '', url);
});
