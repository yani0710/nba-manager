import { useRouter } from '../app/router';

const GROUPS = [
  {
    label: 'Overview',
    items: [
      ['dashboard', 'Dashboard', 'D'],
      ['inbox', 'Inbox', 'I'],
      ['saves', 'Saves', 'S'],
    ],
  },
  {
    label: 'Roster',
    items: [
      ['squad', 'Squad', 'Q'],
      ['tactics', 'Tactics', 'T'],
      ['training/team', 'Team Training', 'TT'],
      ['training/players', 'Player Training', 'PT'],
      ['transfers', 'Transfers', 'TR'],
      ['players', 'Players', 'P'],
      ['teams', 'Teams', 'TM'],
    ],
  },
  {
    label: 'Schedule',
    items: [
      ['schedule', 'Calendar', 'C'],
      ['prepare', 'Prepare', 'PR'],
      ['matches', 'Matches', 'M'],
      ['match-center', 'Match Center', 'MC'],
      ['results', 'Results', 'R'],
      ['league', 'Standings', 'L'],
    ],
  },
];

export function Sidebar({ collapsed = false, onToggle = () => {} }) {
  const { navigate, currentPage } = useRouter();

  return (
    <aside className="ui-sidebar">
      <div className="ui-sidebar-header">
        <button type="button" className="ui-icon-btn" onClick={onToggle} aria-label="Toggle sidebar">
          {collapsed ? '>>' : '<<'}
        </button>
        {!collapsed ? (
          <div>
            <div className="ui-brand-title">NBA Manager</div>
            <div className="ui-brand-subtitle">Front Office Suite</div>
          </div>
        ) : null}
      </div>
      <nav className="ui-sidebar-nav">
        {GROUPS.map((group) => (
          <div key={group.label} className="ui-nav-group">
            {!collapsed ? <div className="ui-nav-group-label">{group.label}</div> : null}
            {group.items.map(([key, label, icon]) => {
              const active = currentPage === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`ui-nav-item ${active ? 'is-active' : ''}`}
                  onClick={() => navigate(key)}
                  title={label}
                >
                  <span className="ui-nav-icon" aria-hidden="true">{icon}</span>
                  {!collapsed ? <span className="ui-nav-label">{label}</span> : null}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
