import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, PageHeader, SkeletonTable } from '../../components/ui';

function money(v) {
  if (v == null || !Number.isFinite(Number(v)) || Number(v) <= 0) return '-';
  return `$${(Number(v) / 1000000).toFixed(1)}M`;
}

function offerStatusBadge(status) {
  const danger = ['CLUB_REJECTED', 'FAILED', 'REJECTED'];
  const good = ['SENT', 'CLUB_ACCEPTED', 'PLAYER_NEGOTIATION', 'COMPLETED', 'ACCEPTED'];
  if (danger.includes(status)) return 'ui-badge is-danger';
  if (good.includes(status)) return 'ui-badge is-positive';
  return 'ui-badge';
}

export function Transfers() {
  const { currentSave, teams, fetchTeams, fetchInbox } = useGameStore();
  const [fromTeamId, setFromTeamId] = useState('');
  const [toTeamId, setToTeamId] = useState('');
  const [fromRoster, setFromRoster] = useState([]);
  const [toRoster, setToRoster] = useState([]);
  const [fromPick, setFromPick] = useState('');
  const [toPick, setToPick] = useState('');
  const [outgoingPieces, setOutgoingPieces] = useState([]);
  const [incomingPieces, setIncomingPieces] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const loadOffers = async () => {
    if (!currentSave?.id) return;
    try {
      const { data } = await api.transfers.getAll({ saveId: currentSave.id });
      setOffers(data || []);
    } catch (error) {
      setToast(error.response?.data?.message || 'Failed to load offers');
    }
  };

  useEffect(() => { if (currentSave?.id) fetchTeams(); }, [currentSave?.id, fetchTeams]);
  useEffect(() => { if (currentSave?.id) loadOffers(); }, [currentSave?.id, currentSave?.data?.currentDate]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

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

  const outgoingSelected = useMemo(
    () => outgoingPieces.map((id) => fromRoster.find((p) => Number(p.id) === Number(id))).filter(Boolean),
    [outgoingPieces, fromRoster],
  );
  const incomingSelected = useMemo(
    () => incomingPieces.map((id) => toRoster.find((p) => Number(p.id) === Number(id))).filter(Boolean),
    [incomingPieces, toRoster],
  );

  const sendSalary = useMemo(() => outgoingSelected.reduce((s, p) => s + (Number(p.salary) || 0), 0), [outgoingSelected]);
  const receiveSalary = useMemo(() => incomingSelected.reduce((s, p) => s + (Number(p.salary) || 0), 0), [incomingSelected]);

  const salaryDiff = useMemo(() => {
    const a = sendSalary;
    const b = receiveSalary;
    return a - b;
  }, [sendSalary, receiveSalary]);

  const createOffer = async (sendNow) => {
    const outgoingIds = outgoingPieces.length ? outgoingPieces : (fromPlayer?.id ? [Number(fromPlayer.id)] : []);
    const incomingIds = incomingPieces.length ? incomingPieces : (toPlayer?.id ? [Number(toPlayer.id)] : []);
    if (!outgoingIds.length || !incomingIds.length || !fromTeam || !toTeam || !currentSave?.id) return;
    setSaving(true);
    try {
      await api.transfers.create({
        saveId: currentSave.id,
        fromTeamId: Number(fromTeamId),
        toTeamId: Number(toTeamId),
        outgoingPlayerIds: outgoingIds.map(Number),
        incomingPlayerIds: incomingIds.map(Number),
        sendNow,
      });
      setToast(sendNow ? 'Offer sent' : 'Draft saved');
      if (sendNow) {
        setOutgoingPieces([]);
        setIncomingPieces([]);
        setFromPick('');
        setToPick('');
      }
      await Promise.all([loadOffers(), fetchInbox({ take: 50, skip: 0 })]);
    } catch (error) {
      setToast(error.response?.data?.message || 'Failed to create offer');
    } finally {
      setSaving(false);
    }
  };

  const sendDraft = async (offerId) => {
    if (!currentSave?.id) return;
    setSaving(true);
    try {
      await api.transfers.send(offerId, { saveId: currentSave.id });
      setToast('Draft sent');
      await Promise.all([loadOffers(), fetchInbox({ take: 50, skip: 0 })]);
    } catch (error) {
      setToast(error.response?.data?.message || 'Failed to send draft');
    } finally {
      setSaving(false);
    }
  };

  const respondProposal = async (proposal, action) => {
    if (!currentSave?.id) return;
    setSaving(true);
    try {
      if (action === 'NEGOTIATE') {
        await api.transfers.respondToProposal(proposal.id, {
          saveId: currentSave.id,
          action,
          proposedSalary: Math.round((proposal.proposedSalary ?? proposal.player?.salary ?? 1000000) * 0.95),
          years: Math.max(1, (proposal.years ?? 2) - 1),
          role: proposal.role || 'rotation',
        });
      } else {
        await api.transfers.respondToProposal(proposal.id, { saveId: currentSave.id, action });
      }
      setToast(action === 'ACCEPT' ? 'Terms accepted and sent to player' : action === 'NEGOTIATE' ? 'Counter sent to agent' : 'Negotiation declined');
      await Promise.all([loadOffers(), fetchInbox({ take: 100, skip: 0 })]);
    } catch (error) {
      setToast(error.response?.data?.message || 'Proposal action failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Transfers"
        subtitle="Real transfer offers with delayed club decisions and agent negotiation. Roster/salary source = nba_salaries_clean.csv."
        actions={<span className="ui-badge is-positive">Phase 1.5 + 2</span>}
      />

      <div className="ui-card-grid">
        <section className="ui-card ui-col-6">
          <h3>Offer Builder</h3>
          {toast ? <div className="ui-badge" style={{ marginBottom: 10 }}>{toast}</div> : null}
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
                  <div style={{ display: 'grid', gap: 6 }}>
                    <select className="ui-select" value={fromPick} onChange={(e) => setFromPick(e.target.value)}>
                      <option value="">Select player</option>
                      {fromRoster.map((p) => <option key={p.id ?? `${p.name}-${p.rosterTeamCode}`} value={p.id}>{p.name} ({p.position || '-'}) - {money(p.salary)}</option>)}
                    </select>
                    <button
                      className="ui-btn"
                      type="button"
                      disabled={!fromPlayer || outgoingPieces.includes(Number(fromPlayer?.id))}
                      onClick={() => {
                        if (!fromPlayer?.id) return;
                        setOutgoingPieces((prev) => [...prev, Number(fromPlayer.id)]);
                      }}
                    >
                      Add Outgoing Piece
                    </button>
                  </div>
                </label>
                <label>
                  <strong>{toTeam?.shortName || 'Team'} sends</strong>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <select className="ui-select" value={toPick} onChange={(e) => setToPick(e.target.value)}>
                      <option value="">Select player</option>
                      {toRoster.map((p) => <option key={p.id ?? `${p.name}-${p.rosterTeamCode}`} value={p.id}>{p.name} ({p.position || '-'}) - {money(p.salary)}</option>)}
                    </select>
                    <button
                      className="ui-btn"
                      type="button"
                      disabled={!toPlayer || incomingPieces.includes(Number(toPlayer?.id))}
                      onClick={() => {
                        if (!toPlayer?.id) return;
                        setIncomingPieces((prev) => [...prev, Number(toPlayer.id)]);
                      }}
                    >
                      Add Incoming Piece
                    </button>
                  </div>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="ui-list-item">
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Outgoing Pieces ({outgoingSelected.length})</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {outgoingSelected.length === 0 ? <span className="ui-badge">None selected</span> : outgoingSelected.map((p) => (
                      <button key={p.id} type="button" className="ui-btn" onClick={() => setOutgoingPieces((prev) => prev.filter((id) => id !== Number(p.id)))}>{p.name} ✕</button>
                    ))}
                  </div>
                </div>
                <div className="ui-list-item">
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Incoming Pieces ({incomingSelected.length})</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {incomingSelected.length === 0 ? <span className="ui-badge">None selected</span> : incomingSelected.map((p) => (
                      <button key={p.id} type="button" className="ui-btn" onClick={() => setIncomingPieces((prev) => prev.filter((id) => id !== Number(p.id)))}>{p.name} ✕</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="ui-stat-grid">
                <div className="ui-stat-tile"><div className="ui-stat-label">Send Salary</div><div className="ui-stat-value">{money(sendSalary)}</div></div>
                <div className="ui-stat-tile"><div className="ui-stat-label">Receive Salary</div><div className="ui-stat-value">{money(receiveSalary)}</div></div>
                <div className="ui-stat-tile"><div className="ui-stat-label">Diff ({fromTeam?.shortName || 'You'})</div><div className="ui-stat-value" style={{ fontSize: 18 }}>{salaryDiff >= 0 ? '+' : '-'}{money(Math.abs(salaryDiff))}</div></div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="ui-btn" type="button" onClick={() => createOffer(false)} disabled={((outgoingPieces.length === 0 && !fromPlayer) || (incomingPieces.length === 0 && !toPlayer) || saving)}>Save Draft</button>
                <button className="ui-btn ui-btn-primary" type="button" onClick={() => createOffer(true)} disabled={((outgoingPieces.length === 0 && !fromPlayer) || (incomingPieces.length === 0 && !toPlayer) || saving)}>Send Offer</button>
                <span className="ui-badge is-positive">Many-for-many supported</span>
              </div>
            </div>
          ) : null}
        </section>

        <section className="ui-card ui-col-6">
          <h3>Offers Board</h3>
          {offers.length === 0 ? (
            <EmptyState title="No transfer offers yet" description="Create or send an offer and it will persist here across refresh and day advances." />
          ) : (
            <div className="ui-list-stack" style={{ maxHeight: 640, overflow: 'auto' }}>
              {offers.map((offer) => (
                <div key={offer.id} className="ui-card" style={{ padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        {offer.fromTeam?.shortName} {'->'} {offer.toTeam?.shortName}
                      </div>
                      <div style={{ color: 'var(--ui-text-muted)', fontSize: 12 }}>
                        Offer #{offer.id} | Resolve day {offer.resolveDay}
                      </div>
                    </div>
                    <span className={offerStatusBadge(offer.status)}>{offer.status}</span>
                  </div>

                  <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                    <div style={{ fontSize: 13 }}>Outgoing IDs: {(offer.outgoingPlayerIds || []).join(', ') || '-'}</div>
                    <div style={{ fontSize: 13 }}>Incoming IDs: {(offer.incomingPlayerIds || []).join(', ') || '-'}</div>
                    {offer.aiReason ? <div style={{ color: 'var(--ui-text-muted)', fontSize: 12 }}>AI: {offer.aiReason}</div> : null}
                  </div>

                  {offer.status === 'DRAFT' ? (
                    <div style={{ marginTop: 8 }}>
                      <button className="ui-btn ui-btn-primary" type="button" disabled={saving} onClick={() => sendDraft(offer.id)}>Send Draft</button>
                    </div>
                  ) : null}

                  {Array.isArray(offer.contractProposals) && offer.contractProposals.length > 0 ? (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>Agent / Player Negotiations</div>
                      <div className="ui-table-shell">
                        <table className="ui-table">
                          <thead>
                            <tr>
                              <th>Player</th>
                              <th>Terms</th>
                              <th>Status</th>
                              <th className="ui-num">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {offer.contractProposals.map((p) => (
                              <tr key={p.id}>
                                <td>{p.player?.name || `Player ${p.playerId}`}</td>
                                <td>{money(p.proposedSalary)} x {p.years} ({p.role})</td>
                                <td><span className={offerStatusBadge(p.status)}>{p.status}</span></td>
                                <td className="ui-num">
                                  {p.status === 'COUNTERED' ? (
                                    <div style={{ display: 'inline-flex', gap: 6 }}>
                                      <button className="ui-btn ui-btn-primary" type="button" disabled={saving} onClick={() => respondProposal(p, 'ACCEPT')}>Accept</button>
                                      <button className="ui-btn" type="button" disabled={saving} onClick={() => respondProposal(p, 'NEGOTIATE')}>Negotiate</button>
                                      <button className="ui-btn" type="button" disabled={saving} onClick={() => respondProposal(p, 'DECLINE')}>Decline</button>
                                    </div>
                                  ) : p.status === 'OFFERED' ? (
                                    <span className="ui-badge">Waiting response</span>
                                  ) : (
                                    <span className="ui-badge">{p.status}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
