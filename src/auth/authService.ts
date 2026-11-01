import type { Session } from '@supabase/supabase-js';
import type { ClubPredictClient } from '../lib/supabase';
import { friendlyAuthError } from './authErrors';

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

export interface AuthSession {
  user: AuthUser;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
}

/** Narrow auth API the UI depends on; implemented by Supabase Auth. */
export interface AuthService {
  getSession(): Promise<AuthSession | null>;
  onAuthStateChange(listener: (session: AuthSession | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  /** Resolves with whether the user must confirm their email before signing in. */
  signUp(input: SignUpInput): Promise<{ needsEmailConfirmation: boolean }>;
  signOut(): Promise<void>;
}

function toAuthSession(session: Session | null): AuthSession | null {
  if (!session) return null;
  const meta = session.user.user_metadata as { display_name?: unknown } | undefined;
  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? null,
      displayName: typeof meta?.display_name === 'string' ? meta.display_name : null,
    },
  };
}

export function createSupabaseAuthService(client: ClubPredictClient): AuthService {
  return {
    async getSession() {
      const { data, error } = await client.auth.getSession();
      if (error) throw new Error(friendlyAuthError(error));
      return toAuthSession(data.session);
    },
    onAuthStateChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) =>
        listener(toAuthSession(session)),
      );
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(friendlyAuthError(error));
    },
    async signUp({ email, password, displayName }) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw new Error(friendlyAuthError(error));
      // With email confirmation enabled Supabase returns no session.
      return { needsEmailConfirmation: !data.session };
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw new Error(friendlyAuthError(error));
    },
  };
}
