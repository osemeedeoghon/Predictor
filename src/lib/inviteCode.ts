/** Uppercases and strips spaces/hyphens, matching join_tournament() in SQL. */
export const normalizeInviteCode = (raw: string) => raw.replace(/[\s-]/g, '').toUpperCase();

export const isValidInviteCode = (code: string) => /^[A-Z0-9]{8,16}$/.test(code);
