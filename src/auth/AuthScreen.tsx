import { CircleCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { BrandMark } from '../components/BrandMark';
import { useAuth } from './AuthProvider';
import {
  MIN_PASSWORD_LENGTH,
  validateAuthForm,
  type AuthFormErrors,
  type AuthFormValues,
  type AuthMode,
} from './authValidation';

interface AuthScreenProps {
  onTryDemo: () => void;
  initialError?: string | null;
}

const EMPTY: AuthFormValues = { email: '', password: '', displayName: '' };

export function AuthScreen({ onTryDemo, initialError = null }: AuthScreenProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [values, setValues] = useState<AuthFormValues>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<AuthFormErrors>({});
  const [formError, setFormError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setFieldErrors({});
    setFormError(null);
    setNotice(null);
  };

  const update = (field: keyof AuthFormValues) => (value: string) =>
    setValues((v) => ({ ...v, [field]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setNotice(null);
    const errors = validateAuthForm(mode, values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const email = values.email.trim();
      if (mode === 'signIn') {
        await signIn(email, values.password);
      } else {
        const { needsEmailConfirmation } = await signUp({
          email,
          password: values.password,
          displayName: values.displayName.trim(),
        });
        if (needsEmailConfirmation) {
          setMode('signIn');
          setValues((v) => ({ ...v, password: '' }));
          setNotice(`Check ${email} for a confirmation link, then sign in.`);
        }
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const isSignUp = mode === 'signUp';

  return (
    <div className="auth-page">
      <main className="auth-card" aria-labelledby="auth-title">
        <div className="auth-card__brand">
          <BrandMark />
          <span className="brand__name">ClubPredict</span>
        </div>
        <h1 id="auth-title" className="auth-card__title">
          {isSignUp ? 'Create your account' : 'Sign in'}
        </h1>
        <p className="muted">
          Predict results in your club's private tournaments. You'll need an invitation code from
          an organizer to join one.
        </p>

        <div className="auth-tabs" role="group" aria-label="Account">
          <button type="button" aria-pressed={!isSignUp} onClick={() => switchMode('signIn')}>
            Sign in
          </button>
          <button type="button" aria-pressed={isSignUp} onClick={() => switchMode('signUp')}>
            Create account
          </button>
        </div>

        {notice && (
          <div className="confirmation" role="status">
            <CircleCheck aria-hidden size={20} />
            <p>{notice}</p>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {isSignUp && (
            <TextField
              id="displayName"
              label="Display name"
              hint="Shown to other members of your tournaments."
              autoComplete="nickname"
              value={values.displayName}
              error={fieldErrors.displayName}
              onChange={update('displayName')}
            />
          )}
          <TextField
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            value={values.email}
            error={fieldErrors.email}
            onChange={update('email')}
          />
          <TextField
            id="password"
            label="Password"
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            hint={isSignUp ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
            value={values.password}
            error={fieldErrors.password}
            onChange={update('password')}
          />

          {formError && (
            <div className="form-errors" role="alert">
              <p>{formError}</p>
            </div>
          )}

          <button type="submit" className="button button--primary button--block" disabled={submitting}>
            {submitting ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <div className="auth-card__demo">
          <button type="button" className="button button--ghost" onClick={onTryDemo}>
            Explore the demo instead
          </button>
          <p className="muted">Fictional data, nothing is saved.</p>
        </div>
      </main>
      <p className="site-footer">
        ClubPredict is an independent prototype. Not affiliated with or endorsed by any club.
      </p>
    </div>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password';
  autoComplete?: string;
  hint?: string;
  error?: string;
}

function TextField({ id, label, value, onChange, type = 'text', autoComplete, hint, error }: TextFieldProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="text-input"
        type={type}
        autoComplete={autoComplete}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
