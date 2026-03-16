import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { api } from '../../api/client';
import { EmptyState, PageHeader, SkeletonCard } from '../../components/ui';
import {
  formatFixtureDate,
  formatFixtureStatus,
  getFixtureDateKeyEt,
  isFixtureCompleted,
} from '../../domain/fixtures';
import './Schedule.css';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

export function Schedule() {
  const { currentSave, scheduleGames, fetchSchedule, loading, advanceDays, loadSave } = useGameStore();
  const [monthCursor, setMonthCursor] = useState(null);
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

  if (!currentSave?.data?.career?.teamShortName) {
    return (
      <div className="calendar-page">
        <PageHeader title="Schedule" subtitle="Calendar and matchday skipping tools." />
        <EmptyState title="No team selected" description="Start a career with a team to view the schedule calendar." />
      </div>
    );
  }

  if (loading) return <SkeletonCard />;
  if (!monthCursor) return <div className="calendar-page"><PageHeader title="Schedule" subtitle="Calendar and matchday skipping tools." /><EmptyState title="No games scheduled" description="No calendar games are available yet." /></div>;

  const [yearStr, monthStr] = monthCursor.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay.getDay();

  const cells = [];
  for (let i = 0; i < startOffset; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthIndex = availableMonths.indexOf(monthCursor);
  const nextMonth = monthIndex >= 0 && monthIndex < availableMonths.length - 1 ? availableMonths[monthIndex + 1] : null;
  const prevMonth = monthIndex > 0 ? availableMonths[monthIndex - 1] : null;

  const currentDate = currentSave?.data?.currentDate ?? null;
  const currentDateKey = currentDate || null;

  const highlightedDayGames = currentDateKey ? (byDay.get(currentDateKey) ?? []) : [];
  const nextMatchDateKey = scheduleGames
    .filter((g) => !isFixtureCompleted(g))
    .map((g) => getFixtureDateKeyEt(g.gameDate))
    .filter((key) => key && (!currentDateKey || key >= currentDateKey))
    .sort()[0];

  const skipToNextMatchday = async () => {
    const saveId = currentSave?.id;
    if (!saveId || !nextMatchDateKey) return;
    const targetDate = nextMatchDateKey;
    setSkipProgress({ label: 'Skipping to next matchday...', value: 15, targetDate });
    try {
      const { data } = await api.saves.advance(saveId, { targetDate });
      setSkipProgress({ label: `Reached ${targetDate}`, value: 100, targetDate });
      await loadSave(data.id);
    } catch {
      setSkipProgress({ label: 'Failed to skip', value: 100, targetDate });
    } finally {
      setTimeout(() => setSkipProgress(null), 1200);
    }
  };

  return (
    <div className="calendar-page">
      <PageHeader title={`Schedule - ${currentSave.data.career.teamShortName}`} subtitle="Browse the season calendar and jump to the next matchday." />
      <div className="calendar-toolbar">
        <div className="calendar-actions">
          <button className="calendar-btn" onClick={() => advanceDays(1)}>Skip 1 Day</button>
          <button className="calendar-btn" onClick={() => advanceDays(3)}>Skip 3 Days</button>
          <button className="calendar-btn" onClick={() => advanceDays(7)}>Skip 7 Days</button>
          <button className="calendar-btn" disabled={!nextMatchDateKey} onClick={skipToNextMatchday}>Skip to Next Matchday</button>
        </div>
      </div>
      {skipProgress && (
        <div className="calendar-progress">
          <div className="calendar-progress-label">{skipProgress.label}</div>
          <div className="calendar-progress-bar"><span style={{ width: `${skipProgress.value}%` }} /></div>
        </div>
      )}

      <div className="calendar-shell">
        <div className="calendar-main">
          <div className="calendar-month-header">
            <button className="calendar-nav" disabled={!prevMonth} onClick={() => prevMonth && setMonthCursor(prevMonth)}>Prev</button>
            <h3>{monthLabel(year, month)}</h3>
            <button className="calendar-nav" disabled={!nextMonth} onClick={() => nextMonth && setMonthCursor(nextMonth)}>Next</button>
          </div>

          <div className="calendar-grid">
            {WEEK_DAYS.map((day) => (
              <div key={day} className="calendar-weekday">{day}</div>
            ))}
            {cells.map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} className="calendar-cell empty" />;
              const key = dateKey(date);
              const games = byDay.get(key) ?? [];
              const isToday = currentDateKey === key;
              const hasFinal = games.some((g) => isFixtureCompleted(g));
              const hasScheduled = games.some((g) => !isFixtureCompleted(g));
              return (
                <div key={key} className={`calendar-cell ${isToday ? 'today' : ''} ${hasFinal ? 'final' : ''} ${hasScheduled ? 'scheduled' : ''}`}>
                  <div className="calendar-day-number">{date.getDate()}</div>
                  <div className="calendar-day-games">
                    {games.slice(0, 2).map((game) => (
                      <div key={game.id} className="calendar-game-row">
                        <img src={logoPath(game.awayTeam)} alt={game.awayTeam.shortName} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        <span>{game.awayTeam.shortName}@{game.homeTeam.shortName}</span>
                      </div>
                    ))}
                    {games.length > 2 ? <small>+{games.length - 2} more</small> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="calendar-side">
          <h3>{currentDateKey ? formatFixtureDate(`${currentDateKey}T12:00:00Z`) : 'Current Day'}</h3>
          <p className="calendar-side-subtitle">Upcoming / Current Day Games</p>
          <div className="calendar-side-list">
            {highlightedDayGames.length === 0 && <p>No games for this day.</p>}
            {highlightedDayGames.map((game) => (
              <div key={game.id} className="calendar-side-item">
                <div className="teams">
                  <img src={logoPath(game.awayTeam)} alt={game.awayTeam.shortName} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  <span>{game.awayTeam.shortName} @ {game.homeTeam.shortName}</span>
                  <img src={logoPath(game.homeTeam)} alt={game.homeTeam.shortName} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                </div>
                <small>{isFixtureCompleted(game) ? `${game.awayScore}-${game.homeScore}` : formatFixtureStatus(game.status)}</small>
              </div>
            ))}
          </div>

          <div className="calendar-rules">
            <h4>Schedule Rules</h4>
            <p>Before Match: Rest Day</p>
            <p>After Match: Recovery Day</p>
            <p>Week Plan: Intermittent Rest</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
