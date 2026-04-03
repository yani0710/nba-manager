import { useEffect, useMemo } from 'react';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, PageHeader, SkeletonCard } from '../../components/ui';
import './profile.css';

const money = (v) => {
  const n = Number(v || 0);
  return `$${(n / 1_000_000).toFixed(1)}M`;
};

const pct = (v) => `${Number(v || 0).toFixed(1)}%`;

export function Profile() {
  const { managerProfile, fetchManagerProfile, loading, currentSave } = useGameStore();

  useEffect(() => {
    fetchManagerProfile();
  }, [fetchManagerProfile, currentSave?.id]);

  const goals = managerProfile?.ownerGoals ?? [];
  const timeline = managerProfile?.timeline ?? [];
  const history = managerProfile?.jobSecurity?.history ?? [];

  const latestDelta = useMemo(() => {
    if (!history.length) return 0;
    return Number(history[history.length - 1]?.delta || 0);
  }, [history]);

  if (loading && !managerProfile) return <SkeletonCard />;
  if (!managerProfile) return <EmptyState title="No profile data yet" description="Advance a few days to generate manager profile metrics." />;

  return (
    <div className="manager-profile-page">
      <PageHeader title="MANAGER PROFILE" subtitle="Career hub with owner goals, job security, and leadership trajectory." />

      <section className="manager-head-card">
        <div>
          <h2>{managerProfile.manager?.name}</h2>
          <p>{managerProfile.manager?.teamName} ({managerProfile.manager?.teamShortName}) - Season {managerProfile.manager?.season}</p>
          <small>{managerProfile.manager?.yearsManaged} year(s) managed</small>
        </div>
        <div className="manager-kpis">
          <div><span>Career Record</span><b>{managerProfile.careerRecord?.wins}-{managerProfile.careerRecord?.losses}</b></div>
          <div><span>Playoff Apps</span><b>{managerProfile.careerRecord?.playoffAppearances ?? 0}</b></div>
          <div><span>Titles</span><b>{managerProfile.careerRecord?.championships ?? 0}</b></div>
        </div>
      </section>

      <section className="manager-grid">
        <article className="manager-card manager-security">
          <h3>Job Security</h3>
          <p className="big">{managerProfile.jobSecurity?.score ?? 0}</p>
          <small>{managerProfile.jobSecurity?.band || '-'}</small>
          <div className="manager-progress"><i style={{ width: `${managerProfile.jobSecurity?.score ?? 0}%` }} /></div>
          <p className={`delta ${latestDelta >= 0 ? 'up' : 'down'}`}>{latestDelta >= 0 ? '+' : ''}{latestDelta} latest weekly change</p>
          <div className="mini-history">
            {history.slice(-12).map((point) => (
              <span key={`${point.date}-${point.score}`} title={`${point.date}: ${point.score}`} style={{ height: `${Math.max(12, Number(point.score || 0))}%` }} />
            ))}
          </div>
        </article>

        <article className="manager-card">
          <h3>Current Season</h3>
          <div className="manager-lines">
            <div><span>Conference</span><b>{managerProfile.currentSeason?.conference || '-'}</b></div>
            <div><span>Rank</span><b>{managerProfile.currentSeason?.rank || '-'}</b></div>
            <div><span>Record</span><b>{managerProfile.currentSeason?.wins}-{managerProfile.currentSeason?.losses}</b></div>
            <div><span>Win %</span><b>{pct((managerProfile.currentSeason?.pct || 0) * 100)}</b></div>
            <div><span>Streak</span><b>{managerProfile.currentSeason?.streak || '-'}</b></div>
            <div><span>L10</span><b>{managerProfile.currentSeason?.l10 || '0-0'}</b></div>
          </div>
        </article>

        <article className="manager-card">
          <h3>Reputation Badges</h3>
          <div className="badge-grid">
            {(managerProfile.reputationBadges || []).map((badge) => (
              <div key={badge.id} className="badge-item">
                <span>{badge.label}</span>
                <b>{badge.value}</b>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="manager-card">
        <h3>Owner Goals</h3>
        <div className="goals-list">
          {goals.map((goal) => {
            const progress = Math.round((Number(goal.progress || 0)) * 100);
            const currentText = goal.type === 'financial' ? money(goal.current) : String(goal.current ?? '-');
            const targetText = goal.type === 'financial'
              ? money(goal.targetNumber)
              : goal.targetText || String(goal.targetNumber ?? '-');
            return (
              <div key={goal.id} className="goal-row">
                <div>
                  <strong>{goal.title}</strong>
                  <small>{goal.description}</small>
                </div>
                <div className="goal-meta">
                  <span>{currentText} / {targetText}</span>
                  <span className={`status ${goal.status}`}>{String(goal.status || '').replace('_', ' ')}</span>
                </div>
                <div className="manager-progress"><i style={{ width: `${progress}%` }} /></div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="manager-grid">
        <article className="manager-card">
          <h3>Transfer Summary</h3>
          <div className="manager-lines">
            <div><span>Total Moves</span><b>{managerProfile.transferSummary?.totalMoves ?? 0}</b></div>
            <div><span>Completed</span><b>{managerProfile.transferSummary?.completed ?? 0}</b></div>
            <div><span>Failed</span><b>{managerProfile.transferSummary?.failed ?? 0}</b></div>
          </div>
          <div className="deal-box">
            <strong>Best Deal</strong>
            <p>{managerProfile.transferSummary?.bestDeal?.title || 'No completed deals yet'}</p>
            <small>{managerProfile.transferSummary?.bestDeal?.detail || ''}</small>
          </div>
          <div className="deal-box">
            <strong>Worst Deal</strong>
            <p>{managerProfile.transferSummary?.worstDeal?.title || 'No failed deals yet'}</p>
            <small>{managerProfile.transferSummary?.worstDeal?.detail || ''}</small>
          </div>
        </article>

        <article className="manager-card">
          <h3>Season Timeline Highlights</h3>
          <div className="timeline-list">
            {timeline.length === 0 ? <p>No timeline events yet.</p> : timeline.map((item, idx) => (
              <div key={`${item.date}-${item.title}-${idx}`} className="timeline-item">
                <span>{item.date}</span>
                <div>
                  <b>{item.title}</b>
                  <small>{item.detail}</small>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
