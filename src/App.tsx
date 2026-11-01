import { useMemo, useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { AuthScreen } from './auth/AuthScreen';
import { createSupabaseAuthService, type AuthService } from './auth/authService';
import { LoadingState } from './components/StateMessage';
import { createMockRepository, type TournamentRepository } from './data/repository';
import { createSupabaseRepository } from './data/supabaseRepository';
import { supabase } from './lib/supabase';
import { TournamentApp } from './TournamentApp';

const systemNow = () => new Date();

const defaultDemoRepository = createMockRepository({
  delayMs: 500,
  fail: new URLSearchParams(window.location.search).has('demoError'),
});

const defaultAuth = supabase ? createSupabaseAuthService(supabase) : null;
const defaultCreateRepository = (userId: string) => createSupabaseRepository(supabase!, userId);

interface AppProps {
  /** Null when Supabase is not configured: the app runs the labelled demo only. */
  auth?: AuthService | null;
  createRepository?: (userId: string) => TournamentRepository;
  demoRepository?: TournamentRepository;
  getNow?: () => Date;
}

export default function App({
  auth = defaultAuth,
  createRepository = defaultCreateRepository,
  demoRepository = defaultDemoRepository,
  getNow = systemNow,
}: AppProps) {
  if (!auth) {
    return <TournamentApp repository={demoRepository} getNow={getNow} account={{ kind: 'demo' }} />;
  }
  return (
    <AuthProvider service={auth}>
      <AuthGate createRepository={createRepository} demoRepository={demoRepository} getNow={getNow} />
    </AuthProvider>
  );
}

interface AuthGateProps {
  createRepository: (userId: string) => TournamentRepository;
  demoRepository: TournamentRepository;
  getNow: () => Date;
}

function AuthGate({ createRepository, demoRepository, getNow }: AuthGateProps) {
  const auth = useAuth();
  const [inDemo, setInDemo] = useState(false);
  const user = auth.session?.user ?? null;
  const userId = user?.id ?? null;

  const repository = useMemo(
    () => (userId ? createRepository(userId) : null),
    [userId, createRepository],
  );

  if (inDemo) {
    return (
      <TournamentApp
        repository={demoRepository}
        getNow={getNow}
        account={{ kind: 'demo', onExitDemo: () => setInDemo(false) }}
      />
    );
  }

  if (auth.status === 'loading') {
    return (
      <div className="auth-page">
        <LoadingState label="Checking your session…" />
      </div>
    );
  }

  if (!user || !repository) {
    return <AuthScreen onTryDemo={() => setInDemo(true)} initialError={auth.error} />;
  }

  return (
    <TournamentApp
      key={user.id}
      repository={repository}
      getNow={getNow}
      account={{
        kind: 'member',
        label: user.displayName ?? user.email ?? 'Signed in',
        onSignOut: auth.signOut,
      }}
    />
  );
}
