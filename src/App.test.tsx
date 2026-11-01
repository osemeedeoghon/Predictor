import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import type { AuthService, AuthSession } from './auth/authService';
import { createMockRepository, type TournamentRepository } from './data/repository';

const NOW = new Date('2026-10-17T12:00:00Z');
const getNow = () => NOW;
const ALICE: AuthSession = { user: { id: 'u-alice', email: 'alice@example.test', displayName: 'Alice' } };

/** In-memory stand-in for Supabase Auth, including session persistence. */
function createFakeAuth(initial: AuthSession | null = null) {
  let session = initial;
  const listeners = new Set<(s: AuthSession | null) => void>();
  const emit = () => listeners.forEach((l) => l(session));
  const service = {
    getSession: vi.fn(async () => session),
    onAuthStateChange: (listener: (s: AuthSession | null) => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    signIn: vi.fn(async (email: string, password: string) => {
      if (password !== 'correct-horse') throw new Error('Incorrect email or password.');
      session = { user: { ...ALICE.user, email } };
      emit();
    }),
    signUp: vi.fn(async () => ({ needsEmailConfirmation: true })),
    signOut: vi.fn(async () => {
      session = null;
      emit();
    }),
  } satisfies AuthService;
  return service;
}

/** Behaves like the Supabase repository: membership-gated and server-validated. */
function createLiveFake({ member = false, submitError }: { member?: boolean; submitError?: Error } = {}) {
  let joined = member;
  const demo = createMockRepository({ now: getNow });
  return {
    isDemo: false,
    listTournaments: vi.fn(async () => (joined ? demo.listTournaments() : [])),
    getTournamentData: vi.fn((id: string) => demo.getTournamentData(id)),
    submitPrediction: vi.fn(async (input) => {
      if (submitError) throw submitError;
      return demo.submitPrediction(input);
    }),
    joinTournament: vi.fn(async (code: string) => {
      if (code !== 'AUTUMNDEMO') throw new Error('That invitation code is not valid or has expired.');
      joined = true;
      return 't-autumn-demo';
    }),
  } satisfies TournamentRepository;
}

function renderApp(options: { session?: AuthSession | null; repo?: TournamentRepository } = {}) {
  const auth = createFakeAuth(options.session ?? null);
  const repo = options.repo ?? createLiveFake({ member: true });
  const user = userEvent.setup();
  render(
    <App
      auth={auth}
      createRepository={() => repo}
      demoRepository={createMockRepository({ now: getNow })}
      getNow={getNow}
    />,
  );
  return { auth, repo, user };
}

describe('authentication', () => {
  it('shows the sign-in screen when there is no session', async () => {
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
  });

  it('validates the form before contacting the server', async () => {
    const { auth, user } = renderApp();
    await screen.findByRole('heading', { name: 'Sign in' });
    await user.click(submitButton('Sign in'));
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('shows a helpful message when sign-in fails', async () => {
    const { user } = renderApp();
    await screen.findByRole('heading', { name: 'Sign in' });
    await user.type(screen.getByLabelText('Email'), 'alice@example.test');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(submitButton('Sign in'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
  });

  it('signs in, shows the member, and signs out again', async () => {
    const { auth, user } = renderApp();
    await screen.findByRole('heading', { name: 'Sign in' });
    await user.type(screen.getByLabelText('Email'), 'alice@example.test');
    await user.type(screen.getByLabelText('Password'), 'correct-horse');
    await user.click(submitButton('Sign in'));

    expect(await screen.findByRole('heading', { name: 'Autumn Club Championships — Demo' })).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByRole('note')).not.toBeInTheDocument(); // no demo banner when signed in

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(auth.signOut).toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('restores a persisted session without asking to sign in again', async () => {
    renderApp({ session: ALICE });
    expect(await screen.findByRole('heading', { name: 'Autumn Club Championships — Demo' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('registers and explains email confirmation', async () => {
    const { auth, user } = renderApp();
    await screen.findByRole('heading', { name: 'Sign in' });
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await user.type(screen.getByLabelText('Display name'), 'Alice');
    await user.type(screen.getByLabelText('Email'), 'alice@example.test');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(submitButton('Create account'));
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(auth.signUp).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Password'), '-but-now-long');
    await user.click(submitButton('Create account'));
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'alice@example.test',
      password: 'short-but-now-long',
      displayName: 'Alice',
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Check alice@example.test for a confirmation link',
    );
  });

  it('offers the clearly labelled demo and a way back to sign in', async () => {
    const { user } = renderApp();
    await user.click(await screen.findByRole('button', { name: 'Explore the demo instead' }));
    expect(await screen.findByRole('note')).toHaveTextContent(/demo mode/i);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('runs demo-only when Supabase is not configured', async () => {
    render(<App auth={null} demoRepository={createMockRepository({ now: getNow })} getNow={getNow} />);
    expect(await screen.findByRole('note')).toHaveTextContent(/no Supabase project is configured/);
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
  });
});

describe('tournament membership', () => {
  it('asks members without tournaments for an invitation code', async () => {
    const repo = createLiveFake({ member: false });
    const { user } = renderApp({ session: ALICE, repo });
    expect(await screen.findByRole('heading', { name: 'Join your first tournament' })).toBeInTheDocument();

    const input = screen.getByLabelText('Invitation code');
    await user.type(input, 'abc');
    await user.click(screen.getByRole('button', { name: 'Join tournament' }));
    expect(screen.getByRole('alert')).toHaveTextContent('8–16 letters or numbers');
    expect(repo.joinTournament).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, 'WRONGCODE1');
    await user.click(screen.getByRole('button', { name: 'Join tournament' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not valid or has expired');

    await user.clear(input);
    await user.type(input, 'autumn-demo');
    await user.click(screen.getByRole('button', { name: 'Join tournament' }));
    expect(repo.joinTournament).toHaveBeenLastCalledWith('AUTUMNDEMO');
    expect(await screen.findByRole('heading', { name: 'Autumn Club Championships — Demo' })).toBeInTheDocument();
  });

  it('shows a retryable error when tournaments fail to load', async () => {
    const repo = createLiveFake({ member: true });
    repo.listTournaments.mockRejectedValueOnce(new Error("Couldn't reach the server."));
    const { user } = renderApp({ session: ALICE, repo });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load your tournaments");
    await user.click(within(alert).getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('heading', { name: 'Autumn Club Championships — Demo' })).toBeInTheDocument();
  });
});

describe('live predictions', () => {
  it('shows server rejections instead of pretending the prediction saved', async () => {
    const repo = createLiveFake({
      member: true,
      submitError: new Error('This match has started, so predictions are locked.'),
    });
    const { user } = renderApp({ session: ALICE, repo });
    await screen.findAllByRole('article');
    await user.click(screen.getByRole('button', { name: /make prediction for imogen vance/i }));
    await user.click(screen.getByRole('radio', { name: /imogen vance/i }));
    await user.click(screen.getByRole('radio', { name: '2–0' }));
    for (const set of [1, 2]) {
      await user.selectOptions(screen.getByLabelText(`Set ${set}: games for Imogen Vance`), '6');
      await user.selectOptions(screen.getByLabelText(`Set ${set}: games for Theo Brannigan`), '3');
    }
    await user.click(screen.getByRole('button', { name: 'Submit prediction' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('predictions are locked');
    expect(screen.queryByText(/prediction saved/i)).not.toBeInTheDocument();
    const card = screen.getAllByRole('article').find((a) => a.textContent?.includes('Imogen Vance'))!;
    expect(card).toHaveTextContent('No prediction yet');
  });

  it('confirms saved predictions without demo wording', async () => {
    const repo = createLiveFake({ member: true });
    const { user } = renderApp({ session: ALICE, repo });
    await screen.findAllByRole('article');
    await user.click(screen.getByRole('button', { name: /make prediction for imogen vance/i }));
    await user.click(screen.getByRole('radio', { name: /imogen vance/i }));
    await user.click(screen.getByRole('radio', { name: '2–0' }));
    for (const set of [1, 2]) {
      await user.selectOptions(screen.getByLabelText(`Set ${set}: games for Imogen Vance`), '6');
      await user.selectOptions(screen.getByLabelText(`Set ${set}: games for Theo Brannigan`), '3');
    }
    await user.click(screen.getByRole('button', { name: 'Submit prediction' }));

    expect(await screen.findByText('Prediction saved')).toBeInTheDocument();
    expect(screen.queryByText(/demo session/i)).not.toBeInTheDocument();
    expect(repo.submitPrediction).toHaveBeenCalledWith({
      matchId: 'm-qf4',
      winnerId: 'p-vance',
      sets: [{ a: 6, b: 3 }, { a: 6, b: 3 }],
    });
  });

  it('does not show demo points or a leaderboard for live tournaments yet', async () => {
    const { user } = renderApp({ session: ALICE });
    await screen.findAllByRole('article');
    expect(screen.queryByText(/your points/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Leaderboard' }));
    expect(screen.getByRole('heading', { name: 'Leaderboard not available yet' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

/** The form's submit button (the tab with the same label is type="button"). */
function submitButton(name: string) {
  return screen.getAllByRole('button', { name }).find((b) => b.getAttribute('type') === 'submit')!;
}
