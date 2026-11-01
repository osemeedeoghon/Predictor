export type AuthMode = 'signIn' | 'signUp';

export interface AuthFormValues {
  email: string;
  password: string;
  displayName: string;
}

export type AuthFormErrors = Partial<Record<keyof AuthFormValues, string>>;

export const MIN_PASSWORD_LENGTH = 8;
// bcrypt (used by Supabase Auth) ignores bytes beyond 72.
export const MAX_PASSWORD_LENGTH = 72;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Client-side checks for fast feedback; Supabase Auth re-validates everything. */
export function validateAuthForm(mode: AuthMode, values: AuthFormValues): AuthFormErrors {
  const errors: AuthFormErrors = {};
  const email = values.email.trim();

  if (!email) errors.email = 'Enter your email address.';
  else if (!EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address.';

  if (!values.password) {
    errors.password = 'Enter your password.';
  } else if (mode === 'signUp' && values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  } else if (mode === 'signUp' && values.password.length > MAX_PASSWORD_LENGTH) {
    errors.password = `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  }

  if (mode === 'signUp') {
    const name = values.displayName.trim();
    if (name.length < 2 || name.length > 40) {
      errors.displayName = 'Display name must be 2–40 characters.';
    }
  }

  return errors;
}
