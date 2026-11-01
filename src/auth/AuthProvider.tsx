import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthService, AuthSession, SignUpInput } from './authService';

interface AuthContextValue {
  status: 'loading' | 'signedOut' | 'signedIn';
  session: AuthSession | null;
  /** Set when the stored session could not be restored. */
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ service, children }: { service: AuthService; children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    // Restores a persisted session, then follows sign-in/out and token refresh.
    const unsubscribe = service.onAuthStateChange((next) => {
      if (!active) return;
      setSession(next);
      setLoading(false);
    });
    service
      .getSession()
      .then((current) => active && setSession(current))
      .catch((err: unknown) => active && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [service]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: loading ? 'loading' : session ? 'signedIn' : 'signedOut',
      session,
      error,
      signIn: (email, password) => service.signIn(email, password),
      signUp: (input) => service.signUp(input),
      signOut: () => service.signOut(),
    }),
    [loading, session, error, service],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
