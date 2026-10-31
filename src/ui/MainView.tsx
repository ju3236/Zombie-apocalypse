import { sessionStore, store, useSession } from '../game/store';
import { BaseView } from './BaseView';
import { OutsideView } from './OutsideView';

/** 메인 화면: 거점 ↔ 지도·탐험 */
export function MainView({ visible }: { visible: boolean }) {
  const session = useSession();
  const view = session.mainView;
  const expCount = Object.keys(store.s.expeditions).length;
  return (
    <div className="main-view" style={{ display: visible ? undefined : 'none' }}>
      <div className="seg">
        <button className={view === 'base' ? 'active' : ''} onClick={() => sessionStore.update({ mainView: 'base' })}>
          ⌂ 거점
        </button>
        <button className={view === 'outside' ? 'active' : ''} onClick={() => sessionStore.update({ mainView: 'outside' })}>
          ◈ 지도 · 탐험 {expCount > 0 && <span className="badge">{expCount}</span>}
        </button>
      </div>
      {/* 거점(Phaser)은 항상 마운트해 두고 숨기기만 한다 */}
      <BaseView visible={visible && view === 'base'} />
      {visible && view === 'outside' && <OutsideView />}
    </div>
  );
}
