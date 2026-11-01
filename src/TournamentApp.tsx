import { useCallback, useEffect, useMemo, useState } from 'react';
import { DemoNotice } from './components/DemoNotice';
import { Header, type Account, type View } from './components/Header';
import { JoinTournament } from './components/JoinTournament';
import { Leaderboard, LeaderboardUnavailable, ScoringRules } from './components/Leaderboard';
import { MatchesView } from './components/MatchesView';
import { ErrorState, LoadingState } from './components/StateMessage';
import { TournamentBar } from './components/TournamentBar';
import type { TournamentRepository } from './data/repository';
import { useAsync } from './hooks/useAsync';
import { useNow } from './hooks/useNow';
import { canPredict } from './lib/matchStatus';
import { buildLeaderboard } from './lib/scoring';
import { validatePrediction } from './lib/validation';
import type { Match, Prediction, SetScore } from './types';

interface TournamentAppProps {
  repository: TournamentRepository;
  getNow: () => Date;
  account: Account;
}

export function TournamentApp({ repository, getNow, account }: TournamentAppProps) {
  const now = useNow(getNow);
  const [view, setView] = useState<View>('matches');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const loadList = useCallback(() => repository.listTournaments(), [repository]);
  const { state: listState, retry: retryList } = useAsync(loadList);
  const tournaments = listState.status === 'ready' ? listState.data : [];
  const activeId =
    tournaments.find((t) => t.id === selectedId)?.id ?? tournaments[0]?.id ?? null;

  const loadTournament = useCallback(
    () => repository.getTournamentData(activeId!),
    [repository, activeId],
  );
  const tournament = useAsync(activeId ? loadTournament : null);
  const data = tournament.state.status === 'ready' ? tournament.state.data : null;

  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  useEffect(() => {
    setPredictions(
      data ? Object.fromEntries(data.currentUserPredictions.map((p) => [p.matchId, p])) : {},
    );
  }, [data]);

  // Scoring is demo-only for now; live tournaments get it in a later stage.
  const leaderboard = useMemo(
    () =>
      data && repository.isDemo
        ? buildLeaderboard(data.otherMembers, data.currentUser, predictions, data.matches)
        : [],
    [data, predictions, repository.isDemo],
  );

  const submitPrediction = useCallback(
    async (match: Match, winnerId: string, sets: SetScore[]) => {
      // Fast feedback only; the database enforces the lock and score rules.
      if (!canPredict(match, getNow())) {
        throw new Error('This match has started, so predictions are locked.');
      }
      if (!validatePrediction(match, { winnerId, sets }).valid) {
        throw new Error('This prediction is not a valid tennis score.');
      }
      const saved = await repository.submitPrediction({ matchId: match.id, winnerId, sets });
      setPredictions((prev) => ({ ...prev, [match.id]: saved }));
    },
    [repository, getNow],
  );

  const joinTournament = useCallback(
    async (code: string) => {
      const id = await repository.joinTournament(code);
      setSelectedId(id);
      setJoining(false);
      setView('matches');
      retryList();
    },
    [repository, retryList],
  );

  function renderBody() {
    if (listState.status === 'loading' || listState.status === 'idle') {
      return <LoadingState label="Loading your tournaments…" />;
    }
    if (listState.status === 'error') {
      return (
        <ErrorState
          title="Couldn't load your tournaments"
          message={listState.message}
          onRetry={retryList}
        />
      );
    }
    if (tournaments.length === 0 || joining) {
      return (
        <JoinTournament
          firstTime={tournaments.length === 0}
          onJoin={joinTournament}
          onCancel={tournaments.length > 0 ? () => setJoining(false) : undefined}
        />
      );
    }
    if (tournament.state.status === 'error') {
      return <ErrorState message={tournament.state.message} onRetry={tournament.retry} />;
    }
    if (!data) return <LoadingState />;

    return (
      <>
        {activeId && (
          <TournamentBar
            tournaments={tournaments}
            activeId={activeId}
            onSelect={setSelectedId}
            onJoinAnother={repository.isDemo ? undefined : () => setJoining(true)}
          />
        )}
        {view === 'matches' ? (
          <MatchesView
            key={data.tournament.id}
            data={data}
            predictions={predictions}
            you={leaderboard.find((e) => e.isCurrentUser)}
            isDemo={repository.isDemo}
            now={now}
            onSubmitPrediction={submitPrediction}
          />
        ) : (
          <div className="leaderboard-layout">
            {repository.isDemo ? <Leaderboard entries={leaderboard} /> : <LeaderboardUnavailable />}
            <ScoringRules planned={!repository.isDemo} />
          </div>
        )}
      </>
    );
  }

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header view={view} onNavigate={setView} account={account} />
      <main id="main" className="main">
        {account.kind === 'demo' && <DemoNotice canSignIn={Boolean(account.onExitDemo)} />}
        {renderBody()}
      </main>
      <footer className="site-footer">
        ClubPredict is an independent prototype. Not affiliated with or endorsed by any club.
      </footer>
    </div>
  );
}
