import { DataShapeError } from './mappers';

interface DbErrorLike {
  code?: string;
  message?: string;
}

/**
 * Maps PostgREST / Postgres errors to messages for members. Codes CPxxx are
 * raised by our own database functions (see the migration).
 */
export function toAppError(error: unknown, action: string): Error {
  if (error instanceof DataShapeError) {
    return new Error(`Some ${action} data looks wrong, so it can't be shown. ${error.message}`);
  }
  const { code = '', message = '' } = (error ?? {}) as DbErrorLike;

  switch (code) {
    case 'CP001':
      return new Error('This match has started, so predictions are locked.');
    case 'CP002':
    case 'CP003':
      return new Error(message || 'That prediction is not valid for this match.');
    case 'CP010':
      return new Error('That invitation code is not valid or has expired.');
    case '42501':
      return new Error(
        /row-level security/i.test(message)
          ? "You can't do that here. The match may have locked, or you may not be a member of this tournament."
          : "You don't have permission to do that.",
      );
    case 'PGRST301':
    case '28000':
      return new Error('Your session has expired. Please sign in again.');
  }
  if (/failed to fetch|network|load failed/i.test(message)) {
    return new Error("Couldn't reach the server. Check your connection and try again.");
  }
  return new Error(`Something went wrong while trying to ${action}. Please try again.`);
}
