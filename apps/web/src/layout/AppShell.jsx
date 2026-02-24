import { useMemo, useState } from 'react';
import { useRouter } from '../app/router';
import { useGameStore } from '../state/gameStore';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell({ children, title = 'NBA Manager' }) {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(true);
  const { currentPage } = useRouter();
  const { currentSave } = useGameStore();

  const breadcrumbs = useMemo(() => {
    const parts = String(currentPage || 'dashboard').split('/');
    return ['Home', ...parts].join(' / ');
  }, [currentPage]);

  return (
    <div className={`ui-shell ${dark ? 'theme-dark' : 'theme-light'} ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
      <main className="ui-shell-main">
        <Topbar
          title={title}
          breadcrumbs={breadcrumbs}
          isDark={dark}
          onToggleTheme={() => setDark((v) => !v)}
          actions={(
            <>
              <span className="ui-topbar-pill">{currentSave?.data?.currentDate || 'No Date'}</span>
              <span className="ui-topbar-pill">Season {currentSave?.data?.season || '-'}</span>
            </>
          )}
        />
        <div className="ui-shell-content">
          <div className="ui-page-container">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
