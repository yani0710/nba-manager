import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import './AppShell.css';

export function AppShell({ children, title = 'NBA Manager' }) {
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Topbar title={title} />
        <div className="content">
          {children}
        </div>
      </main>
    </div>
  );
}
