import { describe, expect, it } from 'vitest';
import { friendlyAuthError } from './authErrors';
import { validateAuthForm } from './authValidation';

describe('friendlyAuthError', () => {
  it.each([
    [{ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'Incorrect email or password.'],
    [{ message: 'Invalid login credentials' }, 'Incorrect email or password.'],
    [{ code: 'email_not_confirmed' }, /confirm your email/],
    [{ code: 'user_already_exists' }, /already exists/],
    [{ code: 'weak_password' }, /too weak/],
    [{ code: 'over_request_rate_limit', status: 429 }, /too many attempts/i],
    [{ status: 429 }, /too many attempts/i],
    [{ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' }, /couldn't reach/i],
    [{ code: 'signup_disabled' }, /closed/],
    [{ code: 'something_new', message: 'internal detail' }, 'Something went wrong. Please try again.'],
  ])('maps %o', (error, expected) => {
    expect(friendlyAuthError(error)).toMatch(expected);
  });

  it('never echoes raw server messages for unknown errors', () => {
    expect(friendlyAuthError({ message: 'pq: relation auth.users does not exist' })).not.toMatch(/auth\.users/);
  });
});

describe('validateAuthForm', () => {
  const valid = { email: 'alice@example.test', password: 'long-enough', displayName: 'Alice' };

  it('accepts valid sign-in and sign-up details', () => {
    expect(validateAuthForm('signIn', valid)).toEqual({});
    expect(validateAuthForm('signUp', valid)).toEqual({});
  });

  it('requires a well-formed email and a password', () => {
    expect(validateAuthForm('signIn', { ...valid, email: '', password: '' })).toEqual({
      email: 'Enter your email address.',
      password: 'Enter your password.',
    });
    expect(validateAuthForm('signIn', { ...valid, email: 'not-an-email' }).email).toBe(
      'Enter a valid email address.',
    );
  });

  it('only enforces password length and display name on sign-up', () => {
    const short = { ...valid, password: 'short', displayName: '' };
    expect(validateAuthForm('signIn', short)).toEqual({});
    expect(validateAuthForm('signUp', short)).toEqual({
      password: 'Use at least 8 characters.',
      displayName: 'Display name must be 2–40 characters.',
    });
    expect(validateAuthForm('signUp', { ...valid, password: 'x'.repeat(73) }).password).toMatch(/at most 72/);
    expect(validateAuthForm('signUp', { ...valid, displayName: ' A ' }).displayName).toBeDefined();
  });
});
