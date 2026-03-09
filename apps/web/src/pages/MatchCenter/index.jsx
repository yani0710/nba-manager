import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState, PageHeader } from '../../components/ui';
import { useGameStore } from '../../state/gameStore';

function fmtDate(v) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString();
}

export function MatchCenter() {
  const SIM_TICK_MS = 160;
  const { currentSave, scheduleGames, fetchSchedule, advanceToDate } = useGameStore();
  const [selectedGameId, setSelectedGameId] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [minute, setMinute] = useState(0);
  const [events, setEvents] = useState([]);
  const [liveScore, setLiveScore] = useState({ home: 0, away: 0 });
  const [liveGameMeta, setLiveGameMeta] = useState(null);
  const hydratedRef = useRef(false);

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
  const storageKey = currentSave?.id ? `match-center-state:${currentSave.id}` : null;

  const resetLiveView = () => {
    setMinute(0);
    setEvents([]);
    setLiveScore({ home: 0, away: 0 });
    setSimulating(false);
    setLiveGameMeta(null);
  };

  useEffect(() => {
    hydratedRef.current = false;
    if (!storageKey) return;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) {
        hydratedRef.current = true;
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (Number.isFinite(parsed.selectedGameId)) setSelectedGameId(parsed.selectedGameId);
        if (Number.isFinite(parsed.minute)) setMinute(parsed.minute);
        if (Array.isArray(parsed.events)) setEvents(parsed.events.slice(0, 16));
        if (parsed.liveScore && Number.isFinite(parsed.liveScore.home) && Number.isFinite(parsed.liveScore.away)) {
          setLiveScore({ home: parsed.liveScore.home, away: parsed.liveScore.away });
        }
        if (parsed.liveGameMeta && typeof parsed.liveGameMeta === 'object') {
          setLiveGameMeta(parsed.liveGameMeta);
        }
      }
    } catch {
      // Ignore corrupted session state.
    } finally {
      hydratedRef.current = true;
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !hydratedRef.current) return;
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      selectedGameId,
      minute,
      events: events.slice(0, 16),
      liveScore,
      liveGameMeta,
    }));
  }, [storageKey, selectedGameId, minute, events, liveScore, liveGameMeta]);

  const simulatePresentation = async () => {
    if (!selectedGame || simulating) return;
    const simGame = {
      id: selectedGame.id,
      gameDate: selectedGame.gameDate,
      homeTeam: selectedGame.homeTeam,
      awayTeam: selectedGame.awayTeam,
    };
    setSimulating(true);
    setMinute(0);
    setLiveScore({ home: 0, away: 0 });
    setLiveGameMeta(simGame);
    setEvents([`Tip-off: ${simGame.awayTeam.shortName} at ${simGame.homeTeam.shortName}`]);
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
    const scorePhrases = [
      'knocks down a jumper',
      'hits from deep',
      'finishes at the rim',
      'scores in transition',
      'sinks two free throws',
    ];
    const rnd = (seed) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };
    try {
      for (let m = 1; m <= 48; m += 1) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, SIM_TICK_MS));
        setMinute(m);
        const minuteSeed = selectedGame.id * 97 + m * 13;
        // Simulate 1-3 scoring events per minute so preview totals land near realistic NBA scores.
        const eventCountRoll = rnd(minuteSeed + 50);
        const scoringEventsThisMinute = eventCountRoll > 0.82 ? 3 : eventCountRoll > 0.28 ? 2 : 1;
        for (let e = 0; e < scoringEventsThisMinute; e += 1) {
          const eventSeed = minuteSeed + (e * 7);
          setLiveScore((prev) => {
            const homeScores = rnd(eventSeed + 1) > 0.49;
            const pointsRoll = rnd(eventSeed + 2);
            const pts = pointsRoll > 0.90 ? 3 : (pointsRoll > 0.07 ? 2 : 1);
            const next = {
              home: prev.home + (homeScores ? pts : 0),
              away: prev.away + (homeScores ? 0 : pts),
            };
            const teamCode = homeScores ? simGame.homeTeam.shortName : simGame.awayTeam.shortName;
            const phrase = scorePhrases[(m + e + pts + selectedGame.id) % scorePhrases.length];
            const sec = String(Math.max(0, 59 - (e * 9))).padStart(2, '0');
            setEvents((prevEvents) => [
              `Q${Math.ceil(m / 12)} ${m}:${sec} - ${teamCode} ${phrase} (+${pts}) [${next.away}-${next.home}]`,
              ...prevEvents,
            ].slice(0, 16));
            return next;
          });
        }
        if (m % 3 === 0) {
          const snippet = snippets[(m + selectedGame.id) % snippets.length];
          setEvents((prev) => [`Q${Math.ceil(m / 12)} ${m}:00 - ${snippet}`, ...prev].slice(0, 16));
        }
      }
      // Resolve the actual selected fixture by advancing to the selected game date.
      await advanceToDate(String(simGame.gameDate).slice(0, 10));
      const latestResults = useGameStore.getState().results || [];
      const resolved = latestResults.find((g) => g.id === simGame.id);
      if (resolved) {
        setLiveScore({ home: resolved.homeScore, away: resolved.awayScore });
        setEvents((prev) => [`Backend final: ${resolved.awayTeam.shortName} ${resolved.awayScore} - ${resolved.homeScore} ${resolved.homeTeam.shortName}`, ...prev].slice(0, 16));
      } else {
        setEvents((prev) => ['Game resolved via backend simulation (advance day). Final score synced from backend results list.', ...prev]);
      }
    } finally {
      setSimulating(false);
    }
  };

  const panelGame = ((simulating || minute > 0 || events.length > 0) && liveGameMeta) ? liveGameMeta : selectedGame;

  return (
    <div>
      <PageHeader
        title="Match Center"
        subtitle="Select an upcoming game and run a live minute-by-minute presentation while the backend resolves the day."
        actions={panelGame ? <span className="ui-badge">{fmtDate(panelGame.gameDate)}</span> : null}
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
                  onClick={() => {
                    if (selectedGameId !== g.id) resetLiveView();
                    setSelectedGameId(g.id);
                  }}
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
          {!panelGame ? (
            <EmptyState title="Select a game" description="Choose a game from the left to start live simulation view." />
          ) : (
            <div className="ui-list-stack">
              <div className="ui-list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{panelGame.awayTeam.shortName} @ {panelGame.homeTeam.shortName}</div>
                  <div style={{ color: 'var(--ui-text-muted)' }}>{fmtDate(panelGame.gameDate)}</div>
                </div>
                <button className="ui-btn ui-btn-primary" type="button" onClick={simulatePresentation} disabled={simulating}>
                  {simulating ? 'Simulating...' : 'Start Live Sim'}
                </button>
              </div>

              <div className="ui-card" style={{ padding: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--ui-text-muted)', fontSize: 12 }}>{panelGame.awayTeam.shortName}</div>
                    <div style={{ fontWeight: 800, fontSize: 28, lineHeight: 1 }}>{liveScore.away}</div>
                  </div>
                  <div style={{ color: 'var(--ui-text-muted)', fontWeight: 700 }}>:</div>
                  <div>
                    <div style={{ color: 'var(--ui-text-muted)', fontSize: 12 }}>{panelGame.homeTeam.shortName}</div>
                    <div style={{ fontWeight: 800, fontSize: 28, lineHeight: 1 }}>{liveScore.home}</div>
                  </div>
                </div>
                <div style={{ marginTop: 8, color: 'var(--ui-text-muted)', fontSize: 12 }}>
                  Live presentation score preview (backend result is applied after day advance).
                </div>
              </div>

              <div className="ui-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ui-text-muted)', marginBottom: 8 }}>
                  <span>Game Clock Progress</span>
                  <span>{minute}/48 min</span>
                </div>
                <div style={{ height: 12, borderRadius: 999, background: 'var(--ui-bg-elev-2)', overflow: 'hidden', border: '1px solid var(--ui-border)' }}>
                  <div style={{ width: `${(minute / 48) * 100}%`, height: '100%', background: 'var(--ui-accent)', transition: `width ${Math.max(80, SIM_TICK_MS - 20)}ms linear` }} />
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
