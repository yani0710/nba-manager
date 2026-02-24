import { useEffect, useMemo, useState } from 'react';
import { EmptyState, PageHeader } from '../../components/ui';
import { useGameStore } from '../../state/gameStore';

function fmtDate(v) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString();
}

export function MatchCenter() {
  const { currentSave, scheduleGames, fetchSchedule, advanceDays } = useGameStore();
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [minute, setMinute] = useState(0);
  const [events, setEvents] = useState([]);

  useEffect(() => { if (currentSave?.id) fetchSchedule(); }, [currentSave?.id, fetchSchedule]);

  const upcomingGames = useMemo(
    () => (scheduleGames || []).filter((g) => g.status !== 'final').sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate)),
    [scheduleGames],
  );

  useEffect(() => {
    if (!upcomingGames.length) return;
    if (selectedGameId && upcomingGames.some((g) => g.id === selectedGameId)) return;
    const managedCode = currentSave?.data?.career?.teamShortName;
    const managedNext = upcomingGames.find((g) => g.homeTeam?.shortName === managedCode || g.awayTeam?.shortName === managedCode);
    setSelectedGameId((managedNext || upcomingGames[0]).id);
  }, [upcomingGames, selectedGameId, currentSave?.data?.career?.teamShortName]);

  const selectedGame = upcomingGames.find((g) => g.id === selectedGameId) || null;

  const simulatePresentation = async () => {
    if (!selectedGame || simulating) return;
    setSimulating(true);
    setMinute(0);
    setEvents([`Tip-off: ${selectedGame.awayTeam.shortName} at ${selectedGame.homeTeam.shortName}`]);
    const snippets = [
      'Fast break score',
      'Turnover forced',
      'And-one finish',
      'Corner three',
      'Second-chance putback',
      'Defensive stop',
      'Timeout called',
      'Pick-and-roll assist',
    ];
    try {
      for (let m = 1; m <= 48; m += 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 70));
        setMinute(m);
        if (m % 3 === 0) {
          const snippet = snippets[(m + selectedGame.id) % snippets.length];
          setEvents((prev) => [`Q${Math.ceil(m / 12)} ${m}:00 - ${snippet}`, ...prev].slice(0, 14));
        }
      }
      // Use existing backend simulation by advancing one day after the presentation.
      await advanceDays(1);
      setEvents((prev) => ['Game resolved via backend simulation (advance day).', ...prev]);
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Match Center"
        subtitle="Select an upcoming game and run a live minute-by-minute presentation while the backend resolves the day."
        actions={selectedGame ? <span className="ui-badge">{fmtDate(selectedGame.gameDate)}</span> : null}
      />

      <div className="ui-card-grid">
        <section className="ui-card ui-col-5">
          <h3>Upcoming Games</h3>
          {upcomingGames.length === 0 ? (
            <EmptyState title="No upcoming games" description="Advance to a season date with scheduled games." />
          ) : (
            <div className="ui-list-stack" style={{ maxHeight: 540, overflow: 'auto' }}>
              {upcomingGames.slice(0, 20).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="ui-list-item"
                  style={{ textAlign: 'left', cursor: 'pointer', background: selectedGameId === g.id ? 'var(--ui-accent-soft)' : undefined }}
                  onClick={() => setSelectedGameId(g.id)}
                >
                  <div style={{ fontWeight: 700 }}>{g.awayTeam.shortName} @ {g.homeTeam.shortName}</div>
                  <div style={{ color: 'var(--ui-text-muted)', fontSize: 12 }}>{fmtDate(g.gameDate)} • {g.status}</div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="ui-card ui-col-7">
          <h3>Live Match Simulation</h3>
          {!selectedGame ? (
            <EmptyState title="Select a game" description="Choose a game from the left to start live simulation view." />
          ) : (
            <div className="ui-list-stack">
              <div className="ui-list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{selectedGame.awayTeam.shortName} @ {selectedGame.homeTeam.shortName}</div>
                  <div style={{ color: 'var(--ui-text-muted)' }}>{fmtDate(selectedGame.gameDate)}</div>
                </div>
                <button className="ui-btn ui-btn-primary" type="button" onClick={simulatePresentation} disabled={simulating}>
                  {simulating ? 'Simulating...' : 'Start Live Sim'}
                </button>
              </div>

              <div className="ui-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ui-text-muted)', marginBottom: 8 }}>
                  <span>Game Clock Progress</span>
                  <span>{minute}/48 min</span>
                </div>
                <div style={{ height: 12, borderRadius: 999, background: 'var(--ui-bg-elev-2)', overflow: 'hidden', border: '1px solid var(--ui-border)' }}>
                  <div style={{ width: `${(minute / 48) * 100}%`, height: '100%', background: 'var(--ui-accent)', transition: 'width 80ms linear' }} />
                </div>
              </div>

              <div className="ui-table-shell">
                <table className="ui-table">
                  <thead><tr><th>Live Feed</th></tr></thead>
                  <tbody>
                    {events.length === 0 ? (
                      <tr><td style={{ color: 'var(--ui-text-muted)' }}>No events yet. Start simulation.</td></tr>
                    ) : events.map((e, idx) => (
                      <tr key={`${idx}-${e}`}><td>{e}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

