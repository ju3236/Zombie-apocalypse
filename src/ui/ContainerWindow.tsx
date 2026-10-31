import { useEffect, useState } from 'react';
import { bus, toast } from '../game/bus';
import { FURNITURE } from '../game/data/furniture';
import { CATEGORY_LABEL, ITEMS } from '../game/data/items';
import { sortInventory, totalWeight } from '../game/inventory';
import { store, useSession } from '../game/store';
import { capacityOf, invOf, transfer, type InvRef } from '../game/systems/base';
import type { ItemCategory, ItemStack } from '../game/types';

/** 거점 보관 창: 왼쪽(공동 창고 / 소지품) ↔ 오른쪽(보관함) */
export function ContainerWindow() {
  const s = store.s;
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<string | null>(null);
  const [left, setLeft] = useState<'storage' | 'char'>('storage');

  useEffect(
    () =>
      bus.on('openContainer', ({ uid }) => {
        setOpen(true);
        if (uid) setBox(uid);
      }),
    [],
  );

  if (!open) return null;
  const boxes = s.base.furniture.filter((f) => FURNITURE[f.itemId]?.container);
  const boxUid = box && boxes.some((b) => b.uid === box) ? box : (boxes[0]?.uid ?? null);
  const me = session.activeCharacterId ? s.characters[session.activeCharacterId] : null;
  const canUseChar = !!me && (me.status === 'base' || me.status === 'down');
  const leftRef: InvRef = left === 'char' && canUseChar && me ? { kind: 'char', id: me.id } : { kind: 'storage' };
  const rightRef: InvRef | null = boxUid ? { kind: 'box', uid: boxUid } : null;
  const boxName = (uid: string) => {
    const f = s.base.furniture.find((x) => x.uid === uid)!;
    const owner = f.ownerId ? s.characters[f.ownerId]?.name : null;
    return `${ITEMS[f.itemId].name}${owner ? ` (${owner})` : ''} · ${f.x},${f.y}`;
  };

  const move = (from: InvRef, to: InvRef | null, st: ItemStack, all: boolean) => {
    if (!to) return;
    const err = transfer(from, to, st.uid, all ? undefined : 1);
    if (err) toast(err, 'bad');
  };
  const moveAll = (from: InvRef, to: InvRef | null) => {
    if (!to) return;
    const inv = invOf(from) ?? [];
    for (const st of [...inv]) if (transfer(from, to, st.uid)) break;
  };

  return (
    <div className="cwin">
      <div className="cwin-head">
        <b>📦 보관</b>
        <span className="muted small">클릭: 1개 이동 · ⇉: 묶음 전체 이동</span>
        <button className="ghost" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>
      <div className="cwin-body">
        <Pane
          title={
            <div className="seg sub mini">
              <button className={leftRef.kind === 'storage' ? 'active' : ''} onClick={() => setLeft('storage')}>
                공동 창고
              </button>
              <button className={leftRef.kind === 'char' ? 'active' : ''} disabled={!canUseChar} onClick={() => setLeft('char')}>
                {me ? `${me.name} 소지품` : '소지품'}
              </button>
            </div>
          }
          inv={invOf(leftRef) ?? []}
          cap={capacityOf(leftRef)}
          arrow="▶"
          onItem={(st, all) => move(leftRef, rightRef, st, all)}
          onAll={() => moveAll(leftRef, rightRef)}
          disabled={!rightRef}
        />
        <Pane
          title={
            boxes.length ? (
              <select value={boxUid ?? ''} onChange={(e) => setBox(e.target.value)}>
                {boxes.map((b) => (
                  <option key={b.uid} value={b.uid}>
                    {boxName(b.uid)}
                  </option>
                ))}
              </select>
            ) : (
              <span className="muted small">보관함 가구가 없다 (수납 상자·옷장·서랍장·책장 등)</span>
            )
          }
          inv={rightRef ? (invOf(rightRef) ?? []) : []}
          cap={rightRef ? capacityOf(rightRef) : 0}
          arrow="◀"
          onItem={(st, all) => rightRef && move(rightRef, leftRef, st, all)}
          onAll={() => rightRef && moveAll(rightRef, leftRef)}
          disabled={!rightRef}
        />
      </div>
      <div className="cwin-foot muted small">보관함에 넣은 물건은 공용으로 쓰이지 않습니다. 비상식량·개인 물건·수집품을 따로 보관할 때 쓰세요.</div>
    </div>
  );
}

function Pane({
  title,
  inv,
  cap,
  arrow,
  onItem,
  onAll,
  disabled,
}: {
  title: React.ReactNode;
  inv: ItemStack[];
  cap: number;
  arrow: string;
  onItem: (st: ItemStack, all: boolean) => void;
  onAll: () => void;
  disabled: boolean;
}) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<ItemCategory | ''>('');
  const w = totalWeight(inv);
  const list = sortInventory(inv).filter((x) => (!cat || ITEMS[x.itemId].category === cat) && (!q || ITEMS[x.itemId].name.includes(q)));
  const cats = Array.from(new Set(inv.map((x) => ITEMS[x.itemId].category)));
  return (
    <div className="cpane">
      <div className="cpane-title">{title}</div>
      <div className="row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="검색" />
        <select value={cat} onChange={(e) => setCat(e.target.value as ItemCategory | '')}>
          <option value="">전체</option>
          {cats.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>
      <div className="cpane-list">
        {list.map((st) => {
          const d = ITEMS[st.itemId];
          return (
            <div key={st.uid} className="crow" onClick={() => !disabled && onItem(st, false)} title={d.desc}>
              <span className="icon">{d.icon}</span>
              <span className={`crow-name rarity-${d.rarity ?? 1}`}>
                {d.name}
                {st.durability !== undefined && d.durability ? <span className="muted"> {Math.round((st.durability / d.durability) * 100)}%</span> : null}
              </span>
              <span className="crow-qty">{st.qty}</span>
              <span className="crow-w muted">{Math.round(d.weight * st.qty * 10) / 10}</span>
              <button
                className="small ghost"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  onItem(st, true);
                }}
              >
                ⇉
              </button>
            </div>
          );
        })}
        {list.length === 0 && <div className="muted small cpane-empty">비어 있음</div>}
      </div>
      <div className="cpane-foot">
        <span className="muted small">
          {w}kg{Number.isFinite(cap) ? ` / ${cap}kg` : ''}
        </span>
        {Number.isFinite(cap) && (
          <div className="progress tiny" style={{ flex: 1 }}>
            <div style={{ width: `${Math.min(100, (w / cap) * 100)}%` }} />
          </div>
        )}
        <button className="small" disabled={disabled || !inv.length} onClick={onAll}>
          모두 {arrow}
        </button>
      </div>
    </div>
  );
}
