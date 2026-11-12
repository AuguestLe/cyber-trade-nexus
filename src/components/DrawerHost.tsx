import { useUiStore } from '@/store/uiStore';
import { TradeDrawer } from './TradeDrawer';
import { NodeDrawer } from './NodeDrawer';
import styles from '@/styles/layout.module.css';

export function DrawerHost() {
  const drawer = useUiStore((state) => state.drawer);
  if (!drawer.kind || !drawer.id) return null;
  return (
    <div className={styles.drawerHost}>
      {drawer.kind === 'trade' ? <TradeDrawer id={drawer.id} /> : <NodeDrawer id={drawer.id} />}
    </div>
  );
}
