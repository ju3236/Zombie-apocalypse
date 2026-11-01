import { canEdit } from '../game/homes';
import { useState } from 'react';
import { toast } from '../game/bus';
import { CATEGORY_LABEL, ITEMS } from '../game/data/items';
import { sortInventory, totalWeight } from '../game/inventory';
import { sessionStore, store } from '../game/store';
import { consumeFrom } from '../game/systems/character';
import { repairWeapon } from '../game/systems/crafting';
import { equipItem, slotOfItem } from '../game/systems/body';
import type { ItemCategory } from '../game/types';
import { toolStore } from '../phaser/tool';
import { activeCharacter, Panel } from './common';

export function StorageView() {
  const s = store.s;
  const [cat, setCat] = useState<ItemCategory | 'all'>('all');
  const active = activeCharacter();
  const items = sortInventory(s.storage).filter((x) => cat === 'all' || ITEMS[x.itemId].category === cat);
  const cats = Array.from(new Set(s.storage.map((x) => ITEMS[x.itemId].category)));
  const total = s.storage.reduce((n, x) => n + x.qty, 0);
  const editable = canEdit(s, s.base.id, sessionStore.get().player);

  return (
    <Panel title={`📦 ${s.base.name} 창고 — 물품 ${total}개 · ${totalWeight(s.storage)}kg`}>
      <div className="tabs">
        <button className={cat === 'all' ? 'active' : ''} onClick={() => setCat('all')}>
          전체
        </button>
        {cats.map((c) => (
          <button key={c} className={cat === c ? 'active' : ''} onClick={() => setCat(c)}>
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      {!editable && <div className="warn">🔒 다른 사람이 사는 집 창고라 구경만 할 수 있다. 물건이 필요하면 심부름으로 갖다 달라고 하자.</div>}
      <fieldset className="lockable" disabled={!editable}>
      <table className="item-table">
        <thead>
          <tr>
            <th>물품</th>
            <th>수량</th>
            <th>무게</th>
            <th>설명</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((x) => {
            const d = ITEMS[x.itemId];
            const usable = !!(d.consume || d.treat);
            return (
              <tr key={x.uid}>
                <td className={`rarity-${d.rarity ?? 1}`}>
                  <span className="icon">{d.icon}</span> {d.name}
                  {x.durability !== undefined && d.durability && (
                    <div className="progress tiny">
                      <div style={{ width: `${(x.durability / d.durability) * 100}%` }} />
                    </div>
                  )}
                </td>
                <td>{x.qty}</td>
                <td>{Math.round(d.weight * x.qty * 10) / 10}</td>
                <td className="muted small">{d.desc}</td>
                <td className="actions">
                  {usable && active && (active.status === 'base' || active.status === 'down') && (
                    <button
                      className="small"
                      onClick={() => {
                        const msg = consumeFrom(s.storage, active, x.itemId);
                        if (msg) toast(msg);
                        store.commit();
                      }}
                    >
                      {active.name}: 사용
                    </button>
                  )}
                  {slotOfItem(x.itemId) && active?.status === 'base' && (
                    <button
                      className="small"
                      onClick={() => {
                        const err = equipItem(active, 'storage', x.uid);
                        toast(err ?? `${active.name}: ${d.name} 장착`, err ? 'bad' : 'good');
                      }}
                    >
                      {active.name}: 장착
                    </button>
                  )}
                  {d.category === 'furniture' && (
                    <button
                      className="small"
                      onClick={() => {
                        sessionStore.update({ tab: 'main', mainView: 'base' });
                        setTimeout(() => toolStore.set({ kind: 'place', itemId: x.itemId, rot: 0 }), 0);
                      }}
                    >
                      배치하기
                    </button>
                  )}
                  {d.category === 'prop' && (
                    <button
                      className="small"
                      onClick={() => {
                        sessionStore.update({ tab: 'main', mainView: 'base' });
                        setTimeout(() => toolStore.set({ kind: 'prop', propId: x.itemId }), 0);
                      }}
                    >
                      가구 위에 두기
                    </button>
                  )}
                  {x.durability !== undefined && d.durability && x.durability < d.durability && active?.status === 'base' && (
                    <button className="small" onClick={() => toast(repairWeapon(active, x.uid))}>
                      🧻 수리
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </fieldset>
      {items.length === 0 && <div className="muted">비어 있다.</div>}
    </Panel>
  );
}
