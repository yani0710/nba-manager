import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../../components/ui';
import { api } from '../../api/client';
import { useGameStore } from '../../state/gameStore';
import './transfers.css';

const TABS = ['Your Squad', 'Scout Targets', 'My Offers', 'Team Proposals', 'Negotiations', 'Transaction History'];

function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '$0.0M';
  return `$${(n / 1_000_000).toFixed(1)}M`;
}

function badge(status) {
  const s = String(status || '').toUpperCase();
  if (['ACCEPTED', 'COMPLETED', 'PENDING', 'COUNTERED', 'OPEN'].includes(s)) return 'ui-badge is-positive';
  if (['REJECTED', 'ILLEGAL', 'CAP_VIOLATION', 'EXPIRED', 'FAILED'].includes(s)) return 'ui-badge is-danger';
  return 'ui-badge';
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'PL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Transfers() {
  const { currentSave, teams, fetchTeams, fetchInbox, fetchPlayers, advanceSave } = useGameStore();
  const [tab, setTab] = useState(TABS[0]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const [freeAgents, setFreeAgents] = useState([]);
  const [contractOffers, setContractOffers] = useState([]);
  const [tradeProposals, setTradeProposals] = useState([]);
  const [negotiations, setNegotiations] = useState([]);
  const [history, setHistory] = useState([]);
  const [capSummary, setCapSummary] = useState(null);

  const [allPlayers, setAllPlayers] = useState([]);
  const [myRoster, setMyRoster] = useState([]);
  const [targetTeamId, setTargetTeamId] = useState('');
  const [selectedFaId, setSelectedFaId] = useState(null);
  const [selectedIncomingIds, setSelectedIncomingIds] = useState([]);
  const [selectedOutgoingIds, setSelectedOutgoingIds] = useState([]);

  const [offerSalary, setOfferSalary] = useState(4_000_000);
  const [offerYears, setOfferYears] = useState(3);
  const [offerRolePromise, setOfferRolePromise] = useState('rotation');
  const [searchText, setSearchText] = useState('');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [transferFee, setTransferFee] = useState(0);
  const [signingBonus, setSigningBonus] = useState(0);
  const [performanceBonus, setPerformanceBonus] = useState(0);

  const managedTeamCode = currentSave?.data?.career?.teamShortName;
  const managedTeam = teams.find((t) => t.shortName === managedTeamCode) || null;
  const saveId = currentSave?.id;

  useEffect(() => { if (saveId) fetchTeams(); }, [saveId, fetchTeams]);

  const loadData = async () => {
    if (!saveId || !managedTeam?.id) return;
    setLoading(true);
    try {
      const [faRes, offersRes, proposalsRes, negotiationsRes, historyRes, capRes, playersRes, rosterRes] = await Promise.all([
        api.transfers.freeAgents ? api.transfers.freeAgents({ saveId }) : api.transfers.getAll({ saveId }),
        api.transfers.getContractOffers({ saveId, teamId: managedTeam.id }),
        api.transfers.getTradeProposals({ saveId }),
        api.transfers.getNegotiations({ saveId }),
        api.transfers.getHistory({ saveId }),
        api.transfers.getCapSummary({ saveId, teamId: managedTeam.id }),
        api.players.getAll({ saveId }),
        api.players.getByTeam(managedTeam.id, { saveId }),
      ]);
      setFreeAgents(Array.isArray(faRes?.data) ? faRes.data : []);
      setContractOffers(offersRes?.data || []);
      setTradeProposals(proposalsRes?.data || []);
      setNegotiations(negotiationsRes?.data || []);
      setHistory(historyRes?.data || []);
      setCapSummary(capRes?.data || null);
      setAllPlayers(playersRes?.data || []);
      setMyRoster(rosterRes?.data || []);
    } catch (error) {
      setToast(error.response?.data?.message || 'Failed to load transfer data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [saveId, managedTeam?.id]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const selectedFa = freeAgents.find((p) => p.id === selectedFaId) || null;
  const filteredFreeAgents = useMemo(() => {
    const q = String(searchText || '').trim().toLowerCase();
    return freeAgents.filter((p) => {
      const byName = !q || String(p.name || '').toLowerCase().includes(q);
      const byPos = positionFilter === 'ALL' || String(p.position || '').toUpperCase().includes(positionFilter);
      return byName && byPos;
    });
  }, [freeAgents, searchText, positionFilter]);

  useEffect(() => {
    if (!selectedFa) return;
    const market = Math.max(1_500_000, Number(selectedFa.salary || 5_000_000));
    setTransferFee(market);
    setOfferSalary(market);
    setOfferYears(3);
    setSigningBonus(Math.round(market * 0.08));
    setPerformanceBonus(Math.round(market * 0.02));
  }, [selectedFa?.id]);

  const dealTotal = Number(transferFee || 0)
    + Number(signingBonus || 0)
    + (Number(offerSalary || 0) * Number(offerYears || 1))
    + (Number(performanceBonus || 0) * Number(offerYears || 1));
  const dealLikelihood = Math.max(10, Math.min(95, Math.round(
    45
    + ((Number(offerSalary || 0) - Number(selectedFa?.salary || 0)) / 1_000_000) * 4
    + (Number(offerYears || 1) * 2),
  )));
  const likelihoodText = dealLikelihood >= 75 ? 'High' : (dealLikelihood >= 55 ? 'Good' : (dealLikelihood >= 35 ? 'Medium' : 'Low'));

  const targetTeamPlayers = useMemo(
    () => (!targetTeamId ? [] : allPlayers.filter((p) => String(p.teamId) === String(targetTeamId))),
    [allPlayers, targetTeamId],
  );

  const incomingPlayers = useMemo(
    () => selectedIncomingIds.map((id) => targetTeamPlayers.find((p) => Number(p.id) === Number(id))).filter(Boolean),
    [selectedIncomingIds, targetTeamPlayers],
  );
  const outgoingPlayers = useMemo(
    () => selectedOutgoingIds.map((id) => myRoster.find((p) => Number(p.id) === Number(id))).filter(Boolean),
    [selectedOutgoingIds, myRoster],
  );

  const tradeCapImpact = useMemo(() => {
    if (!capSummary) return null;
    const incomingSalary = incomingPlayers.reduce((s, p) => s + Number(p?.salary || 0), 0);
    const outgoingSalary = outgoingPlayers.reduce((s, p) => s + Number(p?.salary || 0), 0);
    const nextPayroll = Number(capSummary.payroll || 0) - outgoingSalary + incomingSalary;
    return {
      incomingSalary,
      outgoingSalary,
      nextPayroll,
      nextCapSpace: Number(capSummary.salaryCap || 0) - nextPayroll,
    };
  }, [capSummary, incomingPlayers, outgoingPlayers]);

  const toggleId = (setter, id) => setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submitContractOffer = async () => {
    if (!saveId || !managedTeam?.id || !selectedFa) return;
    setSaving(true);
    try {
      await api.transfers.submitContractOffer({
        saveId,
        teamId: managedTeam.id,
        playerId: selectedFa.id,
        salaryPerYear: Number(offerSalary),
        years: Number(offerYears),
        optionType: null,
        rolePromise: offerRolePromise,
      });
      setToast('Contract offer submitted');
      await Promise.all([loadData(), fetchInbox({ take: 80, skip: 0 })]);
    } catch (error) {
      setToast(error.response?.data?.message || 'Contract offer failed');
    } finally {
      setSaving(false);
    }
  };

  const withdrawContractOffer = async (offerId) => {
    if (!saveId) return;
    setSaving(true);
    try {
      await api.transfers.withdrawContractOffer(offerId, { saveId });
      setToast('Offer withdrawn');
      await Promise.all([loadData(), fetchInbox({ take: 80, skip: 0 })]);
    } catch (error) {
      setToast(error.response?.data?.message || 'Withdraw failed');
    } finally {
      setSaving(false);
    }
  };

  const submitTradeProposal = async () => {
    if (!saveId || !managedTeam?.id || !targetTeamId || selectedIncomingIds.length === 0 || selectedOutgoingIds.length === 0) return;
    setSaving(true);
    try {
      await api.transfers.submitTradeProposal({
        saveId,
        fromTeamId: managedTeam.id,
        toTeamId: Number(targetTeamId),
        incomingPlayerIds: selectedIncomingIds.map(Number),
        outgoingPlayerIds: selectedOutgoingIds.map(Number),
      });
      setToast('Trade proposal submitted');
      await Promise.all([loadData(), fetchInbox({ take: 80, skip: 0 })]);
    } catch (error) {
      setToast(error.response?.data?.message || 'Trade proposal failed');
    } finally {
      setSaving(false);
    }
  };

  const withdrawTradeProposal = async (proposalId) => {
    if (!saveId) return;
    setSaving(true);
    try {
      await api.transfers.withdrawTradeProposal(proposalId, { saveId });
      setToast('Trade proposal withdrawn');
      await Promise.all([loadData(), fetchInbox({ take: 80, skip: 0 })]);
    } catch (error) {
      setToast(error.response?.data?.message || 'Withdraw failed');
    } finally {
      setSaving(false);
    }
  };

  const onAdvanceDay = async () => {
    if (!saveId) return;
    setSaving(true);
    try {
      await advanceSave(saveId);
      await Promise.all([loadData(), fetchPlayers(), fetchInbox({ take: 80, skip: 0 })]);
      setToast('Advanced one day');
    } catch (error) {
      setToast(error.response?.data?.message || 'Advance failed');
    } finally {
      setSaving(false);
    }
  };

  const myOffersPendingCount = contractOffers.filter((o) => String(o.status || '').toUpperCase() === 'PENDING').length;
  const teamProposalsPendingCount = tradeProposals.filter((p) => String(p.status || '').toUpperCase() === 'PENDING').length;

  return (
    <div className="transfer-page">
      <header className="transfer-section-head">
        <div>
          <h3 style={{ marginBottom: 4, fontSize: 48, textTransform: 'uppercase' }}>Transfer Center</h3>
          <div className="transfer-section-note">Scout, negotiate, and sign new talent to your roster</div>
        </div>
        <div className="transfer-detail-card" style={{ minWidth: 220 }}>
          <div className="transfer-stat-label">Transfer Window</div>
          <div className="transfer-stat-value" style={{ fontSize: 30 }}>{capSummary?.overCap ? 'Risk' : 'Open'}</div>
          <button type="button" className="ui-btn ui-btn-primary" disabled={saving || !saveId} onClick={onAdvanceDay}>Advance Day</button>
        </div>
      </header>

      <section className="transfer-top-cards">
        <article className="transfer-stat-card">
          <div className="transfer-stat-label">Transfer Budget</div>
          <div className="transfer-stat-value">{money(Math.max(0, Number(capSummary?.capSpace || 0)))}</div>
          <div className="transfer-stat-bar"><span style={{ width: `${Math.max(8, Math.min(100, (Number(capSummary?.capSpace || 0) / Math.max(1, Number(capSummary?.salaryCap || 1))) * 100))}%` }} /></div>
          <div className="transfer-cap-sub">available for signings</div>
        </article>
        <article className="transfer-stat-card">
          <div className="transfer-stat-label">Wage Budget</div>
          <div className="transfer-stat-value">{money(Number(capSummary?.salaryCap || 0) - Number(capSummary?.payroll || 0))}</div>
          <div className="transfer-stat-bar is-blue"><span style={{ width: `${Math.max(8, Math.min(100, ((Number(capSummary?.payroll || 0)) / Math.max(1, Number(capSummary?.salaryCap || 1))) * 100))}%` }} /></div>
          <div className="transfer-cap-sub">per season remaining</div>
        </article>
        <article className="transfer-stat-card">
          <div className="transfer-stat-label">Salary Cap</div>
          <div className={`transfer-cap-state ${Number(capSummary?.capSpace || 0) >= 0 ? 'is-good' : 'is-bad'}`}>{Number(capSummary?.capSpace || 0) >= 0 ? 'Under' : 'Over'}</div>
          <div className="transfer-stat-bar"><span style={{ width: `${Math.max(8, Math.min(100, (Math.abs(Number(capSummary?.capSpace || 0)) / Math.max(1, Number(capSummary?.salaryCap || 1))) * 100))}%` }} /></div>
          <div className="transfer-cap-sub">{money(Math.abs(Number(capSummary?.capSpace || 0)))} from cap line</div>
        </article>
      </section>

      {toast ? <div className="transfer-toast">{toast}</div> : null}

      <div className="transfer-pos-tabs" style={{ marginBottom: 12 }}>
        {TABS.map((name) => (
          <button key={name} type="button" className={`transfer-pos-tab ${tab === name ? 'is-active' : ''}`} onClick={() => setTab(name)}>
            <span>{name}</span>
            {name === 'My Offers' && myOffersPendingCount > 0 ? <em className="transfer-tab-count">{myOffersPendingCount}</em> : null}
            {name === 'Team Proposals' && teamProposalsPendingCount > 0 ? <em className="transfer-tab-count is-warn">{teamProposalsPendingCount}</em> : null}
          </button>
        ))}
      </div>

      {loading ? <div className="ui-card">Loading transfer data...</div> : null}

      {!loading && tab === 'Scout Targets' ? (
        <section className="transfer-layout">
          <div className="transfer-left">
            <article className="transfer-filter-card">
              <div className="transfer-search-wrap">
                <span>🔎</span>
                <input className="transfer-search" value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder="Search available players..." />
              </div>
              <div className="transfer-pos-tabs" style={{ marginTop: 8 }}>
                {['ALL', 'PG', 'SG', 'SF', 'PF', 'C'].map((pos) => (
                  <button key={pos} type="button" className={`transfer-pos-tab ${positionFilter === pos ? 'is-active' : ''}`} onClick={() => setPositionFilter(pos)}>{pos}</button>
                ))}
              </div>
            </article>

            <article className="transfer-market-card">
              <div className="transfer-section-head">
                <h3>Available Players ({filteredFreeAgents.length})</h3>
              </div>
              {filteredFreeAgents.length === 0 ? <EmptyState title="No players in this filter" description="Try another position or search value." /> : (
                <div className="transfer-player-list" style={{ maxHeight: 580, overflow: 'auto' }}>
                  {filteredFreeAgents.map((p) => (
                    <button key={p.id} type="button" className={`transfer-player-row ${selectedFaId === p.id ? 'is-active' : ''}`} onClick={() => setSelectedFaId(p.id)}>
                      <div className="transfer-avatar">{initials(p.name)}</div>
                      <div>
                        <div className="transfer-player-head">
                          <strong>{p.name}</strong>
                          <span className={`transfer-player-ovr ${(Number(p.overallCurrent ?? p.overall ?? 0) >= 85 ? 'is-elite' : 'is-starter')}`}>{p.overallCurrent ?? p.overall ?? '-'}</span>
                        </div>
                        <div className="transfer-player-meta">{p.position || '-'} • {p.age || '--'} yrs • {p.nationality || 'N/A'}</div>
                        <div className="transfer-mini-stats">
                          <span>PPG <b>{Number(p.ptsCareer || 0).toFixed(1)}</b></span>
                          <span>RPG <b>{Number(p.trbCareer || 0).toFixed(1)}</b></span>
                          <span>APG <b>{Number(p.astCareer || 0).toFixed(1)}</b></span>
                          <span>FG% <b>{Number(p.fgCareer || 0).toFixed(1)}</b></span>
                        </div>
                      </div>
                      <div className="transfer-player-price">
                        <small>Market Value</small>
                        <b>{money(p.salary)}</b>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </article>
          </div>

          <aside className="transfer-right">
            <article className="transfer-detail-card">
              {!selectedFa ? <EmptyState title="Select a player" description="Choose a player to build an offer package." /> : (
                <>
                  <div className="transfer-detail-head">
                    <div className="transfer-avatar big">{initials(selectedFa.name)}</div>
                    <div>
                      <h3>{selectedFa.name}</h3>
                      <p>{selectedFa.position || '-'} • {selectedFa.age || '--'} years</p>
                    </div>
                  </div>
                  <div className="transfer-detail-line"><span>Market Value</span><b>{money(selectedFa.salary)}</b></div>
                  <div className="transfer-detail-line"><span>Transfer Fee</span><b>{money(transferFee)}</b></div>
                  <input className="transfer-select" type="number" value={transferFee} onChange={(e) => setTransferFee(Number(e.target.value || 0))} />
                  <div className="transfer-detail-line"><span>Annual Salary</span><b>{money(offerSalary)}</b></div>
                  <input className="transfer-select" type="number" value={offerSalary} onChange={(e) => setOfferSalary(Number(e.target.value || 0))} />
                  <div className="transfer-detail-line"><span>Contract Length</span><b>{offerYears}y</b></div>
                  <div className="transfer-proposal-actions">
                    {[2, 3, 4, 5].map((years) => (
                      <button key={years} type="button" className={`transfer-chip ${offerYears === years ? 'is-active' : ''}`} onClick={() => setOfferYears(years)}>{years}y</button>
                    ))}
                  </div>
                  <div className="transfer-detail-line"><span>Role Promise</span></div>
                  <select className="transfer-select" value={offerRolePromise} onChange={(e) => setOfferRolePromise(e.target.value)}>
                    <option value="bench">Bench</option>
                    <option value="rotation">Rotation</option>
                    <option value="starter">Starter</option>
                    <option value="star">Star</option>
                  </select>
                  <div className="transfer-detail-line"><span>Signing Bonus</span><b>{money(signingBonus)}</b></div>
                  <input className="transfer-select" type="number" value={signingBonus} onChange={(e) => setSigningBonus(Number(e.target.value || 0))} />
                  <div className="transfer-detail-line"><span>Performance Bonus</span><b>{money(performanceBonus)} / yr</b></div>
                  <input className="transfer-select" type="number" value={performanceBonus} onChange={(e) => setPerformanceBonus(Number(e.target.value || 0))} />
                </>
              )}
            </article>

            {selectedFa ? (
              <>
                <article className="transfer-summary-box">
                  <div><span>Transfer Fee</span><b>{money(transferFee)}</b></div>
                  <div><span>Agent Fee (5%)</span><b>{money(transferFee * 0.05)}</b></div>
                  <div><span>Signing Bonus</span><b>{money(signingBonus)}</b></div>
                  <div><span>Annual Salary</span><b>{money(offerSalary)} x {offerYears}y</b></div>
                  <div><span>Performance Bonus</span><b>{money(performanceBonus)} / yr</b></div>
                  <div><span>Total Package</span><b>{money(dealTotal)}</b></div>
                  <div><span>Budget After</span><b className={(Number(capSummary?.capSpace || 0) - dealTotal) >= 0 ? 'is-good' : 'is-bad'}>{money(Number(capSummary?.capSpace || 0) - dealTotal)}</b></div>
                  <div><span>Deal Likelihood</span><b>{likelihoodText} ({dealLikelihood}%)</b></div>
                  <div className="transfer-likelihood-bar"><span className={dealLikelihood >= 75 ? 'is-high' : (dealLikelihood >= 55 ? 'is-medium' : 'is-low')} /></div>
                  <button type="button" className="transfer-submit" disabled={saving} onClick={submitContractOffer}>$ Submit Offer</button>
                </article>
                <article className="transfer-detail-card">
                  <h4 style={{ margin: 0, marginBottom: 8 }}>Scout Report</h4>
                  <div className="transfer-summary-box">
                    <div><span>Shooting</span><b>{Math.round(Number(selectedFa.offensiveRating || selectedFa.overallCurrent || selectedFa.overall || 70))}</b></div>
                    <div><span>Defense</span><b>{Math.round(Number(selectedFa.defensiveRating || selectedFa.overallCurrent || selectedFa.overall || 70))}</b></div>
                    <div><span>Passing</span><b>{Math.round(Number(selectedFa.attributes?.play || 70))}</b></div>
                    <div><span>Dribbling</span><b>{Math.round(Number(selectedFa.attributes?.att || 70))}</b></div>
                  </div>
                </article>
              </>
            ) : null}
          </aside>
        </section>
      ) : null}

      {!loading && tab === 'Your Squad' ? (
        <section className="transfer-market-card">
          <div className="transfer-section-head">
            <h3>Current Squad</h3>
            <div className="transfer-stat-label">Total Value: <b style={{ color: 'var(--tr-green)' }}>{money(myRoster.reduce((sum, p) => sum + Number(p.salary || 0), 0))}</b></div>
          </div>
          {myRoster.length === 0 ? <EmptyState title="No players in squad" description="Load squad data to manage outgoing players." /> : (
            <div className="transfer-offers-list">
              {myRoster.map((p) => (
                <article key={p.id} className="transfer-offer-item">
                  <div className="transfer-offer-top">
                    <div className="transfer-player-card-mini">
                      <div className="transfer-avatar">{initials(p.name)}</div>
                      <div>
                        <strong>{p.name}</strong>
                        <div className="transfer-offer-sub">{p.position || '-'} • #{p.jerseyCode ?? p.jerseyNumber ?? p.number ?? '--'}</div>
                      </div>
                    </div>
                    <button type="button" className="ui-btn" onClick={() => setToast(`${p.name} listed on internal trade block`)}>
                      List for Sale
                    </button>
                  </div>
                  <div className="transfer-summary-box">
                    <div><span>Market Value</span><b>{money(p.salary)}</b></div>
                    <div><span>Weekly Wage</span><b>{money(Number(p.salary || 0) / 52)}</b></div>
                    <div><span>Contract</span><b>{Math.max(1, Number(p.contractYears || 2))} years</b></div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!loading && tab === 'My Offers' ? (
        <section className="transfer-market-card">
          <div className="transfer-section-head"><h3>My Offers</h3></div>
          {contractOffers.length === 0 ? <EmptyState title="No contract offers" description="Submit offers to free agents." /> : (
            <div className="transfer-offers-list">
              {contractOffers.map((o) => (
                <article key={o.id} className="transfer-offer-item">
                  <div className="transfer-offer-top">
                    <div>
                      <strong>{o.player?.name || 'Unknown Player'}</strong>
                      <div className="transfer-offer-sub">{money(o.salaryPerYear)} x {o.years} • {o.rolePromise || 'role'}</div>
                    </div>
                    <span className={badge(o.status)}>{o.status}</span>
                  </div>
                  {o.status === 'PENDING' ? <button type="button" className="ui-btn" onClick={() => withdrawContractOffer(o.id)}>Withdraw Offer</button> : null}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!loading && tab === 'Team Proposals' ? (
        <section className="transfer-market-card">
          <div className="transfer-section-head"><h3>Incoming Transfer Proposals</h3></div>
          {tradeProposals.length === 0 ? <EmptyState title="No trade proposals" description="Create trade package from Trade Targets." /> : (
            <div className="transfer-proposals">
              {tradeProposals.map((p) => (
                <article key={p.id} className="transfer-proposal-row">
                  <div className="transfer-offer-top">
                    <strong>Offer from {p.fromTeam?.name || p.fromTeam?.shortName}</strong>
                    <span className={badge(p.status)}>{p.status}</span>
                  </div>
                  <div className="transfer-summary-box">
                    <div><span>For Team</span><b>{p.toTeam?.shortName || '-'}</b></div>
                    <div><span>Offer Amount</span><b>{money((p.items || []).reduce((s, item) => s + Number(item?.player?.salary || 0), 0))}</b></div>
                    <div><span>Expires</span><b>{Math.max(1, Number(p.expiresDay || 0) - Number(p.submittedDay || 0))} day(s)</b></div>
                  </div>
                  <div className="transfer-offer-sub">{p.decisionReason || 'Review and respond to this proposal.'}</div>
                  <div className="transfer-proposal-actions">
                    <button type="button" className="ui-btn ui-btn-positive" onClick={() => setToast('Accept flow for team proposals will be wired in the next patch.')}>Accept Offer</button>
                    <button type="button" className="ui-btn ui-btn-primary" onClick={() => setToast('Counter flow for team proposals will be wired in the next patch.')}>Counter Offer</button>
                    {['PENDING', 'COUNTERED'].includes(String(p.status)) ? <button type="button" className="ui-btn ui-btn-danger" onClick={() => withdrawTradeProposal(p.id)}>Reject</button> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!loading && tab === 'Negotiations' ? (
        <section className="transfer-market-card">
          <div className="transfer-section-head"><h3>Negotiations</h3></div>
          {negotiations.length === 0 ? <EmptyState title="No negotiation events" description="Events appear when offers/proposals update." /> : (
            <div className="transfer-offers-list">
              {negotiations.map((e) => (
                <article key={e.id} className="transfer-offer-item">
                  <div className="transfer-offer-top">
                    <b>{e.title}</b>
                    <span className={badge(e.eventType)}>{e.eventType}</span>
                  </div>
                  <div className="transfer-offer-sub">{e.body || '-'}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {!loading && tab === 'Transaction History' ? (
        <section className="transfer-market-card">
          <div className="transfer-section-head"><h3>Transaction History</h3></div>
          {history.length === 0 ? <EmptyState title="No transaction history" description="Completed transactions appear here." /> : (
            <div className="transfer-offers-list">
              {history.map((h) => (
                <article key={h.id} className="transfer-offer-item">
                  <div className="transfer-offer-top">
                    <b>{h.title}</b>
                    <span className={badge(h.status)}>{h.status}</span>
                  </div>
                  <div className="transfer-offer-sub">{h.body || '-'}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

