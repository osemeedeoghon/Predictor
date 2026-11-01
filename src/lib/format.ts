import type { Match, SetScore } from '../types';

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

export const formatMatchTime = (iso: string) => timeFormat.format(new Date(iso));

/** Accepts timestamps or plain dates; "2026-10-30" is treated as a local date, not UTC midnight. */
export function formatDate(value: string): string {
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = plain ? new Date(+plain[1], +plain[2] - 1, +plain[3]) : new Date(value);
  return dateFormat.format(date);
}

export function formatRelative(iso: string, now: Date): string {
  const minutes = Math.round((new Date(iso).getTime() - now.getTime()) / 60_000);
  const abs = Math.abs(minutes);
  const span = abs < 60 ? `${abs} min` : `${Math.floor(abs / 60)} h ${abs % 60} min`;
  if (minutes > 0) return `starts in ${span}`;
  if (minutes === 0) return 'starting now';
  return `started ${span} ago`;
}

/** "6–4, 7–5" from player A's perspective. */
export const formatSets = (sets: SetScore[]) => sets.map((s) => `${s.a}–${s.b}`).join(', ');

export const playerName = (match: Match, playerId: string) =>
  match.playerA.id === playerId ? match.playerA.name : match.playerB.name;
