import { useEffect, useMemo } from 'react';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, PageHeader, SkeletonCard } from '../../components/ui';
import './profile.css';

const money = (v) => {
  const n = Number(v || 0);
  return `$${(n / 1_000_000).toFixed(1)}M`;
};

const pct = (v) => `${Number(v || 0).toFixed(1)}%`;

const GOAL_TARGET_LABELS = {
  play_in: 'Play-In',
  make_playoffs: 'Make Playoffs',
  win_round_1: 'Win Round 1',
  conference_finals: 'Conference Finals',
};

function ordinal(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return '-';
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

function fmtDate(value) {
  if (!value) return '-';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function makeEmail(name, teamShortName) {
  const cleanName = String(name || 'manager').trim().toLowerCase().replace(/[^a-z\s]/g, '');
  const [first = 'm', last = 'manager'] = cleanName.split(/\s+/);
  const teamToken = String(teamShortName || 'nba').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${first.charAt(0)}.${last}@${teamToken || 'nba'}manager.com`;
}

function formatGoalTarget(goal) {
  if (goal.type === 'financial') return money(goal.targetNumber);
  if (goal.type === 'win_target') return `${goal.targetNumber ?? '-'} wins`;
  if (goal.type === 'development') return `${goal.targetNumber ?? '-'} players`;
  if (goal.targetText) return GOAL_TARGET_LABELS[goal.targetText] || String(goal.targetText).replace(/_/g, ' ');
  return String(goal.targetNumber ?? '-');
}

export function Profile() {
  const { managerProfile, fetchManagerProfile, loading, currentSave } = useGameStore();

  useEffect(() => {
    fetchManagerProfile();
  }, [fetchManagerProfile, currentSave?.id]);

  const goals = managerProfile?.ownerGoals ?? [];
  const timeline = managerProfile?.timeline ?? [];
  const history = managerProfile?.jobSecurity?.history ?? [];
  const achievements = managerProfile?.achievements ?? [];
  const standingTrend = managerProfile?.trendCharts?.standings ?? [];

  const latestDelta = useMemo(() => {
    if (!history.length) return 0;
    return Number(history[history.length - 1]?.delta || 0);
  }, [history]);

  const joinDate = useMemo(() => {
    const candidates = [
      currentSave?.createdAt,
      ...(timeline || []).map((item) => item.date),
    ].filter(Boolean);
    if (!candidates.length) return '-';
    const sorted = [...candidates].sort((a, b) => String(a).localeCompare(String(b)));
    return fmtDate(sorted[0]);
  }, [currentSave?.createdAt, timeline]);

  const totalGames = Number(managerProfile?.careerRecord?.wins ?? 0) + Number(managerProfile?.careerRecord?.losses ?? 0);
  const winRate = totalGames > 0
    ? (Number(managerProfile?.careerRecord?.wins ?? 0) / totalGames) * 100
    : 0;
  const managerName = managerProfile?.manager?.name || 'Manager';
  const managerId = `MGR-${String(managerProfile?.manager?.season || '2025').slice(0, 4)}-${String(currentSave?.id || 1).padStart(3, '0')}`;
  const officeName = `${managerProfile?.manager?.teamName || 'Team'} Front Office`;
  const contactEmail = makeEmail(managerName, managerProfile?.manager?.teamShortName);
  const rankLabel = ordinal(managerProfile?.currentSeason?.rank);

  if (loading && !managerProfile) return <SkeletonCard />;
  if (!managerProfile) return <EmptyState title="No profile data yet" description="Advance a few days to generate manager profile metrics." />;

  return (
    <div className="profile-v3">
      <PageHeader title="MANAGER PROFILE" subtitle="Your career statistics and achievements" />

      <section className="profile-hero">
        <div className="profile-hero-top">
          <div className="profile-avatar">{String(managerName).split(/\s+/).slice(0, 2).map((s) => s.charAt(0).toUpperCase()).join('')}</div>
          <div className="profile-hero-id">
            <h2>{managerName}</h2>
            <p>General Manager - {managerProfile?.manager?.teamName}</p>
            <div className="profile-hero-meta">
              <span>Joined: {joinDate}</span>
              <span>Experience: {managerProfile?.manager?.yearsManaged || 1} Seasons</span>
            </div>
          </div>
        </div>

        <div className="profile-hero-kpis">
          <article>
            <div className="kpi-ring ring-green">T</div>
            <h4>{managerProfile?.careerRecord?.championships ?? 0}</h4>
            <p>Championships</p>
          </article>
          <article>
            <div className="kpi-ring ring-purple">A</div>
            <h4>{achievements.length}</h4>
            <p>Awards Won</p>
          </article>
          <article>
            <div className="kpi-ring ring-blue">R</div>
            <h4>{rankLabel}</h4>
            <p>League Ranking</p>
          </article>
        </div>
      </section>

      <section className="profile-two-col">
        <article className="profile-card">
          <h3>Career Statistics</h3>
          <div className="profile-stats-list">
            <div><span>Total Games</span><b>{totalGames}</b></div>
            <div><span>Win Rate</span><b className="is-green">{pct(winRate)}</b></div>
            <div><span>Playoff Appearances</span><b>{managerProfile?.careerRecord?.playoffAppearances ?? 0}</b></div>
            <div><span>Career Record</span><b>{managerProfile?.careerRecord?.wins}-{managerProfile?.careerRecord?.losses}</b></div>
            <div><span>Job Security</span><b>{managerProfile?.jobSecurity?.score ?? 0} ({managerProfile?.jobSecurity?.band || '-'})</b></div>
          </div>
          <div className="profile-job-progress">
            <i style={{ width: `${managerProfile?.jobSecurity?.score ?? 0}%` }} />
          </div>
          <div className="profile-trend-bars">
            {history.slice(-16).map((item) => (
              <span key={`${item.date}-${item.score}`} style={{ height: `${Math.max(10, Number(item.score || 0))}%` }} title={`${item.date} - ${item.score}`} />
            ))}
          </div>
          <small className={latestDelta >= 0 ? 'is-green' : 'is-red'}>
            Latest weekly change: {latestDelta >= 0 ? '+' : ''}{latestDelta}
          </small>
        </article>

        <article className="profile-card">
          <h3>Achievements</h3>
          <div className="profile-achievements">
            {achievements.length === 0 ? (
              <p className="profile-empty">No achievements unlocked yet.</p>
            ) : achievements.slice(0, 6).map((award) => (
              <div key={award.id} className="profile-achievement-row">
                <div>
                  <strong>{award.title}</strong>
                  <small>{award.season} Season</small>
                </div>
                <span>{award.type}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="profile-two-col">
        <article className="profile-card">
          <h3>Owner Goals</h3>
          <div className="profile-goals">
            {goals.map((goal) => {
              const progress = Math.round(Number(goal.progress || 0) * 100);
              const currentText = goal.type === 'financial' ? money(goal.current) : String(goal.current ?? '-');
              const targetText = formatGoalTarget(goal);
              return (
                <div key={goal.id} className="profile-goal-item">
                  <div className="profile-goal-head">
                    <strong>{goal.title}</strong>
                    <span>{currentText} / {targetText}</span>
                  </div>
                  <p className="profile-goal-description">{goal.description}</p>
                  <div className="profile-job-progress"><i style={{ width: `${progress}%` }} /></div>
                  <small className={`goal-status ${goal.status}`}>{String(goal.status || '').replace('_', ' ')}</small>
                </div>
              );
            })}
          </div>
        </article>

        <article className="profile-card">
          <h3>Career Hub</h3>
          <div className="profile-stats-list compact">
            <div><span>Transfer Moves</span><b>{managerProfile?.transferSummary?.totalMoves ?? 0}</b></div>
            <div><span>Completed Deals</span><b>{managerProfile?.transferSummary?.completed ?? 0}</b></div>
            <div><span>Failed Deals</span><b>{managerProfile?.transferSummary?.failed ?? 0}</b></div>
          </div>
          <div className="profile-mini-list">
            {(timeline || []).slice(0, 4).map((item, idx) => (
              <div key={`${item.date}-${idx}`}>
                <b>{item.title}</b>
                <small>{item.date}</small>
              </div>
            ))}
          </div>
          <div className="profile-ranking-trend">
            <span>Standings Trend</span>
            <div>
              {standingTrend.slice(-8).map((row) => (
                <em key={row.week}>W{row.week}: #{row.rank}</em>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="profile-card profile-contact">
        <h3>Contact Information</h3>
        <div className="profile-contact-grid">
          <div>
            <span>Email</span>
            <b>{contactEmail}</b>
          </div>
          <div>
            <span>Phone</span>
            <b>+1 (310) 555-{String((currentSave?.id || 1) * 37).slice(-4).padStart(4, '0')}</b>
          </div>
          <div>
            <span>Office</span>
            <b>{officeName}</b>
          </div>
          <div>
            <span>Manager ID</span>
            <b>{managerId}</b>
          </div>
        </div>
      </section>
    </div>
  );
}
