import { useEffect, useMemo, useState } from 'react';
import { useRouter } from '../app/router';
import { useGameStore } from '../state/gameStore';

const GROUPS = [
  {
    id: 'overview',
    label: 'Overview',
    icon: '▶',
    items: [
      { key: 'dashboard', label: 'Dashboard', shortcut: 'D' },
      { key: 'profile', label: 'Profile', shortcut: 'PF' },
      { key: 'inbox', label: 'Inbox', shortcut: 'I', showUnread: true },
      { key: 'saves', label: 'Saves', shortcut: 'S' },
    ],
  },
  {
    id: 'roster',
    label: 'Roster',
    icon: '◆',
    items: [
      { key: 'squad', label: 'Squad', shortcut: 'Q' },
      { key: 'tactics', label: 'Tactics', shortcut: 'T' },
      { key: 'training/team', label: 'Team Training', shortcut: 'TT' },
      { key: 'training/players', label: 'Player Training', shortcut: 'PT' },
      { key: 'transfers', label: 'Transfers', shortcut: 'TR' },
      { key: 'players', label: 'Players', shortcut: 'P' },
      { key: 'teams', label: 'Teams', shortcut: 'TM' },
    ],
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: '▣',
    items: [
      { key: 'schedule', label: 'Calendar', shortcut: 'C' },
      { key: 'prepare', label: 'Prepare', shortcut: 'PR' },
      { key: 'matches', label: 'Matches', shortcut: 'M' },
      { key: 'match-center', label: 'Match Center', shortcut: 'MC', isLive: true },
      { key: 'results', label: 'Results', shortcut: 'R' },
      { key: 'league', label: 'Standings', shortcut: 'L' },
    ],
  },
];

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatNextGameLabel(gameDate) {
  if (!gameDate) return '-';
  const target = new Date(gameDate);
  if (Number.isNaN(target.getTime())) return '-';
  const now = new Date();
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'In 1 day';
  return `In ${diff} days`;
}

export function Sidebar({ collapsed = false, onToggle = () => {} }) {
  const { navigate, currentPage } = useRouter();
  const { currentSave, dashboard, inbox } = useGameStore();
  const [openGroups, setOpenGroups] = useState({
    overview: true,
    roster: true,
    schedule: true,
  });

  useEffect(() => {
    if (collapsed) {
      setOpenGroups({ overview: false, roster: false, schedule: false });
      return;
    }
    setOpenGroups((prev) => {
      if (prev.overview || prev.roster || prev.schedule) return prev;
      return { overview: true, roster: false, schedule: false };
    });
  }, [collapsed]);

  useEffect(() => {
    const parent = GROUPS.find((group) => group.items.some((item) => item.key === currentPage));
    if (!parent) return;
    setOpenGroups((prev) => ({
      ...prev,
      [parent.id]: true,
    }));
  }, [currentPage]);

  const managedTeamId = currentSave?.managedTeamId ?? currentSave?.teamId ?? null;
  const teamStreak = managedTeamId
    ? Number(currentSave?.data?.teamState?.[String(managedTeamId)]?.streak ?? 0)
    : 0;
  const teamRecord = useMemo(() => {
    const wins = Number(dashboard?.overview?.wins ?? 0);
    const losses = Number(dashboard?.overview?.losses ?? 0);
    return `${wins}W - ${losses}L`;
  }, [dashboard?.overview?.wins, dashboard?.overview?.losses]);
  const streakLabel = teamStreak > 0 ? `W${teamStreak}` : teamStreak < 0 ? `L${Math.abs(teamStreak)}` : '-';
  const teamName = currentSave?.team?.name ?? 'No Team Selected';
  const teamShort = currentSave?.team?.shortName ?? '--';
  const season = currentSave?.data?.season ?? currentSave?.season ?? '-';
  const dateLabel = formatDate(currentSave?.data?.currentDate);
  const nextGameLabel = formatNextGameLabel(dashboard?.nextMatch?.gameDate);

  const toggleGroup = (groupId) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  if (collapsed) {
    return (
      <aside className="ui-sidebar ui-sidebar-mini">
        <button type="button" className="ui-sidebar-close-btn" onClick={onToggle} aria-label="Open menu">≡</button>
      </aside>
    );
  }

  return (
    <aside className="ui-sidebar">
      <div className="ui-sidebar-header">
        <button type="button" className="ui-sidebar-close-btn" onClick={onToggle} aria-label="Toggle menu groups">×</button>
        <div>
          <div className="ui-brand-title">NBA Manager</div>
          <div className="ui-brand-subtitle">Front Office Suite</div>
        </div>
      </div>

      <div className="ui-sidebar-team-card">
        <div className="ui-sidebar-team-top">
          <div className="ui-sidebar-team-logo">{teamShort}</div>
          <div>
            <div className="ui-sidebar-team-name">{teamName}</div>
            <div className="ui-sidebar-team-record">{teamRecord}</div>
          </div>
        </div>
        <div className="ui-sidebar-team-foot">
          <span>Current Streak</span>
          <b className={teamStreak >= 0 ? 'is-positive' : 'is-negative'}>{streakLabel}</b>
        </div>
      </div>

      <nav className="ui-sidebar-nav">
        {GROUPS.map((group) => {
          const expanded = Boolean(openGroups[group.id]);
          return (
            <div key={group.id} className="ui-nav-group">
              <button
                type="button"
                className={`ui-nav-group-trigger ${expanded ? 'is-open' : ''}`}
                onClick={() => toggleGroup(group.id)}
                aria-expanded={expanded}
              >
                <span className="ui-nav-group-left">
                  <span className="ui-nav-group-icon">{group.icon}</span>
                  <span className="ui-nav-group-label">{group.label}</span>
                </span>
                <span className="ui-nav-group-chevron">{expanded ? '⌄' : '›'}</span>
              </button>

              {expanded ? (
                <div className="ui-nav-group-items">
                  {group.items.map((item) => {
                    const active = currentPage === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className={`ui-nav-item ${active ? 'is-active' : ''}`}
                        onClick={() => navigate(item.key)}
                        title={item.label}
                      >
                        <span className="ui-nav-label">{item.label}</span>
                        <span className="ui-nav-right">
                          {item.isLive ? <span className="ui-live-badge">LIVE</span> : null}
                          {item.showUnread && Number(inbox?.unread ?? 0) > 0 ? <span className="ui-unread-badge">{inbox.unread}</span> : null}
                          <span className="ui-shortcut-pill">{item.shortcut}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="ui-sidebar-footer">
        <div className="ui-sidebar-footer-row"><span>Season</span><b>{season}</b></div>
        <div className="ui-sidebar-footer-row"><span>Date</span><b>{dateLabel}</b></div>
        <div className="ui-sidebar-footer-divider" />
        <div className="ui-sidebar-footer-row"><span>Next Game</span><b className="is-positive">{nextGameLabel}</b></div>
      </div>
    </aside>
  );
}
