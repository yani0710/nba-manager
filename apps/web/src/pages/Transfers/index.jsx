import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { useGameStore } from '../../state/gameStore';
import { EmptyState, PageHeader, SkeletonTable } from '../../components/ui';
import './transfers.css';

const POSITION_FILTERS = ['ALL', 'PG', 'SG', 'SF', 'PF', 'C'];

function money(v) {
  if (v == null || !Number.isFinite(Number(v)) || Number(v) <= 0) return '$0.0M';
  return `$${(Number(v) / 1000000).toFixed(1)}M`;
}

function shortMoney(v) {
  if (v == null || !Number.isFinite(Number(v))) return '$0M';
  return `$${Math.round(Number(v) / 1000000)}M`;
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '--';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function statSeed(id, shift = 0) {
  const n = Number(id || 1) * 97 + shift * 31;
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

function pseudoStats(player) {
  const ov = Number(player?.overallCurrent ?? player?.overall ?? 72);
  const ppg = (ov * 0.28 + statSeed(player?.id, 1) * 8).toFixed(1);
  const rpg = (ov * 0.08 + statSeed(player?.id, 2) * 4).toFixed(1);
  const apg = (ov * 0.07 + statSeed(player?.id, 3) * 4).toFixed(1);
  const fg = (42 + (ov - 60) * 0.38 + statSeed(player?.id, 4) * 5).toFixed(1);
  return { ppg, rpg, apg, fg };
}

function offerStatusBadge(status) {
  const danger = ['CLUB_REJECTED', 'FAILED', 'REJECTED'];
  const good = ['SENT', 'CLUB_ACCEPTED', 'PLAYER_NEGOTIATION', 'COMPLETED', 'ACCEPTED'];
  if (danger.includes(status)) return 'ui-badge is-danger';
  if (good.includes(status)) return 'ui-badge is-positive';
  return 'ui-badge';
}

function positionMatch(playerPos, filter) {
  if (filter === 'ALL') return true;
  const pos = String(playerPos || '').toUpperCase();
  return pos.includes(filter);
}

function likelihoodLabel(delta) {
  const abs = Math.abs(delta);
  if (abs <= 1500000) return 'High';
  if (abs <= 5000000) return 'Medium';
  return 'Low';
}

function formTier(overall) {
  if (overall >= 88) return 'elite';
  if (overall >= 82) return 'starter';
  return 'rotation';
}

export function Transfers() {
  const { currentSave, teams, fetchTeams, fetchInbox } = useGameStore();
  const [fromTeamId, setFromTeamId] = useState('');
  const [marketPlayers, setMarketPlayers] = useState([]);
  const [fromRoster, setFromRoster] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [outgoingPieces, setOutgoingPieces] = useState([]);
  const [contractYears, setContractYears] = useState(2);

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
    const t = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!teams.length) return;
    const managedCode = currentSave?.data?.career?.teamShortName;
    const managed = teams.find((t) => t.shortName === managedCode);
    if (managed) setFromTeamId(String(managed.id));
  }, [teams, currentSave?.data?.career?.teamShortName]);

  useEffect(() => {
    const loadManaged = async () => {
      if (!currentSave?.id || !fromTeamId) return;
      setLoading(true);
      try {
        const { data } = await api.players.getByTeam(Number(fromTeamId), { saveId: currentSave.id });
        setFromRoster(data || []);
      } finally {
        setLoading(false);
      }
    };
    loadManaged();
  }, [fromTeamId, currentSave?.id]);

  useEffect(() => {
    const loadMarket = async () => {
      if (!currentSave?.id) return;
      setLoading(true);
      try {
        const { data } = await api.players.getAll({ saveId: currentSave.id });
        setMarketPlayers(data || []);
      } finally {
        setLoading(false);
      }
    };
    loadMarket();
  }, [currentSave?.id]);

  const fromTeam = teams.find((t) => String(t.id) === String(fromTeamId));

  const marketPool = useMemo(
    () => marketPlayers.filter((p) => String(p.teamId) !== String(fromTeamId)),
    [marketPlayers, fromTeamId],
  );

  const filteredMarket = useMemo(() => {
    const q = search.trim().toLowerCase();
    return marketPool
      .filter((p) => positionMatch(p.position, positionFilter))
      .filter((p) => {
        if (!q) return true;
        const teamName = String(p.team?.name || '').toLowerCase();
        return String(p.name || '').toLowerCase().includes(q) || teamName.includes(q);
      })
      .sort((a, b) => (Number(b.overallCurrent ?? b.overall ?? 0) - Number(a.overallCurrent ?? a.overall ?? 0)));
  }, [marketPool, search, positionFilter]);

  useEffect(() => {
    if (!filteredMarket.length) {
      setSelectedPlayerId(null);
      return;
    }
    if (!selectedPlayerId || !filteredMarket.some((p) => p.id === selectedPlayerId)) {
      setSelectedPlayerId(filteredMarket[0].id);
    }
  }, [filteredMarket, selectedPlayerId]);

  const selectedTarget = filteredMarket.find((p) => p.id === selectedPlayerId) || null;
  const selectedTeam = selectedTarget ? teams.find((t) => t.id === selectedTarget.teamId) : null;

  const outgoingSelected = useMemo(
    () => outgoingPieces.map((id) => fromRoster.find((p) => Number(p.id) === Number(id))).filter(Boolean),
    [outgoingPieces, fromRoster],
  );

  const receiveSalary = Number(selectedTarget?.salary || 0);
  const sendSalary = useMemo(() => outgoingSelected.reduce((sum, p) => sum + (Number(p.salary) || 0), 0), [outgoingSelected]);
  const salaryDelta = receiveSalary - sendSalary;

  const payroll = useMemo(
    () => fromRoster.reduce((sum, p) => sum + (Number(p.salary) || 0), 0),
    [fromRoster],
  );

  const transferBudget = Math.max(0, 110000000 - payroll * 0.35);
  const wageRemaining = Math.max(0, 145000000 - payroll);
  const capRoom = 170000000 - payroll;

  const totalCost = Math.max(0, receiveSalary * contractYears - sendSalary);
  const budgetAfter = transferBudget - totalCost;
  const activeLikelihood = likelihoodLabel(salaryDelta);

  const toggleOutgoing = (playerId) => {
    setOutgoingPieces((prev) => {
      const id = Number(playerId);
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      return [...prev, id];
    });
  };

  const submitOffer = async () => {
    if (!currentSave?.id || !fromTeam || !selectedTarget || !selectedTeam || outgoingPieces.length === 0) return;
    setSaving(true);
    try {
      await api.transfers.create({
        saveId: currentSave.id,
        fromTeamId: Number(fromTeam.id),
        toTeamId: Number(selectedTeam.id),
        outgoingPlayerIds: outgoingPieces.map(Number),
        incomingPlayerIds: [Number(selectedTarget.id)],
        sendNow: true,
      });
      setToast('Offer submitted');
      setOutgoingPieces([]);
      await Promise.all([loadOffers(), fetchInbox({ take: 80, skip: 0 })]);
    } catch (error) {
      setToast(error.response?.data?.message || 'Failed to submit offer');
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
      await Promise.all([loadOffers(), fetchInbox({ take: 80, skip: 0 })]);
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
      setToast(action === 'ACCEPT' ? 'Terms accepted' : action === 'NEGOTIATE' ? 'Counter sent' : 'Negotiation declined');
      await Promise.all([loadOffers(), fetchInbox({ take: 80, skip: 0 })]);
    } catch (error) {
      setToast(error.response?.data?.message || 'Proposal action failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="transfer-page">
      <PageHeader
        title="Transfer Market"
        subtitle="Combined market view, offer builder, and negotiation pipeline."
        actions={<span className="ui-badge">Cap Space: {shortMoney(capRoom)}</span>}
      />

      {toast ? <div className="transfer-toast">{toast}</div> : null}

      <div className="transfer-top-cards">
        <article className="transfer-stat-card">
          <div className="transfer-stat-label">Transfer Budget</div>
          <div className="transfer-stat-value">{shortMoney(transferBudget)}</div>
          <div className="transfer-stat-bar"><span style={{ width: `${Math.min(100, (transferBudget / 90000000) * 100)}%` }} /></div>
        </article>
        <article className="transfer-stat-card">
          <div className="transfer-stat-label">Wage Budget Remaining</div>
          <div className="transfer-stat-value">{shortMoney(wageRemaining)}</div>
          <div className="transfer-stat-bar is-blue"><span style={{ width: `${Math.min(100, (wageRemaining / 120000000) * 100)}%` }} /></div>
        </article>
        <article className="transfer-stat-card">
          <div className="transfer-stat-label">Salary Cap Status</div>
          <div className={`transfer-cap-state ${capRoom >= 0 ? 'is-good' : 'is-bad'}`}>{capRoom >= 0 ? 'Under' : 'Over'}</div>
          <div className="transfer-cap-sub">{shortMoney(Math.abs(capRoom))} {capRoom >= 0 ? 'below' : 'above'} cap line</div>
        </article>
      </div>

      <div className="transfer-layout">
        <section className="transfer-left">
          <div className="transfer-filter-card">
            <div className="transfer-search-wrap">
              <span aria-hidden="true">&#8989;</span>
              <input className="transfer-search" placeholder="Search players..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="transfer-pos-tabs">
              {POSITION_FILTERS.map((pos) => (
                <button key={pos} type="button" className={`transfer-pos-tab ${positionFilter === pos ? 'is-active' : ''}`} onClick={() => setPositionFilter(pos)}>{pos}</button>
              ))}
            </div>
            <div className="transfer-filter-meta">
              <span>{filteredMarket.length} players</span>
              <span>Filter: {positionFilter}</span>
            </div>
          </div>

          <div className="transfer-market-card">
            <div className="transfer-section-head">
              <h3>Available Players</h3>
              <span className="transfer-section-note">Click a player to build the deal on the right.</span>
            </div>
            {loading ? <SkeletonTable rows={4} cols={4} /> : null}
            {!loading && filteredMarket.length === 0 ? <EmptyState title="No players found" description="Try changing search or position filters." /> : null}
            <div className="transfer-player-list">
              {filteredMarket.map((player) => {
                const stats = pseudoStats(player);
                const overall = Number(player.overallCurrent ?? player.overall ?? 0);
                const tier = formTier(overall);
                return (
                  <button
                    key={player.id}
                    type="button"
                    className={`transfer-player-row ${selectedPlayerId === player.id ? 'is-active' : ''}`}
                    onClick={() => setSelectedPlayerId(player.id)}
                  >
                    <div className="transfer-avatar">{initials(player.name)}</div>
                    <div className="transfer-player-main">
                      <div className="transfer-player-head">
                        <strong>{player.name}</strong>
                        <div className={`transfer-player-ovr is-${tier}`}>{overall}</div>
                      </div>
                      <div className="transfer-player-meta">{player.position || '-'} • {player.age ?? '-'} years • {player.team?.shortName || '-'}</div>
                      <div className="transfer-mini-stats">
                        <span>PPG <b>{stats.ppg}</b></span>
                        <span>RPG <b>{stats.rpg}</b></span>
                        <span>APG <b>{stats.apg}</b></span>
                        <span>FG% <b>{stats.fg}</b></span>
                      </div>
                    </div>
                    <div className="transfer-player-price">
                      <b>{money(player.salary)}</b>
                      <small>Asking</small>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="transfer-market-card">
            <div className="transfer-section-head">
              <h3>Deal Pipeline</h3>
              <span className="transfer-section-note">{offers.length} active entries</span>
            </div>
            {offers.length === 0 ? (
              <EmptyState title="No transfer offers yet" description="Submit an offer and it will appear here with club and agent responses." />
            ) : (
              <div className="transfer-offers-list">
                {offers.slice(0, 8).map((offer) => (
                  <div key={offer.id} className="transfer-offer-item">
                    <div className="transfer-offer-top">
                      <strong>{offer.fromTeam?.shortName} {'->'} {offer.toTeam?.shortName}</strong>
                      <span className={offerStatusBadge(offer.status)}>{offer.status}</span>
                    </div>
                    <div className="transfer-offer-sub">Offer #{offer.id} • Resolve day {offer.resolveDay}</div>
                    {offer.status === 'DRAFT' ? <button type="button" className="ui-btn" disabled={saving} onClick={() => sendDraft(offer.id)}>Send Draft</button> : null}

                    {Array.isArray(offer.contractProposals) && offer.contractProposals.length > 0 ? (
                      <div className="transfer-proposals">
                        {offer.contractProposals.map((p) => (
                          <div key={p.id} className="transfer-proposal-row">
                            <span>{p.player?.name || `Player ${p.playerId}`}: {money(p.proposedSalary)} x {p.years}</span>
                            {p.status === 'COUNTERED' ? (
                              <div className="transfer-proposal-actions">
                                <button type="button" className="ui-btn ui-btn-primary" disabled={saving} onClick={() => respondProposal(p, 'ACCEPT')}>Accept</button>
                                <button type="button" className="ui-btn" disabled={saving} onClick={() => respondProposal(p, 'NEGOTIATE')}>Negotiate</button>
                                <button type="button" className="ui-btn" disabled={saving} onClick={() => respondProposal(p, 'DECLINE')}>Decline</button>
                              </div>
                            ) : <span className={offerStatusBadge(p.status)}>{p.status}</span>}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="transfer-right">
          <div className="transfer-detail-card">
            {selectedTarget ? (
              <>
                <div className="transfer-detail-head">
                  <div className="transfer-avatar big">{initials(selectedTarget.name)}</div>
                  <div>
                    <h3>{selectedTarget.name}</h3>
                    <p>{selectedTarget.position || '-'} • {selectedTarget.team?.name || selectedTeam?.name || '-'}</p>
                  </div>
                </div>

                <div className="transfer-detail-line">
                  <span>Transfer Fee: <b>{money(receiveSalary)}</b></span>
                  <span>Market Value: <b>{money(receiveSalary * 1.03)}</b></span>
                </div>
                <div className="transfer-range"><span style={{ width: `${Math.min(100, (receiveSalary / 85000000) * 100)}%` }} /></div>

                <div className="transfer-detail-line">
                  <span>Annual Wage: <b>{money(selectedTarget.salary)}</b></span>
                  <span>Contract Length</span>
                </div>
                <select className="transfer-select" value={contractYears} onChange={(e) => setContractYears(Number(e.target.value))}>
                  <option value={1}>1 year</option>
                  <option value={2}>2 years</option>
                  <option value={3}>3 years</option>
                  <option value={4}>4 years</option>
                  <option value={5}>5 years</option>
                </select>

                <div className="transfer-outgoing">
                  <h4>Your Outgoing Pieces ({outgoingSelected.length})</h4>
                  <div className="transfer-outgoing-list">
                    {fromRoster.slice(0, 14).map((player) => {
                      const active = outgoingPieces.includes(Number(player.id));
                      return (
                        <button
                          key={player.id}
                          type="button"
                          className={`transfer-chip ${active ? 'is-active' : ''}`}
                          onClick={() => toggleOutgoing(player.id)}
                        >
                          {player.name} ({player.position || '-'})
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="transfer-summary-box">
                  <div><span>Total Cost:</span><b>{money(totalCost)}</b></div>
                  <div><span>Budget After:</span><b className={budgetAfter >= 0 ? 'is-good' : 'is-bad'}>{money(budgetAfter)}</b></div>
                  <div><span>Deal Likelihood:</span><b>{activeLikelihood}</b></div>
                </div>

                <div className="transfer-likelihood-bar">
                  <span className={`is-${String(activeLikelihood).toLowerCase()}`} />
                </div>

                <button type="button" className="transfer-submit" disabled={saving || outgoingPieces.length === 0 || !selectedTarget} onClick={submitOffer}>$ Submit Offer</button>
              </>
            ) : (
              <EmptyState title="Select a player" description="Pick a player from the market list to build an offer." />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
