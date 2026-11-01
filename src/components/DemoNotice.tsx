import { Info } from 'lucide-react';

/** `canSignIn` is false when Supabase is not configured for this build. */
export function DemoNotice({ canSignIn }: { canSignIn: boolean }) {
  return (
    <div className="demo-notice" role="note">
      <Info aria-hidden size={18} />
      <p>
        <strong>Demo mode.</strong> Players, members and results are fictional. Predictions stay
        on this page only and are not sent to any server — they reset when you reload.
        {!canSignIn && ' Accounts are unavailable because no Supabase project is configured.'}
      </p>
    </div>
  );
}
