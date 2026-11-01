import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TournamentApp } from './TournamentApp';
import { MatchList } from './components/MatchList';
import { createMockRepository } from './data/repository';

const NOW = new Date('2026-10-17T12:00:00Z');
const getNow = () => NOW;

function renderApp(options: { fail?: boolean } = {}) {
  const repository = createMockRepository({ now: getNow, ...options });
  return { user: userEvent.setup(), ...render(<TournamentApp repository={repository} getNow={getNow} account={{ kind: 'demo' }} />) };
}

const matchCard = (name: RegExp) =>
  screen.getAllByRole('article').find((el) => name.test(el.textContent ?? ''))!;

describe('ClubPredict app', () => {
  it('shows a loading state, then the demo tournament and matches', async () => {
    renderApp();
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    expect(
      await screen.findByRole('heading', { name: 'Autumn Club Championships — Demo' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/demo mode/i);
    expect(screen.getAllByRole('article')).toHaveLength(6);
    expect(within(matchCard(/Imogen Vance/)).getByText('Open')).toBeInTheDocument();
    expect(within(matchCard(/Sasha Okafor/)).getByText('Locked')).toBeInTheDocument();
    expect(within(matchCard(/Rowan Hale/)).getByText('Completed')).toBeInTheDocument();
  });

  it('shows an error state with a working retry button', async () => {
    const { user } = renderApp({ fail: true });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/couldn't load your tournaments/i);
    await user.click(within(alert).getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('blocks incomplete or impossible predictions', async () => {
    const { user } = renderApp();
    await screen.findAllByRole('article');
    await user.click(screen.getByRole('button', { name: /make prediction for imogen vance/i }));

    await user.click(screen.getByRole('button', { name: 'Submit prediction' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose who you think will win.');

    await user.click(screen.getByRole('radio', { name: /imogen vance/i }));
    await user.click(screen.getByRole('radio', { name: '2–0' }));
    await user.selectOptions(screen.getByLabelText('Set 1: games for Imogen Vance'), '6');
    await user.selectOptions(screen.getByLabelText('Set 1: games for Theo Brannigan'), '5');
    await user.click(screen.getByRole('button', { name: 'Submit prediction' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/complete every set/i);
    expect(screen.getByLabelText('Set 1: games for Imogen Vance')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(matchCard(/Imogen Vance/)).toHaveTextContent('No prediction yet');
  });

  it('submits a valid prediction and updates the interface', async () => {
    const { user } = renderApp();
    await screen.findAllByRole('article');
    await user.click(screen.getByRole('button', { name: /make prediction for imogen vance/i }));

    await user.click(screen.getByRole('radio', { name: /theo brannigan/i }));
    await user.click(screen.getByRole('radio', { name: '2–1' }));
    const scores: Array<[string, string]> = [
      ['4', '6'],
      ['7', '5'],
      ['3', '6'],
    ];
    for (const [i, [a, b]] of scores.entries()) {
      await user.selectOptions(screen.getByLabelText(`Set ${i + 1}: games for Imogen Vance`), a);
      await user.selectOptions(screen.getByLabelText(`Set ${i + 1}: games for Theo Brannigan`), b);
    }
    await user.click(screen.getByRole('button', { name: 'Submit prediction' }));

    const confirmation = await screen.findByText(/prediction recorded for this demo session/i);
    expect(confirmation.closest('[role="status"]')).toHaveTextContent(/not saved to a server/i);
    expect(matchCard(/Imogen Vance/)).toHaveTextContent(
      'Your pick: Theo Brannigan, 4–6, 7–5, 3–6',
    );
    expect(screen.getByRole('button', { name: 'Update prediction' })).toBeInTheDocument();

    // Prediction count on the leaderboard reflects the new pick (2 seeded + 1).
    await user.click(screen.getByRole('button', { name: 'Leaderboard' }));
    const youRow = screen.getByRole('row', { name: /you \(demo\)/i });
    expect(within(youRow).getAllByRole('cell')[1]).toHaveTextContent('3');
  });

  it('does not allow predictions on locked or completed matches', async () => {
    const { user } = renderApp();
    await screen.findAllByRole('article');

    await user.click(screen.getByRole('button', { name: /view details for sasha okafor/i }));
    expect(screen.getByText(/predictions closed when this match started/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit prediction/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /view details for rowan hale/i }));
    expect(screen.getByText(/this match is complete/i)).toBeInTheDocument();
    expect(screen.getByText('Points earned').nextSibling).toHaveTextContent('6');
  });

  it('shows an empty state when no matches fit the filter', () => {
    render(<MatchList matches={[]} predictions={{}} selectedId={null} now={NOW} onSelect={() => {}} />);
    expect(screen.getByRole('heading', { name: 'No matches here' })).toBeInTheDocument();
  });

  it('filters matches by status', async () => {
    const { user } = renderApp();
    await screen.findAllByRole('article');
    await user.click(screen.getByRole('button', { name: /^locked/i }));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^locked/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('navigates between matches and leaderboard', async () => {
    const { user } = renderApp();
    await screen.findAllByRole('article');
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    await user.click(within(nav).getByRole('button', { name: 'Leaderboard' }));
    expect(within(nav).getByRole('button', { name: 'Leaderboard' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('heading', { name: 'Leaderboard' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /baselinebea/i })).toBeInTheDocument();
  });
});
