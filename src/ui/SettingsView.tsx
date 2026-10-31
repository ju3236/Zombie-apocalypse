import { toast } from '../game/bus';
import { adapter, sessionStore, store, useSession } from '../game/store';
import { exportSave, readSaveFile } from '../game/persistence';
import { Panel, StoreText } from './common';
import { CLOCK_MODES, makeClock } from '../game/systems/clock';
import { RAID_LABEL } from '../game/systems/raid';
import { OnlinePanel } from './OnlinePanel';
import { useState } from 'react';
import { askDesktopPermission, desktopPermission, desktopSupported, notify, notifyPrefs, setNotifyPrefs } from '../game/notify';

export function SettingsView() {
  const s = store.s;
  const session = useSession();

  return (
    <div className="settings">
      <Panel title="월드">
        <label className="field">
          월드 이름
          <StoreText value={s.worldName} onCommit={(v) => ((s.worldName = v), store.commit())} />
        </label>
        <label className="check">
          <input type="checkbox" checked={s.settings.autoConsume} onChange={(e) => ((s.settings.autoConsume = e.target.checked), store.commit())} />
          거점에 있는 캐릭터는 배고프거나 목마르면 창고에서 알아서 먹고 마신다
        </label>
        <label className="field">
          시계 속도 (실시간)
          <select
            value={s.settings.clockMode ?? 'real'}
            onChange={(e) => {
              s.settings.clockMode = e.target.value as typeof s.settings.clockMode;
              s.clock = makeClock(s);
              store.commit();
            }}
          >
            {CLOCK_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          거점 습격
          <select value={s.settings.raids ?? 'normal'} onChange={(e) => ((s.settings.raids = e.target.value as typeof s.settings.raids), store.commit())}>
            {Object.entries(RAID_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <div className="muted small">
          게임 시간은 실제 시간에 맞춰 계속 흐른다. 아무도 접속하지 않은 동안에도 시간은 흐르지만, 그동안 굶주림·목마름·상처로 쓰러지지는 않는다 (배고픔·목마름은 15 아래로
          떨어지지 않음). 장기 탐사는 자리를 비워도 계속 진행된다.
        </div>
      </Panel>
      <NotifyPanel />
      <OnlinePanel />
      <Panel title="플레이어">
        <div>
          현재 플레이어: <b>{session.player}</b>
        </div>
        <div className="muted small">참가한 플레이어: {s.players.join(', ')}</div>
        <button onClick={() => sessionStore.update({ player: '', activeCharacterId: null })}>플레이어 전환</button>
      </Panel>
      <Panel title="저장">
        <div className="muted small">
          저장 방식: {adapter.name} (자동 저장). 친구와 실시간으로 같이 하려면 위의 &apos;같이 살기&apos;를 쓴다. 세이브 파일은 백업하거나 다른 브라우저로 옮길 때
          쓴다.
        </div>
        <div className="row wrap">
          <button className="primary" onClick={() => exportSave(s)}>
            세이브 파일 내보내기
          </button>
          <label className="file-btn">
            세이브 파일 가져오기
            <input
              type="file"
              accept="application/json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (!confirm('현재 월드를 덮어씁니다. 계속할까요?')) return;
                try {
                  store.set(await readSaveFile(f));
                  toast('세이브를 불러왔다.', 'good');
                } catch (err) {
                  toast(String((err as Error).message), 'bad');
                }
              }}
            />
          </label>
        </div>
      </Panel>
      <Panel title="위험 구역">
        <button
          className="danger"
          onClick={async () => {
            if (!confirm('월드를 완전히 삭제하고 처음부터 시작합니다. 되돌릴 수 없습니다!')) return;
            await adapter.clear();
            sessionStore.update({ activeCharacterId: null, tab: 'main', mainView: 'base' });
            store.set(null);
          }}
        >
          월드 초기화
        </button>
      </Panel>
    </div>
  );
}

function NotifyPanel() {
  const [p, setP] = useState(notifyPrefs());
  const [perm, setPerm] = useState(desktopPermission());
  const upd = (x: Partial<typeof p>) => {
    setNotifyPrefs(x);
    setP(notifyPrefs());
  };
  return (
    <Panel title="🔔 알림 (이 브라우저)">
      <label className="check">
        <input type="checkbox" checked={p.sound} onChange={(e) => upd({ sound: e.target.checked })} />
        효과음 (도착·귀환·습격)
      </label>
      <label className="check">
        <input type="checkbox" checked={p.desktop} onChange={(e) => upd({ desktop: e.target.checked })} />
        다른 탭을 보고 있을 때 브라우저 알림
      </label>
      {desktopSupported() && perm !== 'granted' && (
        <button onClick={() => void askDesktopPermission().then(setPerm)} disabled={perm === 'denied'}>
          {perm === 'denied' ? '브라우저에서 알림이 차단됨 (주소창 자물쇠에서 허용)' : '브라우저 알림 허용하기'}
        </button>
      )}
      <button className="ghost small" onClick={() => notify('🔔 알림 테스트', '이렇게 알려 준다.', 'good')}>
        알림 테스트
      </button>
    </Panel>
  );
}
