import { useEffect } from 'react';
import { toast } from '../game/bus';
import { FLOORS, WALLS } from '../game/data/furniture';
import { ITEMS } from '../game/data/items';
import { store } from '../game/store';
import { canAfford, canExpand, collectProduction, EXPAND_COST, expandBase } from '../game/systems/base';
import { PhaserBase } from '../phaser/PhaserBase';
import { toolStore, useTool } from '../phaser/tool';

export function BaseView({ visible }: { visible: boolean }) {
  useEffect(() => {
    if (!visible) toolStore.set({ kind: 'view' });
  }, [visible]);

  return (
    <div className="base-view" style={{ display: visible ? undefined : 'none' }}>
      <BaseToolbar />
      <div className="canvas-wrap">
        <PhaserBase />
        <div className="vignette" />
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
    demolish: '클릭/드래그: 철거 (벽은 재료 절반 회수) · Esc: 취소',
    prop: '소품을 올릴 가구(책상/선반/식탁/작업대/상자)를 클릭',
  };
  return <div className="tool-hint">{txt[tool.kind]}</div>;
}

function BaseToolbar() {
  const tool = useTool();
  const s = store.s;
  const furnitureInStorage = s.storage.filter((x) => ITEMS[x.itemId]?.category === 'furniture');
  const propsInStorage = s.storage.filter((x) => ITEMS[x.itemId]?.category === 'prop');
  const harvestable = s.base.furniture.filter((f) => (f.prod?.stored ?? 0) > 0);

  const sel = (v: string) => {
    if (!v) return toolStore.set({ kind: 'view' });
    const [k, id] = v.split(':');
    if (k === 'place') toolStore.set({ kind: 'place', itemId: id, rot: 0 });
    if (k === 'build') toolStore.set({ kind: 'build', buildId: id });
    if (k === 'demolish') toolStore.set({ kind: 'demolish', what: id as 'wall' | 'floor' });
    if (k === 'prop') toolStore.set({ kind: 'prop', propId: id });
  };
  const value =
    tool.kind === 'place' ? `place:${tool.itemId}` : tool.kind === 'build' ? `build:${tool.buildId}` : tool.kind === 'demolish' ? `demolish:${tool.what}` : tool.kind === 'prop' ? `prop:${tool.propId}` : '';
  const cost = (c: { itemId: string; qty: number }[]) => c.map((x) => `${ITEMS[x.itemId].name}${x.qty}`).join('+');

  return (
    <div className="toolbar">
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
      <select value={value.startsWith('build') || value.startsWith('demolish') ? value : ''} onChange={(e) => sel(e.target.value)}>
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
        <optgroup label="철거">
          <option value="demolish:wall">벽/문/창문 철거</option>
          <option value="demolish:floor">바닥 걷어내기</option>
        </optgroup>
      </select>
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

