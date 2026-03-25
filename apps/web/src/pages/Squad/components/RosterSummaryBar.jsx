import { toMoneyMillions } from '../rosterUtils';

function SummaryItem({ label, value, tone = 'default' }) {
  return (
    <article className={`roster-summary-item tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function RosterSummaryBar({ summary }) {
  return (
    <section className="roster-summary-grid">
      <SummaryItem label="Roster Spots Used" value={`${summary.rosterCount}/15`} />
      <SummaryItem label="Active Contracts" value={summary.activeContracts} />
      <SummaryItem label="Total Payroll" value={toMoneyMillions(summary.totalPayroll)} />
      <SummaryItem
        label="Cap Space"
        value={toMoneyMillions(summary.capSpace)}
        tone={summary.capSpace >= 0 ? 'positive' : 'danger'}
      />
      <SummaryItem label="Average Age" value={summary.averageAge.toFixed(1)} />
      <SummaryItem
        label="Injured Players"
        value={summary.injuredCount}
        tone={summary.injuredCount > 0 ? 'warning' : 'default'}
      />
    </section>
  );
}
