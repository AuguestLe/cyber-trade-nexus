import { Outlet } from 'react-router-dom';
import { DrawerHost } from '@/components/DrawerHost';
import { GlobalTicker } from '@/components/GlobalTicker';
import { ToastHost } from '@/components/ToastHost';
import { TopBar } from '@/components/TopBar';
import styles from '@/styles/layout.module.css';

export function DashboardLayout() {
  return (
    <div className={styles.app}>
      <TopBar />
      <main className={styles.main}>
        <Outlet />
        <DrawerHost />
      </main>
      <GlobalTicker />
      <ToastHost />
    </div>
  );
}
