import { toast } from '../game/bus';
import { adapter, sessionStore, store, useSession } from '../game/store';
import { exportSave, readSaveFile } from '../game/persistence';
import { Panel } from './common';

export function SettingsView() {
  const s = store.s;
  const session = useSession();

  return (
    <div className="settings">
      <Panel title="월드">
        <label className="field">
          월드 이름
          <input value={s.worldName} onChange={(e) => ((s.worldName = e.target.value), store.commit())} />
        </label>
        <label className="check">
          <input type="checkbox" checked={s.settings.autoConsume} onChange={(e) => ((s.settings.autoConsume = e.target.checked), store.commit())} />
          거점에 있는 캐릭터는 배고프거나 목마르면 창고에서 알아서 먹고 마신다
        </label>
        <div className="muted small">
          접속하지 않는 동안에는 시간이 흐르지 않아 아무도 굶거나 다치지 않는다. 빗물 수집통과 텃밭 같은 안전한 생산 시설만 실제 시간에 따라 작동한다.
        </div>
      </Panel>
      <Panel title="플레이어">
        <div>
          현재 플레이어: <b>{session.player}</b>
        </div>
        <div className="muted small">참가한 플레이어: {s.players.join(', ')}</div>
        <button onClick={() => sessionStore.update({ player: '', activeCharacterId: null })}>플레이어 전환</button>
      </Panel>
      <Panel title="저장">
        <div className="muted small">
          저장 방식: {adapter.name} (자동 저장). 2인 실시간 동기화는 다음 단계에서 Firebase 어댑터로 연결된다. 그 전까지는 세이브 파일을 주고받아 같은 월드를
          이어서 플레이할 수 있다.
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
            sessionStore.update({ activeCharacterId: null, tab: 'base' });
            store.set(null);
          }}
        >
          월드 초기화
        </button>
      </Panel>
    </div>
  );
}
