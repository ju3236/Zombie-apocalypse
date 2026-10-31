import { useState } from 'react';
import { createWorld } from '../game/newGame';
import { readSaveFile } from '../game/persistence';
import { sessionStore, store } from '../game/store';

/** 첫 실행: 월드 만들기 / 세이브 불러오기 */
export function Setup() {
  const [world, setWorld] = useState('우리들의 피난처');
  const [player, setPlayer] = useState('');
  const [err, setErr] = useState('');

  const start = () => {
    if (!player.trim()) return setErr('플레이어(오너) 이름을 입력해 주세요.');
    store.set(createWorld(world.trim() || '이름 없는 피난처', player.trim()));
    sessionStore.update({ player: player.trim(), activeCharacterId: null, tab: 'characters', viewCharId: '__new__' });
  };

  const load = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = await readSaveFile(f);
      store.set(data);
      sessionStore.update({ player: '', activeCharacterId: null, tab: 'main', mainView: 'base' });
    } catch (e) {
      setErr(String((e as Error).message));
    }
  };

  return (
    <div className="setup">
      <div className="setup-card">
        <h1>🧟 끝나지 않는 피난처</h1>
        <p className="sub">엔딩 없는 2인용 좀비 아포칼립스 생존 샌드박스</p>
        <label>
          월드 이름
          <input value={world} onChange={(e) => setWorld(e.target.value)} />
        </label>
        <label>
          내 플레이어(오너) 이름
          <input value={player} onChange={(e) => setPlayer(e.target.value)} placeholder="예: 민지" autoFocus />
        </label>
        {err && <div className="error">{err}</div>}
        <button className="primary big" onClick={start}>
          새 월드 시작
        </button>
        <div className="divider">또는</div>
        <label className="file-btn">
          세이브 파일 불러오기
          <input type="file" accept="application/json" onChange={(e) => void load(e.target.files?.[0])} />
        </label>
      </div>
    </div>
  );
}

/** 월드는 있는데 이 브라우저의 플레이어가 정해지지 않았을 때 */
export function PlayerSelect() {
  const s = store.s;
  const [name, setName] = useState('');
  const choose = (n: string) => {
    const v = n.trim();
    if (!v) return;
    if (!s.players.includes(v)) {
      s.players.push(v);
      store.commit();
    }
    const mine = s.characterOrder.find((id) => s.characters[id]?.owner === v) ?? null;
    sessionStore.update({ player: v, activeCharacterId: mine, tab: mine ? 'main' : 'characters', viewCharId: mine ? null : '__new__' });
  };
  return (
    <div className="setup">
      <div className="setup-card">
        <h1>{s.worldName}</h1>
        <p className="sub">누구로 플레이하나요?</p>
        <div className="player-list">
          {s.players.map((p) => (
            <button key={p} className="primary" onClick={() => choose(p)}>
              {p}
            </button>
          ))}
        </div>
        {s.players.length < 2 && (
          <>
            <div className="divider">새 플레이어로 참가</div>
            <div className="row">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="플레이어 이름" />
              <button onClick={() => choose(name)}>참가</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
