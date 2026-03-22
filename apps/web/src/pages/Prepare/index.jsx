import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { formatFixtureDate } from '../../domain/fixtures';
import './prepare.css';

function parseGameIdFromHash() {
  const raw = window.location.hash || '';
  const idx = raw.indexOf('?');
  if (idx < 0) return null;
  const qs = new URLSearchParams(raw.slice(idx + 1));
  const value = Number(qs.get('gameId'));
  return Number.isFinite(value) ? value : null;
}

export function Prepare() {
  const { scheduleGames, fetchSchedule } = useGameStore();
  const [selectedGameId, setSelectedGameId] = useState(parseGameIdFromHash());

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const upcomingFixtures = useMemo(
    () => (scheduleGames || [])
      .filter((g) => (g.status || '').toLowerCase() === 'scheduled')
      .sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate)),
    [scheduleGames],
  );

  useEffect(() => {
    if (!upcomingFixtures.length) return;
    if (selectedGameId && upcomingFixtures.some((g) => g.id === selectedGameId)) return;
    setSelectedGameId(upcomingFixtures[0].id);
  }, [upcomingFixtures, selectedGameId]);

  const selectedGame = upcomingFixtures.find((g) => g.id === selectedGameId) || null;

  const goto = (page) => {
    window.location.hash = page;
  };

  return (
    <div className="prepare-page prepare-hub-page">
      <header className="prepare-hub-header">
        <div>
          <h1>Match Preparation Hub</h1>
          <p>Choose where to prepare your team before tipoff.</p>
        </div>
      </header>

      <section className="prepare-card prepare-fixtures-card">
        <h3>Upcoming Fixtures</h3>
        <div className="prepare-fixtures-row">
          {upcomingFixtures.slice(0, 5).map((fixture) => (
            <button
              key={fixture.id}
              type="button"
              className={`prepare-fixture-pill ${fixture.id === selectedGameId ? 'is-active' : ''}`}
              onClick={() => setSelectedGameId(fixture.id)}
            >
              {fixture.awayTeam.shortName} @ {fixture.homeTeam.shortName} | {formatFixtureDate(fixture.gameDate)}
            </button>
          ))}
        </div>
        {selectedGame ? (
          <div className="prepare-fixture-selected">
            Preparing for: {selectedGame.awayTeam.shortName} at {selectedGame.homeTeam.shortName} ({formatFixtureDate(selectedGame.gameDate)})
          </div>
        ) : (
          <div className="prepare-fixture-selected">No upcoming scheduled game found.</div>
        )}
      </section>

      <section className="prepare-card prepare-hub-main">
        <h3>Preparation Tabs</h3>
        <div className="prepare-hub-options">
          <button type="button" className="prepare-hub-option" onClick={() => goto('tactics')}>
            <span className="prepare-hub-icon">T</span>
            <span className="prepare-hub-label">Tactics</span>
          </button>
          <button type="button" className="prepare-hub-option" onClick={() => goto('training/team')}>
            <span className="prepare-hub-icon">TT</span>
            <span className="prepare-hub-label">Team Training</span>
          </button>
          <button type="button" className="prepare-hub-option" onClick={() => goto('training/players')}>
            <span className="prepare-hub-icon">PT</span>
            <span className="prepare-hub-label">Player Training</span>
          </button>
        </div>
      </section>
    </div>
  );
}
