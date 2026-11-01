import { ListOrdered, LogIn, LogOut, Trophy } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { BrandMark } from './BrandMark';

export type View = 'matches' | 'leaderboard';

/** Who is using the app: a signed-in member or a visitor in the demo. */
export type Account =
  | { kind: 'demo'; onExitDemo?: () => void }
  | { kind: 'member'; label: string; onSignOut: () => Promise<void> };

const NAV_ITEMS: Array<{ view: View; label: string; icon: ReactNode }> = [
  { view: 'matches', label: 'Matches', icon: <Trophy aria-hidden size={20} /> },
  { view: 'leaderboard', label: 'Leaderboard', icon: <ListOrdered aria-hidden size={20} /> },
];

interface HeaderProps {
  view: View;
  onNavigate: (view: View) => void;
  account: Account;
}

/** Brand bar. The nav sits inline on desktop and docks to the bottom on mobile. */
export function Header({ view, onNavigate, account }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a className="brand" href="/" aria-label="ClubPredict home">
          <BrandMark />
          <span className="brand__name">ClubPredict</span>
          {account.kind === 'demo' && <span className="demo-pill">Demo</span>}
        </a>
        <nav className="primary-nav" aria-label="Primary">
          <ul>
            {NAV_ITEMS.map((item) => (
              <li key={item.view}>
                <button
                  type="button"
                  className="primary-nav__link"
                  aria-current={view === item.view ? 'page' : undefined}
                  onClick={() => onNavigate(item.view)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <AccountControls account={account} />
      </div>
    </header>
  );
}

function AccountControls({ account }: { account: Account }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (account.kind === 'demo') {
    if (!account.onExitDemo) return null;
    return (
      <div className="account">
        <button type="button" className="account__button" onClick={account.onExitDemo}>
          <LogIn aria-hidden size={18} />
          <span>Sign in</span>
        </button>
      </div>
    );
  }

  async function handleSignOut() {
    if (account.kind !== 'member') return;
    setBusy(true);
    setError(null);
    try {
      await account.onSignOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign out failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="account">
      {error && (
        <span className="account__error" role="alert">
          {error}
        </span>
      )}
      <span className="account__name" title={account.label}>
        {account.label}
      </span>
      <button type="button" className="account__button" onClick={handleSignOut} disabled={busy}>
        <LogOut aria-hidden size={18} />
        <span>{busy ? 'Signing out…' : 'Sign out'}</span>
      </button>
    </div>
  );
}
