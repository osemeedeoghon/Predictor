interface AuthErrorLike {
  name?: string;
  code?: string;
  status?: number;
  message?: string;
}

/** Turns Supabase Auth errors into messages a club member can act on. */
export function friendlyAuthError(error: AuthErrorLike): string {
  const code = error.code ?? '';
  const message = error.message ?? '';

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return 'Incorrect email or password.';
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return 'Please confirm your email address first — check your inbox for the link.';
  }
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered/i.test(message)) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (code === 'weak_password') {
    return 'That password is too weak. Use at least 8 characters, mixing letters and numbers.';
  }
  if (code === 'email_address_invalid' || code === 'validation_failed') {
    return 'Please enter a valid email address.';
  }
  if (code === 'signup_disabled') {
    return 'New registrations are currently closed.';
  }
  if (code.startsWith('over_') || error.status === 429) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (
    error.name === 'AuthRetryableFetchError' ||
    error.status === 0 ||
    /failed to fetch|network/i.test(message)
  ) {
    return "Couldn't reach the sign-in service. Check your connection and try again.";
  }
  return 'Something went wrong. Please try again.';
}
