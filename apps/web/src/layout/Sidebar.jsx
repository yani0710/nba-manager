import { useRouter } from '../app/router';
import './Sidebar.css';

export function Sidebar() {
  const { navigate, pages, currentPage } = useRouter();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>NBA Manager</h1>
      </div>
      <nav className="sidebar-nav">
        {Object.entries(pages).map(([key, label]) => (
          <button
            key={key}
            className={`nav-item ${currentPage === key ? 'active' : ''}`}
            onClick={() => navigate(key)}
          >
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
