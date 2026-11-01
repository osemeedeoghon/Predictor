import type { Match, Player, TournamentData } from '../types';

// Entirely fictional players, members and tournament. Any resemblance to
// real people or clubs is coincidental.

const players = {
  hale: { id: 'p-hale', name: 'Rowan Hale', seed: 1 },
  castell: { id: 'p-castell', name: 'Priya Castell', seed: 4 },
  okafor: { id: 'p-okafor', name: 'Sasha Okafor', seed: 2 },
  pell: { id: 'p-pell', name: 'Jonah Pell' },
  vance: { id: 'p-vance', name: 'Imogen Vance', seed: 3 },
  brannigan: { id: 'p-brannigan', name: 'Theo Brannigan' },
  marwick: { id: 'p-marwick', name: 'Elena Marwick' },
  rook: { id: 'p-rook', name: 'Callum Rook' },
  fairweather: { id: 'p-fairweather', name: 'Lena Fairweather' },
  quill: { id: 'p-quill', name: 'Adrian Quill' },
  deverell: { id: 'p-deverell', name: 'Mira Deverell' },
  ashdown: { id: 'p-ashdown', name: 'Felix Ashdown' },
} satisfies Record<string, Player>;

const MINUTE = 60_000;

/**
 * Builds demo data with match times relative to `now`, so the demo always
 * shows a mix of completed, locked (in play) and upcoming matches.
 */
export function createMockTournamentData(now: Date): TournamentData {
  const at = (minutesFromNow: number) =>
    new Date(Math.round(now.getTime() / MINUTE + minutesFromNow) * MINUTE).toISOString();

  const matches: Match[] = [
    {
      id: 'm-qf1',
      round: 'Quarter-final',
      court: 'Court 1',
      scheduledAt: at(-180),
      bestOf: 3,
      playerA: players.hale,
      playerB: players.rook,
      result: { winnerId: players.hale.id, sets: [{ a: 6, b: 3 }, { a: 6, b: 4 }] },
    },
    {
      id: 'm-qf2',
      round: 'Quarter-final',
      court: 'Court 2',
      scheduledAt: at(-170),
      bestOf: 3,
      playerA: players.castell,
      playerB: players.marwick,
      result: {
        winnerId: players.castell.id,
        sets: [{ a: 4, b: 6 }, { a: 7, b: 5 }, { a: 6, b: 2 }],
      },
    },
    {
      id: 'm-qf3',
      round: 'Quarter-final',
      court: 'Court 1',
      scheduledAt: at(-25),
      bestOf: 3,
      playerA: players.okafor,
      playerB: players.pell,
    },
    {
      id: 'm-qf4',
      round: 'Quarter-final',
      court: 'Court 3',
      scheduledAt: at(45),
      bestOf: 3,
      playerA: players.vance,
      playerB: players.brannigan,
    },
    {
      id: 'm-plate1',
      round: 'Plate semi-final',
      court: 'Court 2',
      scheduledAt: at(90),
      bestOf: 3,
      playerA: players.fairweather,
      playerB: players.quill,
    },
    {
      id: 'm-plate2',
      round: 'Plate semi-final',
      court: 'Court 4',
      scheduledAt: at(150),
      bestOf: 3,
      playerA: players.deverell,
      playerB: players.ashdown,
    },
  ];

  return {
    tournament: {
      id: 't-autumn-demo',
      name: 'Autumn Club Championships — Demo',
      venue: 'Fictional Lawn Tennis Club',
      startsOn: at(-60 * 24),
      endsOn: at(60 * 24 * 2),
      isDemo: true,
    },
    role: 'member',
    matches,
    currentUser: { id: 'u-you', displayName: 'You (demo)' },
    currentUserPredictions: [
      {
        matchId: 'm-qf1',
        winnerId: players.hale.id,
        sets: [{ a: 6, b: 3 }, { a: 6, b: 2 }],
        submittedAt: at(-240),
      },
      {
        matchId: 'm-qf2',
        winnerId: players.marwick.id,
        sets: [{ a: 6, b: 4 }, { a: 4, b: 6 }, { a: 3, b: 6 }],
        submittedAt: at(-240),
      },
    ],
    otherMembers: [
      { member: { id: 'u-1', displayName: 'BaselineBea' }, points: 14, predictionsMade: 4 },
      { member: { id: 'u-2', displayName: 'SliceAndDice' }, points: 11, predictionsMade: 4 },
      { member: { id: 'u-3', displayName: 'NetRusher' }, points: 9, predictionsMade: 3 },
      { member: { id: 'u-4', displayName: 'DropShotDan' }, points: 6, predictionsMade: 4 },
      { member: { id: 'u-5', displayName: 'AceOfClubs' }, points: 6, predictionsMade: 2 },
      { member: { id: 'u-6', displayName: 'LobLegend' }, points: 2, predictionsMade: 3 },
    ],
  };
}
