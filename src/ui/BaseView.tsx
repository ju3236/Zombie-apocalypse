import { useEffect } from 'react';
import { bus, toast } from '../game/bus';
import { FLOORS, WALLS } from '../game/data/furniture';
import { ITEMS } from '../game/data/items';
import { sessionStore, store, useSession } from '../game/store';
import { canEdit, residentsOf } from '../game/homes';
import { myCharacters } from './common';
import { canAfford, canExpand, collectProduction, EXPAND_COST, expandBase } from '../game/systems/base';
import { PhaserBase } from '../phaser/PhaserBase';
import { toolStore, useTool } from '../phaser/tool';
import { ContainerWindow } from './ContainerWindow';
import { AlbumModal, BaseTierBadge, PowerBadge } from './World';

export function BaseView({ visible }: { visible: boolean }) {
  useEffect(() => {
    if (!visible) toolStore.set({ kind: 'view' });
  }, [visible]);

  return (
    <div className="base-view" style={{ display: visible ? undefined : 'none' }}>
      <BaseToolbar />
      <div className="canvas-wrap">
        <PhaserBase visible={visible} />
        <div className="vignette" />
        <div className="zoom-btns">
          <button onClick={() => bus.emit('zoom', { dir: 1 })} title="확대">
            +
          </button>
          <button onClick={() => bus.emit('zoom', { dir: -1 })} title="축소">
            −
          </button>
          <button
            title="사진 찍기"
            onClick={() => {
              const cap = prompt('사진에 남길 한 줄 (비워도 됨)', '');
              if (cap === null) return;
              bus.emit('snapshot', { caption: cap.trim() });
            }}
          >
            📷
          </button>
          <button title="사진첩" onClick={() => bus.emit('openAlbum', {})}>
            🖼️
          </button>
        </div>
        <ContainerWindow />
        <AlbumModal />
      </div>
      <ToolHint />
    </div>
  );
}

function ToolHint() {
  const tool = useTool();
  const txt: Record<string, string> = {
    view: '클릭: 조종 캐릭터 이동 · 가구 클릭: 정보/사용 · 캐릭터 클릭: 상호작용',
    place: '클릭: 배치 · R/우클릭: 회전 · Esc: 취소',
    move: '클릭: 새 위치에 놓기 · R/우클릭: 회전 · Esc: 취소',
    build: '클릭/드래그: 건설 (재료 소모) · Esc: 취소',
    demolish: '클릭/드래그: 철거 (재료를 모두 돌려받는다) · Esc: 취소',
    moveBuild: tool.kind === 'moveBuild' && tool.picked ? '옮길 자리를 클릭 (이미 있으면 서로 바뀐다) · Esc: 취소' : '옮길 벽·바닥을 클릭해서 집기 · Esc: 취소',
    prop: '소품을 올릴 가구(책상/선반/식탁/작업대/상자)를 클릭',
  };
  return <div className="tool-hint">{txt[tool.kind]}</div>;
}

function BaseToolbar() {
  const tool = useTool();
  const s = store.s;
  const session = useSession();
  const editable = canEdit(s, s.base.id, session.player);
  // 남의 집으로 넘어가면 도구를 내려놓는다
  useEffect(() => {
    if (!editable && toolStore.get().kind !== 'view') toolStore.set({ kind: 'view' });
  }, [editable]);
  const furnitureInStorage = s.storage.filter((x) => ITEMS[x.itemId]?.category === 'furniture');
  const propsInStorage = s.storage.filter((x) => ITEMS[x.itemId]?.category === 'prop');
  const harvestable = s.base.furniture.filter((f) => (f.prod?.stored ?? 0) > 0);

  const sel = (v: string) => {
    if (!v) return toolStore.set({ kind: 'view' });
    const [k, id] = v.split(':');
    if (k === 'place') toolStore.set({ kind: 'place', itemId: id, rot: 0 });
    if (k === 'build') toolStore.set({ kind: 'build', buildId: id });
    if (k === 'demolish') toolStore.set({ kind: 'demolish', what: id as 'wall' | 'floor' });
    if (k === 'moveBuild') toolStore.set({ kind: 'moveBuild', what: id as 'wall' | 'floor' });
    if (k === 'prop') toolStore.set({ kind: 'prop', propId: id });
  };
  const value =
    tool.kind === 'place' ? `place:${tool.itemId}` : tool.kind === 'build' ? `build:${tool.buildId}` : tool.kind === 'demolish' ? `demolish:${tool.what}` : tool.kind === 'moveBuild' ? `moveBuild:${tool.what}` : tool.kind === 'prop' ? `prop:${tool.propId}` : '';
  const cost = (c: { itemId: string; qty: number }[]) => c.map((x) => `${ITEMS[x.itemId].name}${x.qty}`).join('+');

  if (!editable)
    return (
      <div className="toolbar">
        <BasePicker />
        <span className="muted small lock-note">🔒 다른 사람이 사는 집이라 구경만 할 수 있다 (가구·창고·건축 잠김)</span>
      </div>
    );
  return (
    <div className="toolbar">
      <BasePicker />
      <button className={tool.kind === 'view' ? 'active' : ''} onClick={() => toolStore.set({ kind: 'view' })}>
        👆 보기
      </button>
      <select value={value.startsWith('place') ? value : ''} onChange={(e) => sel(e.target.value)}>
        <option value="">🪑 가구 배치 ({furnitureInStorage.reduce((n, x) => n + x.qty, 0)})</option>
        {furnitureInStorage.map((x) => (
          <option key={x.uid} value={`place:${x.itemId}`}>
            {ITEMS[x.itemId].icon} {ITEMS[x.itemId].name} x{x.qty}
          </option>
        ))}
      </select>
      <select value={value.startsWith('prop') ? value : ''} onChange={(e) => sel(e.target.value)}>
        <option value="">🧸 소품 올리기 ({propsInStorage.reduce((n, x) => n + x.qty, 0)})</option>
        {propsInStorage.map((x) => (
          <option key={x.uid} value={`prop:${x.itemId}`}>
            {ITEMS[x.itemId].icon} {ITEMS[x.itemId].name} x{x.qty}
          </option>
        ))}
      </select>
      <select value={value.startsWith('build') || value.startsWith('demolish') || value.startsWith('moveBuild') ? value : ''} onChange={(e) => sel(e.target.value)}>
        <option value="">🧱 건축 / 꾸미기</option>
        <optgroup label="벽 · 문 · 창문 (벽지 교체 포함)">
          {WALLS.map((w) => (
            <option key={w.id} value={`build:${w.id}`} disabled={!canAfford(w.cost)}>
              {w.name} — {cost(w.cost)}
            </option>
          ))}
        </optgroup>
        <optgroup label="바닥재">
          {FLOORS.map((w) => (
            <option key={w.id} value={`build:${w.id}`} disabled={!canAfford(w.cost)}>
              {w.name} — {cost(w.cost)}
            </option>
          ))}
        </optgroup>
        <optgroup label="옮기기 (재료 그대로)">
          <option value="moveBuild:wall">벽/문/창문 옮기기</option>
          <option value="moveBuild:floor">바닥 옮기기</option>
        </optgroup>
        <optgroup label="철거 (재료를 모두 돌려받음)">
          <option value="demolish:wall">벽/문/창문 철거</option>
          <option value="demolish:floor">바닥 걷어내기</option>
        </optgroup>
      </select>
      <button onClick={() => bus.emit('openContainer', { uid: null })} title="공동 창고와 보관함 사이에서 물건을 정리">
        📦 창고 · 보관함
      </button>
      <button
        disabled={!harvestable.length}
        onClick={() => {
          let n = 0;
          for (const f of harvestable) n += collectProduction(f.uid, false);
          store.commit();
          toast(`수확한 물자 ${n}개를 창고에 넣었다.`, 'good');
        }}
      >
        🧺 모두 수확 {harvestable.length ? `(${harvestable.length})` : ''}
      </button>
      <button
        disabled={!canExpand()}
        title={`부지 확장: ${cost(EXPAND_COST)}`}
        onClick={() => {
          const err = expandBase();
          toast(err ?? '거점 부지를 넓혔다!', err ? 'bad' : 'good');
        }}
      >
        📐 부지 확장
      </button>
      {(tool.kind === 'place' || tool.kind === 'move') && (
        <button onClick={() => toolStore.set({ ...tool, rot: ((tool.rot + 1) % 4) as 0 | 1 | 2 | 3 })}>↻ 회전</button>
      )}
    </div>
  );
}


/** 어느 거점을 볼지 + 거점 이름 바꾸기 */
function BasePicker() {
  const s = store.s;
  const cur = s.base;
  const session = useSession();
  return (
    <span className="base-picker">
      <select
        value={cur.id}
        onChange={(e) => {
          const id = e.target.value;
          // 내 캐릭터가 사는 곳이면 그 캐릭터를 조종
          const mine = myCharacters().find((c) => c.homeId === id && c.status !== 'dead');
          const active = session.activeCharacterId ? s.characters[session.activeCharacterId] : undefined;
          sessionStore.update(mine && active?.homeId !== id ? { viewBaseId: id, activeCharacterId: mine.id } : { viewBaseId: id });
        }}
        title="다른 거점 보기"
      >
        {Object.values(s.bases).map((b) => {
          const who = residentsOf(s, b.id);
          return (
            <option key={b.id} value={b.id}>
              ⌂ {b.name}
              {who.length ? ` (${who.map((c) => c.name).join(', ')})` : ''}
            </option>
          );
        })}
      </select>
      <button
        className="ghost small"
        title="거점 이름 바꾸기"
        onClick={() => {
          const n = prompt('거점 이름', cur.name);
          if (n && n.trim()) {
            cur.name = n.trim();
            store.commit();
          }
        }}
      >
        ✏️
      </button>
      <BaseTierBadge />
      <PowerBadge />
    </span>
  );
}
