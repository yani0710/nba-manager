
import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../state/gameStore';
import { api } from '../../api/client';
import {
  getFixtureDateKeyEt,
  isFixtureCompleted,
} from '../../domain/fixtures';
import { getTeamColor } from '../../utils/format';
import './Schedule.css';

const TABS = ['Calendar', 'Social Media', 'Trading Block', 'Team Status'];
const CALENDAR_VIEWS = ['month', 'week', 'agenda', 'timeline'];

const logoPath = (team) => {
  const short = (team?.shortName || '').toLowerCase();
  return team?.logoPath || `/images/teams/${short}.png`;
};

const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const monthLabel = (year, month) => new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const safeNum = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

const TEAM_COLORS_BY_SHORT = {
  ATL: '#E03A3E',
  BOS: '#007A33',
  BKN: '#000000',
  CHA: '#1D1160',
  CHI: '#CE1141',
  CLE: '#6F263D',
  DAL: '#00538C',
  DEN: '#0E2240',
  DET: '#C8102E',
  GSW: '#1D428A',
  HOU: '#CE1141',
  IND: '#002D62',
  LAC: '#C8102E',
  LAL: '#552583',
  MEM: '#5D76A9',
  MIA: '#98002E',
  MIL: '#00471B',
  MIN: '#0C2340',
  NOP: '#0C2340',
  NYK: '#F58426',
  OKC: '#007AC1',
  ORL: '#0077C0',
  PHI: '#006BB6',
  PHX: '#E56020',
  POR: '#E03A3E',
  SAC: '#5A2D81',
  SAS: '#C4CED4',
  TOR: '#CE1141',
  UTA: '#002B5C',
  WAS: '#002B5C',
};

const TRADE_ALERT_KEYWORDS = [
  'trade',
  'offer',
  'proposal',
  'agent',
  'listed',
  'transfer',
  'negotiation',
  'counter',
];

function colorHashFromString(input) {
  let h = 0;
  const s = String(input || 'NBA');
  for (let i = 0; i < s.length; i += 1) h = (h << 5) - h + s.charCodeAt(i);
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 78% 56%)`;
}

function resolveTeamAccentColor(team) {
  const short = String(team?.shortName || '').toUpperCase();
  if (TEAM_COLORS_BY_SHORT[short]) return TEAM_COLORS_BY_SHORT[short];
  if (team?.name) return getTeamColor(team.name);
  return colorHashFromString(short || team?.city || 'NBA');
}

function buildSeasonMonths(season) {
  const startYear = Number(String(season || '2025-26').slice(0, 4)) || 2025;
  const out = [];
  for (let m = 10; m <= 12; m += 1) out.push(`${startYear}-${String(m).padStart(2, '0')}`);
  for (let m = 1; m <= 6; m += 1) out.push(`${startYear + 1}-${String(m).padStart(2, '0')}`);
  return out;
}

function topDateText(dateValue) {
  if (!dateValue) return 'NO DATE';
  const date = new Date(`${dateValue}T12:00:00Z`);
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
}

function gameSummaryForTeam(game, teamShort) {
  if (!game || !teamShort) return null;
  const short = String(teamShort).toUpperCase();
  const homeShort = String(game.homeTeam?.shortName || '').toUpperCase();
  const awayShort = String(game.awayTeam?.shortName || '').toUpperCase();
  if (homeShort !== short && awayShort !== short) return null;
  const isHome = homeShort === short;
  return { game, isHome, opponent: isHome ? game.awayTeam : game.homeTeam };
}

function initials(name) {
  return String(name || '').split(' ').map((x) => x[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'NA';
}

function seededMetric(seed, min, max) {
  let h = 2166136261;
  const s = String(seed || '0');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const t = (h >>> 0) / 4294967295;
  return Math.round(min + (max - min) * t);
}

function eventBadgeClass(type) {
  if (type.includes('injury') || type.includes('deadline')) return 'is-danger';
  if (type.includes('training') || type.includes('recovery')) return 'is-warning';
  if (type.includes('trade') || type.includes('transaction')) return 'is-accent';
  return 'is-info';
}

function isTradeAlertText(value) {
  const text = String(value || '').toLowerCase();
  return TRADE_ALERT_KEYWORDS.some((keyword) => text.includes(keyword));
}

function buildSeasonEvents({ scheduleGames, currentSave, teamShort }) {
  const out = [];
  const injuries = currentSave?.data?.injuries || [];
  const currentDate = currentSave?.data?.currentDate || null;
  const teamGames = (scheduleGames || [])
    .map((g) => gameSummaryForTeam(g, teamShort))
    .filter(Boolean)
    .sort((a, b) => new Date(a.game.gameDate) - new Date(b.game.gameDate));

  teamGames.forEach((entry, i) => {
    const key = getFixtureDateKeyEt(entry.game.gameDate);
    const prev = i > 0 ? getFixtureDateKeyEt(teamGames[i - 1].game.gameDate) : null;
    const b2b = prev && key && Math.abs((new Date(`${key}T00:00:00Z`) - new Date(`${prev}T00:00:00Z`)) / 86400000) === 1;
    out.push({
      id: `game-${entry.game.id}`,
      dateKey: key,
      title: `${entry.isHome ? 'vs' : '@'} ${entry.opponent?.name || '-'}`,
      type: entry.isHome ? 'home_game' : 'away_game',
      category: 'Games',
      completed: isFixtureCompleted(entry.game),
      game: entry.game,
      tags: [entry.isHome ? 'Home' : 'Away', b2b ? 'Back-to-back' : null].filter(Boolean),
    });
    if (b2b) {
      out.push({
        id: `b2b-${entry.game.id}`,
        dateKey: key,
        title: 'Back-to-back alert',
        type: 'back_to_back',
        category: 'Medical',
        completed: isFixtureCompleted(entry.game),
        game: entry.game,
        tags: ['Fatigue risk'],
      });
    }
  });

  const base = currentDate ? new Date(`${currentDate}T00:00:00Z`) : new Date();
  const weekPlan = currentSave?.data?.training?.weekPlan || {};
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const gameKeys = new Set(teamGames.map((x) => getFixtureDateKeyEt(x.game.gameDate)).filter(Boolean));
  for (let i = 0; i < 35; i += 1) {
    const d = addDays(base, i);
    const key = dateKey(d);
    if (gameKeys.has(key)) continue;
    const day = weekday[d.getUTCDay()];
    const plan = weekPlan[day];
    const focus = String(plan?.focus || 'balanced');
    out.push({
      id: `plan-${key}`,
      dateKey: key,
      title: focus === 'fitness' ? 'Recovery / Conditioning' : focus === 'defense' ? 'Defensive Practice' : focus === 'shooting' ? 'Shooting Block' : 'Team Practice',
      type: focus === 'fitness' ? 'recovery_day' : 'training_block',
      category: 'Training',
      completed: currentDate ? key < currentDate : false,
      tags: [focus],
    });
  }

  injuries.forEach((inj, idx) => {
    const weeks = safeNum(inj.expectedReturnWeeks, 1);
    const d = addDays(base, weeks * 7);
    out.push({
      id: `inj-${idx}-${inj.playerName}`,
      dateKey: dateKey(d),
      title: `${inj.playerName} projected return`,
      type: 'injury_return',
      category: 'Medical',
      completed: false,
      tags: ['Injury Return'],
    });
  });

  const seasonStart = Number(String(currentSave?.season || '2025-26').slice(0, 4)) || 2025;
  out.push({ id: 'trade-deadline', dateKey: `${seasonStart + 1}-02-15`, title: 'Trade Deadline', type: 'trade_deadline', category: 'Transactions', completed: false, tags: ['League'] });
  out.push({ id: 'contract-deadline', dateKey: `${seasonStart + 1}-06-30`, title: 'Contract Deadline', type: 'contract_deadline', category: 'Transactions', completed: false, tags: ['Finance'] });
  out.push({ id: 'scout-weekly', dateKey: dateKey(addDays(base, 6)), title: 'Scouting Sync', type: 'scouting', category: 'Scouting', completed: false, tags: ['Regional Scouts'] });
  out.push({ id: 'dev-milestone', dateKey: dateKey(addDays(base, 14)), title: 'Player Development Milestone Review', type: 'development', category: 'Training', completed: false, tags: ['Coaching Staff'] });

  return out.sort((a, b) => new Date(`${a.dateKey}T00:00:00Z`) - new Date(`${b.dateKey}T00:00:00Z`));
}
function buildSocialPosts({ currentSave, results, squadPlayers, tradeHistory, teamShort }) {
  const posts = [];
  const commentsAfterWin = [
    'Big win tonight. We earned that one together.',
    'Love the way we competed for all 48 minutes.',
    'That was a strong statement performance from the group.',
    'Proud of the energy, focus, and finish tonight.',
  ];
  const commentsAfterLoss = [
    'Tough one tonight, but we stay together and get back to work.',
    'Not the result we wanted. We learn from it and respond stronger.',
    'We will clean it up, stay locked in, and be ready next game.',
    'Setback tonight, but this group will answer with the right mindset.',
  ];
  const fanCommentsAfterWin = [
    'What a win. This team brought real energy tonight.',
    'That is Lakers basketball. Big-time finish.',
    'Statement win. Keep this momentum rolling.',
    'Love the fight from this group. Huge result tonight.',
  ];
  const fanCommentsAfterLoss = [
    'Tough result, but we keep believing in this group.',
    'Not our night. Reset and come back stronger next game.',
    'Heads up. Every season has nights like this.',
    'Stay together and respond. The bounce-back is coming.',
  ];

  const roster = (squadPlayers || []).slice(0, 15);
  const completedTeamGames = (results || [])
    .filter((g) => {
      const homeShort = String(g.homeTeam?.shortName || '').toUpperCase();
      const awayShort = String(g.awayTeam?.shortName || '').toUpperCase();
      return Boolean(teamShort) && (homeShort === teamShort || awayShort === teamShort);
    })
    .slice(0, 8);

  completedTeamGames.forEach((g, idx) => {
    const isWin = String(g.result || '').toUpperCase() === 'W';
    const homeShort = String(g.homeTeam?.shortName || '').toUpperCase();
    const isHome = homeShort === teamShort;
    const opponentShort = isHome ? g.awayTeam?.shortName : g.homeTeam?.shortName;
    const scoreText = `${isHome ? g.homeScore : g.awayScore}-${isHome ? g.awayScore : g.homeScore}`;
    const pool = isWin ? commentsAfterWin : commentsAfterLoss;
    const player = roster[(idx * 3 + 1) % Math.max(roster.length, 1)];
    const playerName = player?.name || `${teamShort} Player`;
    const handleName = playerName.replace(/[^A-Za-z0-9]/g, '');

    posts.push({
      id: `player-post-${g.id}`,
      source: 'Players',
      author: playerName,
      handle: `@${handleName}`,
      body: `${pool[idx % pool.length]} ${isWin ? 'W' : 'L'} vs ${opponentShort} (${scoreText}). #${teamShort} #NBAMatchday`,
      minutesAgo: 35 + idx * 41,
      likes: seededMetric(`pl-${g.id}-${player?.id}`, 240, 6800),
      comments: seededMetric(`pc-${g.id}-${player?.id}`, 35, 950),
      reposts: seededMetric(`pr-${g.id}-${player?.id}`, 50, 1200),
    });

    posts.push({
      id: `fan-post-${g.id}`,
      source: 'Fans',
      author: `${teamShort} Nation`,
      handle: `@${teamShort}Fans`,
      body: `${(isWin ? fanCommentsAfterWin : fanCommentsAfterLoss)[idx % 4]} Next up: ${opponentShort === teamShort ? 'league battle' : 'new challenge'}. #${teamShort}`,
      minutesAgo: 42 + idx * 45,
      likes: seededMetric(`fl-${g.id}`, 120, 3900),
      comments: seededMetric(`fc-${g.id}`, 20, 700),
      reposts: seededMetric(`fr-${g.id}`, 20, 800),
    });
  });

  const winCount = completedTeamGames.filter((g) => String(g.result || '').toUpperCase() === 'W').length;
  if (winCount >= 3) {
    posts.push({
      id: 'media-streak',
      source: 'Media',
      author: 'ESPN NBA',
      handle: '@espn',
      body: `${teamShort} have won ${winCount} of their last ${completedTeamGames.length}. Momentum building toward the next matchday.`,
      minutesAgo: 58,
      likes: seededMetric('streak-likes', 700, 5200),
      comments: seededMetric('streak-comments', 90, 900),
      reposts: seededMetric('streak-reposts', 120, 1400),
    });
  }

  (tradeHistory || []).slice(0, 3).forEach((h, idx) => {
    posts.push({
      id: `trade-${h.id}`,
      source: 'League',
      author: 'League Insider',
      handle: '@NBAInsider',
      body: `${h.title}: ${h.body || 'Front-office movement around the league.'} #TradeWatch`,
      minutesAgo: 130 + idx * 37,
      likes: seededMetric(`tl-${h.id}`, 100, 2600),
      comments: seededMetric(`tc-${h.id}`, 20, 640),
      reposts: seededMetric(`tr-${h.id}`, 40, 1100),
    });
  });

  if (posts.length < 6) {
    const fallbackPlayer = roster[0]?.name || `${teamShort} Captain`;
    posts.push({
      id: 'fallback-player',
      source: 'Players',
      author: fallbackPlayer,
      handle: `@${fallbackPlayer.replace(/[^A-Za-z0-9]/g, '')}`,
      body: 'Focused session today. Ready for the next game night.',
      minutesAgo: 25,
      likes: seededMetric('fallback-pl', 260, 2400),
      comments: seededMetric('fallback-pc', 18, 420),
      reposts: seededMetric('fallback-pr', 22, 500),
    });
  }

  return posts.sort((a, b) => a.minutesAgo - b.minutesAgo);
}

function formatTradePlayerList(names = []) {
  if (!names.length) return 'No players attached';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]} +${names.length - 2} more`;
}

export function Schedule() {
  const {
    currentSave,
    scheduleGames,
    results,
    inbox,
    squadPlayers,
    teams,
    fetchSchedule,
    fetchResults,
    fetchInbox,
    fetchSquad,
    fetchTeams,
    advanceDays,
    loadSave,
    saveTrainingConfig,
    fetchDashboard,
    dashboard,
  } = useGameStore();

  const [activeTab, setActiveTab] = useState('Calendar');
  const [viewMode, setViewMode] = useState('month');
  const [eventTypeFilter, setEventTypeFilter] = useState('All');
  const [completionFilter, setCompletionFilter] = useState('All');
  const [socialFilter, setSocialFilter] = useState('All Posts');
  const [tradeFilter, setTradeFilter] = useState('Pending');
  const [statusFilter, setStatusFilter] = useState('All');
  const [monthCursor, setMonthCursor] = useState(null);
  const [selectedDateKey, setSelectedDateKey] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [dateInput, setDateInput] = useState('');
  const [skipProgress, setSkipProgress] = useState(null);
  const [tradeData, setTradeData] = useState({ cap: null, proposals: [], history: [], offers: [] });

  const teamShort = String(currentSave?.data?.career?.teamShortName || '').toUpperCase();
  const managedTeam = teams.find((t) => String(t.shortName).toUpperCase() === teamShort) || null;
  const currentDateKey = currentSave?.data?.currentDate || null;
  const tradeBlockIds = useMemo(
    () => (currentSave?.data?.rosterManagement?.tradeBlockPlayerIds || []).map(Number).filter(Number.isFinite),
    [currentSave?.data?.rosterManagement?.tradeBlockPlayerIds],
  );

  useEffect(() => {
    if (!currentSave?.id) return;
    fetchSchedule();
    fetchResults();
    fetchInbox({ take: 80, skip: 0 });
    fetchSquad();
    fetchTeams();
    fetchDashboard();
  }, [currentSave?.id, fetchSchedule, fetchResults, fetchInbox, fetchSquad, fetchTeams, fetchDashboard]);

  useEffect(() => {
    if (!currentSave?.id || !managedTeam?.id) return;
    (async () => {
      try {
        const [capRes, proposalsRes, historyRes, offersRes] = await Promise.all([
          api.transfers.getCapSummary({ saveId: currentSave.id, teamId: managedTeam.id }),
          api.transfers.getTradeProposals({ saveId: currentSave.id }),
          api.transfers.getHistory({ saveId: currentSave.id }),
          api.transfers.getAll({ saveId: currentSave.id }),
        ]);
        setTradeData({ cap: capRes?.data || null, proposals: proposalsRes?.data || [], history: historyRes?.data || [], offers: offersRes?.data || [] });
      } catch {
        setTradeData({ cap: null, proposals: [], history: [], offers: [] });
      }
    })();
  }, [currentSave?.id, managedTeam?.id, currentDateKey]);

  const seasonMonths = useMemo(() => buildSeasonMonths(currentSave?.season || currentSave?.data?.season), [currentSave?.season, currentSave?.data?.season]);
  useEffect(() => {
    if (!seasonMonths.length) return;
    if (!monthCursor) {
      const d = currentDateKey ? String(currentDateKey).slice(0, 7) : seasonMonths[0];
      setMonthCursor(seasonMonths.includes(d) ? d : seasonMonths[0]);
    }
  }, [seasonMonths, monthCursor, currentDateKey]);

  const allEvents = useMemo(() => buildSeasonEvents({ scheduleGames, currentSave, teamShort }), [scheduleGames, currentSave, teamShort]);
  const filteredEvents = useMemo(() => allEvents.filter((e) => {
    const typeOk = eventTypeFilter === 'All' || e.category === eventTypeFilter;
    const completionOk = completionFilter === 'All' || (completionFilter === 'Upcoming' ? !e.completed : e.completed);
    return typeOk && completionOk;
  }), [allEvents, eventTypeFilter, completionFilter]);

  useEffect(() => {
    if (!selectedDateKey && currentDateKey) setSelectedDateKey(currentDateKey);
    if (!selectedDateKey && allEvents[0]) setSelectedDateKey(allEvents[0].dateKey);
  }, [selectedDateKey, currentDateKey, allEvents]);

  const selectedDayEvents = useMemo(() => filteredEvents.filter((e) => e.dateKey === selectedDateKey), [filteredEvents, selectedDateKey]);
  const selectedEvent = useMemo(() => filteredEvents.find((e) => e.id === selectedEventId) || selectedDayEvents[0] || null, [filteredEvents, selectedEventId, selectedDayEvents]);

  const byDay = useMemo(() => {
    const map = new Map();
    filteredEvents.forEach((e) => {
      const arr = map.get(e.dateKey) || [];
      arr.push(e);
      map.set(e.dateKey, arr);
    });
    return map;
  }, [filteredEvents]);

  const gamesThisWeek = useMemo(() => {
    if (!currentDateKey) return [];
    const base = new Date(`${currentDateKey}T00:00:00Z`);
    const end = addDays(base, 6);
    return (scheduleGames || []).filter((g) => {
      const key = getFixtureDateKeyEt(g.gameDate);
      if (!key) return false;
      const d = new Date(`${key}T00:00:00Z`);
      return d >= base && d <= end && Boolean(gameSummaryForTeam(g, teamShort));
    });
  }, [scheduleGames, currentDateKey, teamShort]);
  const avgFatigue = useMemo(() => {
    if (!squadPlayers?.length) return 0;
    const sum = squadPlayers.reduce((s, p) => s + safeNum(currentSave?.data?.playerState?.[String(p.id)]?.fatigue, p.fatigue ?? 10), 0);
    return Math.round(sum / squadPlayers.length);
  }, [squadPlayers, currentSave?.data?.playerState]);

  const nextGame = useMemo(() => (scheduleGames || []).find((g) => {
    const key = getFixtureDateKeyEt(g.gameDate);
    return key && key >= String(currentDateKey || '') && Boolean(gameSummaryForTeam(g, teamShort)) && !isFixtureCompleted(g);
  }), [scheduleGames, currentDateKey, teamShort]);

  const socialPosts = useMemo(
    () => buildSocialPosts({ currentSave, results, squadPlayers, tradeHistory: tradeData.history, teamShort }),
    [currentSave, results, squadPlayers, tradeData.history, teamShort]
  );
  const filteredPosts = useMemo(() => {
    if (socialFilter === 'All Posts') return socialPosts;
    if (socialFilter === 'Team') return socialPosts.filter((p) => p.source === 'Team');
    if (socialFilter === 'League') return socialPosts.filter((p) => p.source === 'League');
    if (socialFilter === 'Media') return socialPosts.filter((p) => p.source === 'Media');
    if (socialFilter === 'Players') return socialPosts.filter((p) => p.source === 'Players');
    return socialPosts.filter((p) => p.source === 'Fans');
  }, [socialPosts, socialFilter]);

  const trendMap = useMemo(() => {
    const map = new Map();
    filteredPosts.forEach((p) => {
      const tags = (p.body.match(/#[A-Za-z0-9_]+/g) || []);
      tags.forEach((t) => map.set(t, (map.get(t) || 0) + 1));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filteredPosts]);

  const tradeCards = useMemo(() => {
    const myId = managedTeam?.id;
    const proposals = (tradeData.proposals || []).map((p) => {
      const incoming = myId ? Number(p.toTeamId) === Number(myId) : false;
      const outgoing = myId ? Number(p.fromTeamId) === Number(myId) : false;
      const incomingItems = (p.items || []).filter((i) => i.direction === 'IN' && i.player).map((i) => i.player.name);
      const outgoingItems = (p.items || []).filter((i) => i.direction === 'OUT' && i.player).map((i) => i.player.name);
      return {
        id: `proposal-${p.id}`,
        source: 'proposal',
        team: incoming ? p.fromTeam : p.toTeam,
        status: p.status,
        expiresIn: Math.max(0, safeNum(p.expiresDay, 0) - safeNum(p.submittedDay, 0)),
        offer: incoming ? outgoingItems : incomingItems,
        want: incoming ? incomingItems : outgoingItems,
        fairness: safeNum(p.aiScore, 0) > 6 ? 'Good' : safeNum(p.aiScore, 0) > 3 ? 'Fair' : 'Risky',
        incoming,
        outgoing,
      };
    });
    return proposals;
  }, [tradeData.proposals, managedTeam?.id]);

  const filteredTradeCards = useMemo(() => tradeCards.filter((c) => {
    if (tradeFilter === 'Pending') {
      const status = String(c.status || '').toUpperCase();
      return status.includes('PENDING') || status.includes('OPEN') || status.includes('COUNTER');
    }
    if (tradeFilter === 'Incoming') return c.incoming;
    if (tradeFilter === 'Outgoing') return c.outgoing;
    if (tradeFilter === 'League-wide') return true;
    if (tradeFilter === 'Expiring Soon') return c.expiresIn <= 2;
    return true;
  }), [tradeCards, tradeFilter]);
  const listedTradeBlockPlayers = useMemo(() => (
    (squadPlayers || [])
      .filter((player) => tradeBlockIds.includes(Number(player.id)))
      .sort((a, b) => Number(b.salary || 0) - Number(a.salary || 0))
  ), [squadPlayers, tradeBlockIds]);
  const listedTradeBlockCards = useMemo(() => {
    const myId = Number(managedTeam?.id);
    const activeStatuses = new Set(['PENDING', 'COUNTERED', 'OPEN']);
    const activeProposals = (tradeData.proposals || []).filter((proposal) => activeStatuses.has(String(proposal.status || '').toUpperCase()));

    return listedTradeBlockPlayers.map((player) => {
      const relatedOffers = activeProposals.flatMap((proposal) => {
        const incoming = myId ? Number(proposal.toTeamId) === myId : false;
        const outgoing = myId ? Number(proposal.fromTeamId) === myId : false;
        if (!incoming && !outgoing) return [];

        const managedSideDirection = incoming ? 'IN' : 'OUT';
        const counterpartDirection = incoming ? 'OUT' : 'IN';
        const managedPlayers = (proposal.items || []).filter((item) => item.direction === managedSideDirection && item.player);
        const isForPlayer = managedPlayers.some((item) => Number(item.player?.id) === Number(player.id));
        if (!isForPlayer) return [];

        const counterpartPlayers = (proposal.items || [])
          .filter((item) => item.direction === counterpartDirection && item.player)
          .map((item) => item.player.name);

        return [{
          id: proposal.id,
          teamName: incoming ? (proposal.fromTeam?.name || proposal.fromTeam?.shortName || 'League Team') : (proposal.toTeam?.name || proposal.toTeam?.shortName || 'League Team'),
          summary: incoming
            ? `Incoming: ${formatTradePlayerList(counterpartPlayers)}`
            : `Your offer: ${formatTradePlayerList(counterpartPlayers)}`,
          status: proposal.status,
        }];
      });

      return { ...player, relatedOffers };
    });
  }, [listedTradeBlockPlayers, tradeData.proposals, managedTeam?.id]);
  const transferInboxAlerts = useMemo(
    () => (inbox?.messages || []).filter((msg) => isTradeAlertText(msg.subject) || isTradeAlertText(msg.preview) || isTradeAlertText(msg.body)),
    [inbox?.messages],
  );

  const teamRows = useMemo(() => {
    const injurySet = new Set((currentSave?.data?.injuries || []).map((x) => String(x.playerName || '').toLowerCase()));
    return (squadPlayers || []).map((p) => {
      const fat = safeNum(currentSave?.data?.playerState?.[String(p.id)]?.fatigue, p.fatigue ?? 10);
      const inj = injurySet.has(String(p.name || '').toLowerCase());
      const status = inj ? 'Minor Injury' : fat >= 78 ? 'Fatigued' : fat >= 60 ? 'Recovering' : 'Healthy';
      const fitness = clamp(100 - fat, 5, 100);
      return { ...p, status, fitness };
    });
  }, [squadPlayers, currentSave?.data?.playerState, currentSave?.data?.injuries]);

  const filteredTeamRows = useMemo(() => teamRows.filter((p) => {
    if (statusFilter === 'All') return true;
    if (statusFilter === 'Healthy') return p.status === 'Healthy';
    if (statusFilter === 'Injured') return p.status.includes('Injury');
    if (statusFilter === 'Fatigued') return p.status === 'Fatigued' || p.status === 'Recovering';
    return p.status === 'Recovering';
  }), [teamRows, statusFilter]);

  const runSimToDate = async (targetDate) => {
    if (!currentSave?.id || !targetDate) return;
    setSkipProgress({ label: `Simulating to ${targetDate}...`, value: 20 });
    try {
      const { data } = await api.saves.advance(currentSave.id, { targetDate });
      setSkipProgress({ label: `Reached ${targetDate}`, value: 100 });
      await loadSave(data.id);
      setSelectedDateKey(targetDate);
      setMonthCursor(String(targetDate).slice(0, 7));
    } catch {
      setSkipProgress({ label: 'Simulation failed', value: 100 });
    } finally {
      setTimeout(() => setSkipProgress(null), 1300);
    }
  };

  const quickSetLightTraining = async () => {
    const day = currentDateKey ? new Date(`${currentDateKey}T00:00:00Z`).getUTCDay() : new Date().getUTCDay();
    const key = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day];
    await saveTrainingConfig({ weekPlan: { [key]: { intensity: 'low', focus: 'fitness', intensityPercent: 35 } } });
  };

  if (!currentSave?.data?.career?.teamShortName) {
    return <div className="season-hub"><div className="season-empty">Start a career with a team to open the Season Hub.</div></div>;
  }

  const [yearStr, monthStr] = String(monthCursor || '').split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const daysInMonth = Number.isFinite(year) && Number.isFinite(month) ? new Date(year, month + 1, 0).getDate() : 0;
  const monthCells = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));

  const monthIdx = seasonMonths.indexOf(monthCursor);
  const prevMonth = monthIdx > 0 ? seasonMonths[monthIdx - 1] : null;
  const nextMonth = monthIdx >= 0 && monthIdx < seasonMonths.length - 1 ? seasonMonths[monthIdx + 1] : null;
  const selectedWeek = (() => {
    const start = selectedDateKey ? new Date(`${selectedDateKey}T00:00:00Z`) : new Date();
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  })();

  return (
    <div className="season-hub">
      <header className="season-head">
        <div>
          <h1>Season Hub</h1>
          <p>Schedule • Social Media • Trading • Team Status</p>
        </div>
        <div className="season-context">
          <div className="season-date">{topDateText(currentDateKey || selectedDateKey)}</div>
          <div className="season-team">{teamShort} • Season {currentSave?.data?.season || currentSave?.season}</div>
        </div>
      </header>

      <div className="season-tabs">
        {TABS.map((tab) => <button key={tab} type="button" className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </div>

      {skipProgress ? <div className="season-progress"><strong>{skipProgress.label}</strong><div><span style={{ width: `${skipProgress.value}%` }} /></div></div> : null}
      {activeTab === 'Calendar' ? (
        <section className="season-grid">
          <article className="season-card season-main">
            <div className="season-toolbar">
              <div className="segmented">{CALENDAR_VIEWS.map((v) => <button key={v} type="button" className={viewMode === v ? 'active' : ''} onClick={() => setViewMode(v)}>{v}</button>)}</div>
              <div className="filters">
                <select value={eventTypeFilter} onChange={(e) => setEventTypeFilter(e.target.value)}>{['All', 'Games', 'Training', 'Medical', 'Transactions', 'Scouting'].map((x) => <option key={x} value={x}>{x}</option>)}</select>
                <select value={completionFilter} onChange={(e) => setCompletionFilter(e.target.value)}>{['All', 'Upcoming', 'Completed'].map((x) => <option key={x} value={x}>{x}</option>)}</select>
                <button type="button" onClick={() => setSelectedDateKey(currentDateKey)}>Today</button>
                <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
                <button type="button" onClick={() => dateInput && runSimToDate(dateInput)}>Jump</button>
              </div>
            </div>

            {viewMode === 'month' ? (
              <>
                <div className="month-head"><button type="button" disabled={!prevMonth} onClick={() => prevMonth && setMonthCursor(prevMonth)}>Prev</button><h3>{Number.isFinite(year) && Number.isFinite(month) ? monthLabel(year, month) : '-'}</h3><button type="button" disabled={!nextMonth} onClick={() => nextMonth && setMonthCursor(nextMonth)}>Next</button></div>
                <div className="month-grid">
                  {monthCells.map((d) => {
                    const key = dateKey(d);
                    const events = byDay.get(key) || [];
                    const gameEvent = events.find((e) => e.category === 'Games');
                    const summary = gameEvent?.game ? gameSummaryForTeam(gameEvent.game, teamShort) : null;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`day-cell ${selectedDateKey === key ? 'selected' : ''} ${currentDateKey === key ? 'today' : ''} ${summary ? 'has-game' : ''}`}
                        style={summary ? { '--opp-accent': resolveTeamAccentColor(summary.opponent) } : undefined}
                        onClick={() => { setSelectedDateKey(key); setSelectedEventId(events[0]?.id || null); }}
                      >
                        <div className="day-top"><span>{d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</span><strong>{d.getDate()}</strong></div>
                        {summary ? <div className="opp"><img src={logoPath(summary.opponent)} alt="opp" /><b>{summary.opponent?.shortName}</b></div> : <div className="none">No Team Game</div>}
                        <div className="markers">{events.slice(0, 3).map((e) => <span key={e.id} className={`badge ${eventBadgeClass(e.type)}`}>{e.category[0]}</span>)}</div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}

            {viewMode === 'week' ? <div className="week-grid">{selectedWeek.map((d) => {
              const key = dateKey(d);
              const events = byDay.get(key) || [];
              return <div key={key} className="week-day"><h4>{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</h4>{events.length === 0 ? <p className="none">No events</p> : events.map((e) => <button key={e.id} type="button" className="event-row" onClick={() => { setSelectedDateKey(key); setSelectedEventId(e.id); }}>{e.title}<small>{e.category}</small></button>)}</div>;
            })}</div> : null}

            {viewMode === 'agenda' ? <div className="agenda-list">{filteredEvents.slice(0, 80).map((e) => <button key={e.id} type="button" className="agenda-row" onClick={() => { setSelectedDateKey(e.dateKey); setSelectedEventId(e.id); }}><div><b>{e.title}</b><small>{e.dateKey}</small></div><span className={`badge ${eventBadgeClass(e.type)}`}>{e.category}</span></button>)}</div> : null}
            {viewMode === 'timeline' ? <div className="timeline-grid">{seasonMonths.map((m) => <div key={m} className="timeline-card"><b>{m}</b><span>{filteredEvents.filter((e) => String(e.dateKey).slice(0, 7) === m).length} events</span></div>)}</div> : null}
          </article>

          <aside className="season-side">
            <div className="season-card"><h3>Event Details</h3>
              {!selectedEvent ? <p className="none">Select an event to open details.</p> : <>
                <p className="event-date">{selectedEvent.dateKey}</p><h4>{selectedEvent.title}</h4><div className="tag-row">{(selectedEvent.tags || []).map((t) => <span key={t} className="badge is-info">{t}</span>)}</div>
                {selectedEvent.game ? <p>{selectedEvent.game.awayTeam?.shortName} {selectedEvent.game.awayScore} - {selectedEvent.game.homeScore} {selectedEvent.game.homeTeam?.shortName}</p> : null}
                <div className="quick-actions">
                  <button type="button" onClick={() => { window.location.hash = 'match-center'; }}>View Match Day</button>
                  <button type="button" onClick={quickSetLightTraining}>Set Training Intensity</button>
                  <button type="button" onClick={() => { window.location.hash = 'tactics'; }}>Manage Rotations</button>
                  <button type="button" onClick={() => { window.location.hash = 'prepare'; }}>Scout Opponent</button>
                  <button type="button" onClick={() => setActiveTab('Team Status')}>Open Team Status</button>
                  <button type="button" onClick={() => runSimToDate(selectedEvent.dateKey)}>Sim To This Date</button>
                </div>
              </>}
            </div>

            <div className="season-card insights"><h3>Schedule Insights</h3>
              <p><span>Games This Week</span><b>{gamesThisWeek.length}</b></p>
              <p><span>Back-to-back Warnings</span><b>{filteredEvents.filter((e) => e.type === 'back_to_back' && !e.completed).length}</b></p>
              <p><span>Average Fatigue</span><b>{avgFatigue}</b></p>
              <p><span>Injured Players</span><b>{(currentSave?.data?.injuries || []).length}</b></p>
              <p><span>Days Until Next Game</span><b>{nextGame ? Math.max(0, Math.round((new Date(`${getFixtureDateKeyEt(nextGame.gameDate)}T00:00:00Z`) - new Date(`${currentDateKey}T00:00:00Z`)) / 86400000)) : '-'}</b></p>
              <div className="next5">{(scheduleGames || []).filter((g) => !isFixtureCompleted(g) && gameSummaryForTeam(g, teamShort)).slice(0, 5).map((g) => { const s = gameSummaryForTeam(g, teamShort); return <small key={g.id}>{getFixtureDateKeyEt(g.gameDate)} • {s?.isHome ? 'vs' : '@'} {s?.opponent?.shortName}</small>; })}</div>
              <div className="quick-row"><button type="button" onClick={() => advanceDays(1)}>Advance Day</button><button type="button" onClick={() => advanceDays(7)}>Advance Week</button></div>
            </div>
          </aside>
        </section>
      ) : null}

      {activeTab === 'Social Media' ? (
        <section className="season-grid social-grid">
          <article className="season-card season-main">
            <div className="season-toolbar"><h3>Social Media Feed</h3><select value={socialFilter} onChange={(e) => setSocialFilter(e.target.value)}>{['All Posts', 'Team', 'League', 'Media', 'Players', 'Fans'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
            <div className="feed-list">{filteredPosts.map((p) => <article key={p.id} className="post-card"><div className="post-head"><div className="avatar">{initials(p.author)}</div><div><b>{p.author}</b><small>{p.handle} • {p.minutesAgo}m ago</small></div></div><p>{p.body}</p><div className="post-metrics"><span>Likes {p.likes}</span><span>Comments {p.comments}</span><span>Reposts {p.reposts}</span></div></article>)}</div>
          </article>
          <aside className="season-side">
            <div className="season-card"><h3>Trending Topics</h3>{(trendMap.length ? trendMap : [['#NBA', 1]]).map(([tag, count]) => <p key={tag}><span>{tag}</span><b>{count}k posts</b></p>)}</div>
            <div className="season-card"><h3>Fan Sentiment</h3>{(() => {
              const wins = (results || []).slice(0, 10).filter((g) => String(g.result).toUpperCase() === 'W').length;
              const positive = clamp(45 + wins * 5, 10, 90);
              const neutral = clamp(30 - Math.round((wins - 5) * 2), 5, 60);
              const negative = clamp(100 - positive - neutral, 3, 80);
              return <><div className="sentiment"><span>Positive</span><b>{positive}%</b><div><i style={{ width: `${positive}%` }} /></div></div><div className="sentiment"><span>Neutral</span><b>{neutral}%</b><div><i style={{ width: `${neutral}%` }} /></div></div><div className="sentiment"><span>Negative</span><b>{negative}%</b><div><i style={{ width: `${negative}%` }} /></div></div></>;
            })()}</div>
            <div className="season-card"><h3>Media Pressure</h3><p><span>Level</span><b>{clamp(40 + (filteredPosts.filter((p) => p.source === 'Media').length * 6), 10, 98)}%</b></p><p><span>Team Popularity</span><b>{clamp(45 + filteredPosts.length * 4 + filteredPosts.filter((p) => p.source === 'Players').length * 3, 20, 99)}%</b></p></div>
          </aside>
        </section>
      ) : null}
      {activeTab === 'Trading Block' ? (
        <section className="season-grid">
          <article className="season-card season-main">
            <div className="season-toolbar"><h3>Active Trade Offers</h3><select value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)}>{['Pending', 'Incoming', 'Outgoing', 'League-wide', 'Expiring Soon'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
            <div className="trade-list">
              {filteredTradeCards.length === 0 ? <p className="none">No trade cards in this filter.</p> : filteredTradeCards.map((card) => <article key={card.id} className="trade-card"><div className="trade-head"><div className="avatar">{initials(card.team?.shortName || 'TR')}</div><div><b>{card.team?.name || 'Trade Package'}</b><small>Expires in {card.expiresIn} day(s)</small></div><span className={`badge ${eventBadgeClass(String(card.status || ''))}`}>{card.status}</span></div><div className="trade-cols"><div><h5>You Receive</h5>{(card.offer || []).slice(0, 3).map((x, i) => <p key={`${card.id}-o-${i}`}>{x}</p>)}</div><div><h5>You Send</h5>{(card.want || []).slice(0, 3).map((x, i) => <p key={`${card.id}-w-${i}`}>{x}</p>)}</div></div><div className="trade-foot"><span>Trade Value: <b>{card.fairness}</b></span><div><button type="button" onClick={() => { window.location.hash = 'transfers'; }}>Accept</button><button type="button" onClick={() => { window.location.hash = 'transfers'; }}>Reject</button><button type="button" onClick={() => { window.location.hash = 'transfers'; }}>Counter</button><button type="button" onClick={() => { window.location.hash = 'transfers'; }}>View Full Trade</button></div></div></article>)}
            </div>
          </article>
          <aside className="season-side">
            <div className="season-card">
              <h3>Listed On Trade Block</h3>
              {listedTradeBlockCards.length === 0 ? <p className="none">No listed players yet.</p> : listedTradeBlockCards.slice(0, 6).map((player) => (
                <article key={`tb-${player.id}`} className="trade-block-card">
                  <div className="trade-side-row">
                    <span>{player.name} ({player.position || '-'})</span>
                    <b>${(safeNum(player.salary, 0) / 1_000_000).toFixed(1)}M</b>
                  </div>
                  {player.relatedOffers.length === 0 ? (
                    <small className="trade-block-empty">No active offers yet.</small>
                  ) : (
                    <div className="trade-block-offers">
                      {player.relatedOffers.slice(0, 3).map((offer) => (
                        <div key={`tb-${player.id}-offer-${offer.id}`} className="trade-block-offer">
                          <strong>{offer.teamName}</strong>
                          <span>{offer.summary}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
            <div className="season-card">
              <h3>Trade Alerts ⚠️</h3>
              {transferInboxAlerts.length === 0 ? <p className="none">No new offer updates.</p> : transferInboxAlerts.slice(0, 5).map((message) => (
                <article key={`trade-alert-${message.id}`} className="activity-item">
                  <b>⚠️ {message.subject || 'Trade update'}</b>
                  <small>{message.preview || message.body}</small>
                </article>
              ))}
            </div>
            <div className="season-card insights"><h3>Your Trade Assets</h3><p><span>Cap Space</span><b>${(safeNum(tradeData.cap?.capSpace, 0) / 1_000_000).toFixed(1)}M</b></p><p><span>Draft Picks</span><b>2024 1st, 2025 2nd, 2026 1st</b></p><p><span>Trade Exception</span><b>$5.9M</b></p></div>
            <div className="season-card"><h3>Recent League Trades</h3>{(tradeData.history || []).slice(0, 5).map((h) => <p key={h.id}><span>{h.title}</span><small>{h.body}</small></p>)}</div>
            <div className="season-card"><h3>Hot Trade Targets</h3>{(squadPlayers || []).slice(0, 5).map((p) => <p key={p.id}><span>{p.name}</span><b>{p.position}</b></p>)}</div>
          </aside>
        </section>
      ) : null}

      {activeTab === 'Team Status' ? (
        <section className="season-grid">
          <article className="season-card season-main">
            <div className="season-toolbar"><h3>Squad Health and Fitness</h3><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>{['All', 'Healthy', 'Injured', 'Fatigued', 'Returning Soon'].map((x) => <option key={x} value={x}>{x}</option>)}</select></div>
            <div className="status-list">{filteredTeamRows.map((p) => <article key={p.id} className="status-row"><div className="status-left"><div className="avatar">{initials(p.name)}</div><div><b>{p.name}</b><small>{p.position} • #{p.jerseyCode ?? p.jerseyNumber ?? p.number ?? '-'}</small></div></div><div className="status-right"><div className="fitness"><span style={{ width: `${p.fitness}%` }} /></div><span className={`badge ${eventBadgeClass(p.status.toLowerCase())}`}>{p.status}</span></div></article>)}</div>
            <div className="chemistry-grid"><div className="season-card"><h4>Team Chemistry</h4><b>{Math.round(safeNum(dashboard?.overview?.teamChemistry, clamp(58 + (safeNum(currentSave?.data?.training?.rating, 74) - 70), 40, 99)))}%</b></div><div className="season-card"><h4>Overall Morale</h4><b>{Math.round(safeNum(dashboard?.overview?.moraleScore, teamRows.reduce((s, p) => s + safeNum(currentSave?.data?.playerState?.[String(p.id)]?.morale, p.morale ?? 65), 0) / Math.max(1, teamRows.length)))}%</b></div><div className="season-card"><h4>Locker Room</h4><b>{dashboard?.overview?.lockerRoom || (teamRows.filter((p) => p.status === 'Healthy').length >= Math.ceil(teamRows.length * 0.7) ? 'Stable' : 'Under Pressure')}</b></div></div>
          </article>

          <aside className="season-side">
            <div className="season-card insights"><h3>Quick Stats</h3><p><span>Available Players</span><b>{teamRows.filter((p) => p.status === 'Healthy' || p.status === 'Recovering').length}</b></p><p><span>Injured</span><b>{teamRows.filter((p) => p.status.includes('Injury')).length}</b></p><p><span>Fatigued</span><b>{teamRows.filter((p) => p.status === 'Fatigued').length}</b></p><p><span>Peak Form</span><b>{teamRows.filter((p) => p.fitness >= 80).length}</b></p><p><span>Avg Team Fitness</span><b>{Math.round(teamRows.reduce((s, p) => s + p.fitness, 0) / Math.max(1, teamRows.length))}%</b></p></div>
            <div className="season-card insights"><h3>Salary Cap Status</h3><p><span>Cap Used</span><b>${(safeNum(tradeData.cap?.payroll, 0) / 1_000_000).toFixed(1)}M / ${(safeNum(tradeData.cap?.salaryCap, 0) / 1_000_000).toFixed(0)}M</b></p><p><span>Cap Space</span><b>${(safeNum(tradeData.cap?.capSpace, 0) / 1_000_000).toFixed(1)}M</b></p><p><span>Luxury Tax</span><b>{safeNum(tradeData.cap?.overTax, 0) ? 'Above' : 'Below'}</b></p><p><span>Apron / Hard Cap</span><b>${(safeNum(tradeData.cap?.apron, 0) / 1_000_000).toFixed(0)}M / ${(safeNum(tradeData.cap?.hardCap, 0) / 1_000_000).toFixed(0)}M</b></p></div>
            <div className="season-card"><h3>Recent Activity</h3>{[...(inbox?.messages || []).slice(0, 4), ...(tradeData.history || []).slice(0, 3)].slice(0, 6).map((a, idx) => <article key={`${a.id || idx}`} className="activity-item"><b>{a.title || a.subject}</b><small>{a.body || a.preview}</small></article>)}</div>
          </aside>
        </section>
      ) : null}
    </div>
  );
}
