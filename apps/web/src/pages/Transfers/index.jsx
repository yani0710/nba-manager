import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, PageHeader, SkeletonTable } from '../../components/ui';

function money(v) {
  if (!v) return '-';
  return `$${(v / 1000000).toFixed(1)}M`;
}

export function Transfers() {
  const { currentSave, teams, fetchTeams } = useGameStore();
  const [fromTeamId, setFromTeamId] = useState('');
  const [toTeamId, setToTeamId] = useState('');
  const [fromRoster, setFromRoster] = useState([]);
  const [toRoster, setToRoster] = useState([]);
  const [fromPick, setFromPick] = useState('');
  const [toPick, setToPick] = useState('');
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (currentSave?.id) fetchTeams(); }, [currentSave?.id, fetchTeams]);

  useEffect(() => {
    if (!teams.length) return;
    const managedCode = currentSave?.data?.career?.teamShortName;
    const managed = teams.find((t) => t.shortName === managedCode);
    if (!fromTeamId && managed) setFromTeamId(String(managed.id));
    if (!toTeamId) {
      const fallback = teams.find((t) => String(t.id) !== String(managed?.id)) || teams[0];
      if (fallback) setToTeamId(String(fallback.id));
    }
  }, [teams, currentSave?.data?.career?.teamShortName, fromTeamId, toTeamId]);

  useEffect(() => {
    const load = async () => {
      if (!currentSave?.id || !fromTeamId) return;
      setLoading(true);
      try {
        const { data } = await api.players.getByTeam(Number(fromTeamId), { saveId: currentSave.id });
        setFromRoster(data || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fromTeamId, currentSave?.id]);

  useEffect(() => {
    const load = async () => {
      if (!currentSave?.id || !toTeamId) return;
      setLoading(true);
      try {
        const { data } = await api.players.getByTeam(Number(toTeamId), { saveId: currentSave.id });
        setToRoster(data || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toTeamId, currentSave?.id]);

  const fromTeam = teams.find((t) => String(t.id) === String(fromTeamId));
  const toTeam = teams.find((t) => String(t.id) === String(toTeamId));
  const fromPlayer = fromRoster.find((p) => String(p.id) === String(fromPick));
  const toPlayer = toRoster.find((p) => String(p.id) === String(toPick));

  const salaryDiff = useMemo(() => {
    const a = fromPlayer?.salary ?? 0;
    const b = toPlayer?.salary ?? 0;
    return a - b;
  }, [fromPlayer, toPlayer]);

  const addProposal = () => {
    if (!fromPlayer || !toPlayer || !fromTeam || !toTeam) return;
    setProposals((prev) => [{
      id: `${Date.now()}`,
      fromTeam: fromTeam.shortName,
      toTeam: toTeam.shortName,
      send: fromPlayer,
      receive: toPlayer,
      salaryDiff,
      status: 'Draft',
      note: 'Trade execution backend is not implemented yet (trades module is stubbed).',
    }, ...prev].slice(0, 12));
  };

  return (
    <div>
      <PageHeader
        title="Transfers"
        subtitle="Build and compare trade ideas. Salary values come from nba_salaries_clean.csv."
        actions={<span className="ui-badge">Negotiation Workspace (MVP)</span>}
      />

      <div className="ui-card-grid">
        <section className="ui-card ui-col-6">
          <h3>Trade Builder</h3>
          {loading ? <SkeletonTable rows={4} cols={2} /> : null}
          {!loading ? (
            <div className="ui-list-stack">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  <strong>Your Team</strong>
                  <select className="ui-select" value={fromTeamId} onChange={(e) => { setFromTeamId(e.target.value); setFromPick(''); }}>
                    <option value="">Select team</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.shortName} - {t.name}</option>)}
                  </select>
                </label>
                <label>
                  <strong>Target Team</strong>
                  <select className="ui-select" value={toTeamId} onChange={(e) => { setToTeamId(e.target.value); setToPick(''); }}>
                    <option value="">Select team</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.shortName} - {t.name}</option>)}
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  <strong>{fromTeam?.shortName || 'Team'} sends</strong>
                  <select className="ui-select" value={fromPick} onChange={(e) => setFromPick(e.target.value)}>
                    <option value="">Select player</option>
                    {fromRoster.map((p) => <option key={p.id ?? `${p.name}-${p.rosterTeamCode}`} value={p.id}>{p.name} ({p.position || '-'}) - {money(p.salary)}</option>)}
                  </select>
                </label>
                <label>
                  <strong>{toTeam?.shortName || 'Team'} sends</strong>
                  <select className="ui-select" value={toPick} onChange={(e) => setToPick(e.target.value)}>
                    <option value="">Select player</option>
                    {toRoster.map((p) => <option key={p.id ?? `${p.name}-${p.rosterTeamCode}`} value={p.id}>{p.name} ({p.position || '-'}) - {money(p.salary)}</option>)}
                  </select>
                </label>
              </div>

              <div className="ui-stat-grid">
                <div className="ui-stat-tile"><div className="ui-stat-label">Send Salary</div><div className="ui-stat-value">{money(fromPlayer?.salary ?? 0)}</div></div>
                <div className="ui-stat-tile"><div className="ui-stat-label">Receive Salary</div><div className="ui-stat-value">{money(toPlayer?.salary ?? 0)}</div></div>
                <div className="ui-stat-tile"><div className="ui-stat-label">Diff ({fromTeam?.shortName || 'You'})</div><div className="ui-stat-value" style={{ fontSize: 18 }}>{salaryDiff >= 0 ? '+' : '-'}{money(Math.abs(salaryDiff))}</div></div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="ui-btn ui-btn-primary" type="button" onClick={addProposal} disabled={!fromPlayer || !toPlayer}>
                  Add Proposal
                </button>
                <span className="ui-badge">Execution/negotiation backend TODO</span>
              </div>
            </div>
          ) : null}
        </section>

        <section className="ui-card ui-col-6">
          <h3>Proposal Board</h3>
          {proposals.length === 0 ? (
            <EmptyState title="No trade proposals yet" description="Build a player-for-player proposal to compare salaries and fit." />
          ) : (
            <div className="ui-table-shell">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Teams</th>
                    <th>Outgoing</th>
                    <th>Incoming</th>
                    <th className="ui-num">Diff</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((p) => (
                    <tr key={p.id}>
                      <td>{p.fromTeam} ↔ {p.toTeam}</td>
                      <td>{p.send.name}</td>
                      <td>{p.receive.name}</td>
                      <td className="ui-num">{money(Math.abs(p.salaryDiff))}</td>
                      <td><span className="ui-badge">{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

