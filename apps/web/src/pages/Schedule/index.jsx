import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { api } from '../../api/client';
import { EmptyState, SkeletonCard } from '../../components/ui';
import {
  formatFixtureDate,
  formatFixtureStatus,
  getFixtureDateKeyEt,
  isFixtureCompleted,
  isFixtureSimulatable,
} from '../../domain/fixtures';
import './Schedule.css';

const CALENDAR_TABS = ['Calendar', 'Social Media', 'Trading Block', 'Team Status'];

const logoPath = (team) => {
  const short = (team?.shortName || '').toLowerCase();
  return team?.logoPath || `/images/teams/${short}.png`;
};

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function buildSeasonMonthKeys(season) {
  const startYear = Number(String(season || '2025-26').slice(0, 4)) || 2025;
  const out = [];
  for (let month = 10; month <= 12; month += 1) {
    out.push(`${startYear}-${String(month).padStart(2, '0')}`);
  }
  for (let month = 1; month <= 6; month += 1) {
    out.push(`${startYear + 1}-${String(month).padStart(2, '0')}`);
  }
  return out;
}

function formatTopDate(dateValue) {
  if (!dateValue) return 'NO DATE';
  const date = new Date(`${dateValue}T12:00:00Z`);
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).toUpperCase();
}

function gameSummaryForTeam(game, teamShort) {
  if (!game || !teamShort) return null;
  const short = String(teamShort).toUpperCase();
  const homeShort = String(game.homeTeam?.shortName || '').toUpperCase();
  const awayShort = String(game.awayTeam?.shortName || '').toUpperCase();
  if (homeShort !== short && awayShort !== short) return null;

  const isHome = homeShort === short;
  const opponent = isHome ? game.awayTeam : game.homeTeam;
  return {
    team: isHome ? game.homeTeam : game.awayTeam,
    opponent,
    isHome,
  };
}

export function Schedule() {
  const { currentSave, scheduleGames, fetchSchedule, loading, advanceDays, loadSave } = useGameStore();
  const [monthCursor, setMonthCursor] = useState(null);
  const [selectedDateKey, setSelectedDateKey] = useState(null);
  const [skipProgress, setSkipProgress] = useState(null);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const game of scheduleGames) {
      const key = getFixtureDateKeyEt(game.gameDate);
      if (!key) continue;
      const arr = map.get(key) ?? [];
      arr.push(game);
      map.set(key, arr);
    }
    return map;
  }, [scheduleGames]);

  const availableMonths = useMemo(() => {
    const months = buildSeasonMonthKeys(currentSave?.season || currentSave?.data?.season);
    return months;
  }, [currentSave?.season, currentSave?.data?.season]);

  useEffect(() => {
    if (availableMonths.length === 0) return;
    const currentDate = currentSave?.data?.currentDate ?? null;
    const preferred = currentDate ? String(currentDate).slice(0, 7) : null;
    if (monthCursor === null) {
      if (preferred && availableMonths.includes(preferred)) {
        setMonthCursor(preferred);
      } else {
        setMonthCursor(availableMonths[0]);
      }
      return;
    }
    if (!availableMonths.includes(monthCursor)) {
      setMonthCursor(preferred && availableMonths.includes(preferred) ? preferred : availableMonths[0]);
    }
  }, [availableMonths, monthCursor, currentSave?.data?.currentDate]);

  const currentDateKey = currentSave?.data?.currentDate ?? null;

  useEffect(() => {
    if (selectedDateKey) return;
    if (currentDateKey) {
      setSelectedDateKey(currentDateKey);
      return;
    }
    if (scheduleGames.length > 0) {
      const first = getFixtureDateKeyEt(scheduleGames[0].gameDate);
      if (first) setSelectedDateKey(first);
    }
  }, [selectedDateKey, currentDateKey, scheduleGames]);

  if (!currentSave?.data?.career?.teamShortName) {
    return (
      <div className="calendar-page">
        <EmptyState title="No team selected" description="Start a career with a team to view the schedule calendar." />
      </div>
    );
  }

  if (loading) return <SkeletonCard />;
  if (!monthCursor) {
    return (
      <div className="calendar-page">
        <EmptyState title="No games scheduled" description="No calendar games are available yet." />
      </div>
    );
  }

  const [yearStr, monthStr] = monthCursor.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));

  const monthIndex = availableMonths.indexOf(monthCursor);
  const nextMonth = monthIndex >= 0 && monthIndex < availableMonths.length - 1 ? availableMonths[monthIndex + 1] : null;
  const prevMonth = monthIndex > 0 ? availableMonths[monthIndex - 1] : null;

  const teamShort = String(currentSave.data.career.teamShortName || '').toUpperCase();
  const seasonLabel = currentSave?.data?.season || '-';

  const selectedGames = selectedDateKey ? (byDay.get(selectedDateKey) ?? []) : [];
  const selectedTeamGame = selectedGames.find((g) => gameSummaryForTeam(g, teamShort));
  const selectedGameSummary = gameSummaryForTeam(selectedTeamGame, teamShort);

  const nextMatchDateKey = scheduleGames
    .filter((g) => !isFixtureCompleted(g))
    .map((g) => getFixtureDateKeyEt(g.gameDate))
    .filter((key) => key && (!currentDateKey || key >= currentDateKey))
    .sort()[0];

  const skipToNextMatchday = async () => {
    const saveId = currentSave?.id;
    if (!saveId || !nextMatchDateKey) return;
    const targetDate = nextMatchDateKey;
    setSkipProgress({ label: 'Skipping to next match day...', value: 20, targetDate });
    try {
      const { data } = await api.saves.advance(saveId, { targetDate });
      setSkipProgress({ label: `Reached ${targetDate}`, value: 100, targetDate });
      await loadSave(data.id);
      setSelectedDateKey(targetDate);
      if (String(targetDate).slice(0, 7) !== monthCursor) {
        setMonthCursor(String(targetDate).slice(0, 7));
      }
    } catch {
      setSkipProgress({ label: 'Failed to skip', value: 100, targetDate });
    } finally {
      setTimeout(() => setSkipProgress(null), 1200);
    }
  };

  return (
    <div className="calendar-page calendar-cinematic">
      <header className="calendar-hero">
        <div>
          <h1>Calendar</h1>
          <p>Schedule your season, skip to match days.</p>
        </div>
        <div className="calendar-hero-meta">
          <div className="calendar-hero-date">{formatTopDate(currentDateKey || selectedDateKey)}</div>
          <div className="calendar-hero-team">{teamShort} • Season {seasonLabel}</div>
        </div>
      </header>

      <div className="calendar-tabbar" role="tablist" aria-label="Sections">
        {CALENDAR_TABS.map((tab, idx) => (
          <button key={tab} className={`calendar-tab ${idx === 0 ? 'is-active' : ''}`} type="button" disabled={idx !== 0}>
            {tab}
          </button>
        ))}
      </div>

      {skipProgress ? (
        <div className="calendar-progress">
          <div className="calendar-progress-label">{skipProgress.label}</div>
          <div className="calendar-progress-bar"><span style={{ width: `${skipProgress.value}%` }} /></div>
        </div>
      ) : null}

      <div className="calendar-shell">
        <section className="calendar-main">
          <div className="calendar-month-header">
            <button className="calendar-nav" disabled={!prevMonth} onClick={() => prevMonth && setMonthCursor(prevMonth)}>
              <span aria-hidden="true">&lt;</span> Previous Month
            </button>
            <h2>{monthLabel(year, month)}</h2>
            <button className="calendar-nav" disabled={!nextMonth} onClick={() => nextMonth && setMonthCursor(nextMonth)}>
              Next Month <span aria-hidden="true">&gt;</span>
            </button>
          </div>

          <div className="calendar-grid">
            {cells.map((date) => {
              const key = dateKey(date);
              const games = byDay.get(key) ?? [];
              const teamGame = games.find((g) => gameSummaryForTeam(g, teamShort));
              const summary = gameSummaryForTeam(teamGame, teamShort);
              const isToday = currentDateKey === key;
              const isSelected = selectedDateKey === key;
              const hasScheduled = games.some((g) => !isFixtureCompleted(g));

              return (
                <button
                  key={key}
                  type="button"
                  className={`calendar-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasScheduled ? 'scheduled' : ''}`}
                  onClick={() => setSelectedDateKey(key)}
                >
                  <div className="calendar-day-heading">
                    <span>{new Date(date).toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</span>
                    <span>{date.getDate()}</span>
                  </div>

                  {summary ? (
                    <div className="calendar-opponent-badge">
                      <img src={logoPath(summary.opponent)} alt={summary.opponent?.shortName || 'Opponent'} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      <strong>{summary.opponent?.shortName || '-'}</strong>
                    </div>
                  ) : (
                    <div className="calendar-empty-slot">No Team Game</div>
                  )}

                  <div className="calendar-day-footer">
                    {summary ? (summary.isHome ? 'Home' : 'Away') : (games.length > 0 ? `${games.length} games` : '-')}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="calendar-side">
          <div className="calendar-side-card">
            <h3>{selectedDateKey ? formatFixtureDate(`${selectedDateKey}T12:00:00Z`) : 'Select Date'}</h3>
            {selectedGameSummary ? (
              <div className="calendar-matchup-box">
                <div className="team-dot is-home">{selectedGameSummary.isHome ? teamShort : selectedGameSummary.opponent?.shortName}</div>
                <span>VS</span>
                <div className="team-dot is-away">{selectedGameSummary.isHome ? selectedGameSummary.opponent?.shortName : teamShort}</div>
              </div>
            ) : (
              <p className="calendar-side-subtitle">No game for your team on this date.</p>
            )}

            {selectedTeamGame ? (
              <p className="calendar-side-subtitle">
                {selectedGameSummary?.isHome ? 'Home Game' : 'Away Game'} • {isFixtureCompleted(selectedTeamGame)
                  ? `${selectedTeamGame.awayScore}-${selectedTeamGame.homeScore}`
                  : formatFixtureStatus(selectedTeamGame.status)}
              </p>
            ) : null}

            <button
              type="button"
              className="calendar-play-btn"
              disabled={!selectedTeamGame || !isFixtureSimulatable(selectedTeamGame, currentDateKey)}
              onClick={() => { window.location.hash = 'match-center'; }}
            >
              Play Match
            </button>
          </div>

          <div className="calendar-side-card">
            <h4>Quick Actions</h4>
            <button type="button" className="calendar-quick primary" onClick={skipToNextMatchday} disabled={!nextMatchDateKey}>Skip to Next Match</button>
            <button type="button" className="calendar-quick" onClick={() => advanceDays(1)}>Advance 1 Day</button>
            <button type="button" className="calendar-quick" onClick={() => advanceDays(7)}>Advance 1 Week</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
