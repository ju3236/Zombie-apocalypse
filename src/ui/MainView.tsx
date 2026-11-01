import { sessionStore, store, useSession } from '../game/store';
import { BaseView } from './BaseView';
import { isGm } from '../game/systems/gm';
import { OutsideView } from './OutsideView';

/** 위쪽 탭: 거점 · 지도·탐험 · 생존자 · 창고 */
export function TopTabs() {
  const session = useSession();
  const expCount = Object.keys(store.s.expeditions).length;
  const on = (tab: string, view?: string) => session.tab === tab && (!view || session.mainView === view);
  return (
    <div className="seg top-tabs">
      <button className={on('main', 'base') ? 'active' : ''} onClick={() => sessionStore.update({ tab: 'main', mainView: 'base' })}>
        ⌂ 거점
      </button>
      <button className={on('main', 'outside') ? 'active' : ''} onClick={() => sessionStore.update({ tab: 'main', mainView: 'outside' })}>
        ◈ 지도 · 탐험 {expCount > 0 && <span className="badge">{expCount}</span>}
      </button>
      <button className={`tt-extra ${on('characters') ? 'active' : ''}`} onClick={() => sessionStore.update({ tab: 'characters', viewCharId: null })}>
        ☺ 생존자
      </button>
      <button className={`tt-extra ${on('storage') ? 'active' : ''}`} onClick={() => sessionStore.update({ tab: 'storage' })}>
        ▤ 창고
      </button>
      {isGm(store.s, session.player) && (
        <button className={`tt-gm ${on('gm') ? 'active' : ''}`} onClick={() => sessionStore.update({ tab: 'gm' })}>
          🛠️ GM
        </button>
      )}
    </div>
  );
}

/** 메인 화면: 거점 ↔ 지도·탐험 */
export function MainView({ visible }: { visible: boolean }) {
  const session = useSession();
  const view = session.mainView;
  return (
    <div className="main-view" style={{ display: visible ? undefined : 'none' }}>
      {/* 거점(Phaser)은 항상 마운트해 두고 숨기기만 한다 */}
      <BaseView visible={visible && view === 'base'} />
      {visible && view === 'outside' && <OutsideView />}
    </div>
  );
}
