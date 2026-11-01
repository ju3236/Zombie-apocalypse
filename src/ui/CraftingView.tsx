import { useEffect, useMemo, useState } from 'react';
import { toast } from '../game/bus';
import { ITEMS } from '../game/data/items';
import { SKILL_LABEL } from '../game/data/jobs';
import { RECIPE_GROUP_LABEL, RECIPES, type Recipe, type RecipeGroup } from '../game/data/recipes';
import { countItem, hasTag } from '../game/inventory';
import { store, useSession } from '../game/store';
import { level } from '../game/systems/character';
import { cancelCraft, checkRecipe, hasStation, RECIPE_BY_ID, startCraft, STATION_NAME, TOOL_NAME } from '../game/systems/crafting';
import type { Character } from '../game/types';
import { myCharacters } from './common';

const FAV_KEY = 'zsb-fav-recipes';
const loadFav = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]');
  } catch {
    return [];
  }
};

type Cat = 'all' | 'fav' | 'can' | RecipeGroup;
const GROUP_ICON: Record<RecipeGroup, string> = { weapon: '⚔', tool: '⚒', medical: '✚', food: '♨', furniture: '▦', building: '▧', facility: '⌂' };

/** 한 번에 만들 수 있는 최대 개수 (재료 기준) */
function maxCraftable(r: Recipe): number {
  const s = store.s;
  let n = 99;
  for (const i of r.inputs) n = Math.min(n, Math.floor(countItem(s.storage, i.itemId) / i.qty));
  return Math.max(0, Math.min(n, 20));
}

function toolOk(t: string, c: Character | null) {
  const s = store.s;
  return hasTag(s.storage, t) || (!!c && (hasTag(c.inventory, t) || (!!c.weapon && !!ITEMS[c.weapon.itemId].tags?.includes(t))));
}

export function CraftingView() {
  const s = store.s;
  const session = useSession();
  // 이 거점에 사는 내 캐릭터만 이 창고로 만들 수 있다
  const mine = myCharacters().filter((c) => c.status === 'base' && c.homeId === s.base.id);
  const [crafterId, setCrafterId] = useState('');
  const crafter = s.characters[crafterId] ?? (session.activeCharacterId && s.characters[session.activeCharacterId]?.status === 'base' ? s.characters[session.activeCharacterId] : mine[0]) ?? null;
  const [cat, setCat] = useState<Cat>('all');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState<string>(RECIPES[0].id);
  const [qty, setQty] = useState(1);
  const [fav, setFav] = useState<string[]>(loadFav);

  const toggleFav = (id: string) => {
    const n = fav.includes(id) ? fav.filter((x) => x !== id) : [...fav, id];
    setFav(n);
    localStorage.setItem(FAV_KEY, JSON.stringify(n));
  };

  const list = useMemo(
    () =>
      RECIPES.filter((r) => {
        if (cat === 'fav' && !fav.includes(r.id)) return false;
        if (cat === 'can' && !checkRecipe(r, crafter).ok) return false;
        if (cat !== 'all' && cat !== 'fav' && cat !== 'can' && r.group !== cat) return false;
        if (q && !r.name.includes(q) && !ITEMS[r.output.itemId].name.includes(q)) return false;
        return true;
      }).sort((a, b) => Number(checkRecipe(b, crafter).ok) - Number(checkRecipe(a, crafter).ok)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cat, q, fav, crafter?.id, store.rev()],
  );
  const r = RECIPES.find((x) => x.id === selId) ?? list[0] ?? RECIPES[0];
  const chk = checkRecipe(r, crafter);
  const max = maxCraftable(r);
  const n = Math.max(1, Math.min(qty, Math.max(1, max)));
  const out = ITEMS[r.output.itemId];

  const cats: [Cat, string, number][] = [
    ['all', '— 전체 —', RECIPES.length],
    ['fav', '★ 즐겨찾기', fav.length],
    ['can', '✔ 지금 가능', RECIPES.filter((x) => checkRecipe(x, crafter).ok).length],
    ...(Object.keys(RECIPE_GROUP_LABEL) as RecipeGroup[]).map((g): [Cat, string, number] => [g, `${GROUP_ICON[g]} ${RECIPE_GROUP_LABEL[g]}`, RECIPES.filter((x) => x.group === g).length]),
  ];

  return (
    <div className="cw">
      <div className="cw-head">
        <span className="cw-title">⚒ 제작대</span>
        <select value={crafter?.id ?? ''} onChange={(e) => setCrafterId(e.target.value)}>
          {mine.length === 0 && <option value="">거점에 있는 내 캐릭터가 없음</option>}
          {mine.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — 제작 {level(c, 'crafting')} · 요리 {level(c, 'cooking')} · 의료 {level(c, 'medical')} · 농업 {level(c, 'farming')}
            </option>
          ))}
        </select>
        <span className="cw-stations">
          {Object.entries(STATION_NAME).map(([k, nm]) => (
            <span key={k} className={`chip ${hasStation(k) ? 'ok' : 'off'}`}>
              {hasStation(k) ? '●' : '○'} {nm}
            </span>
          ))}
        </span>
      </div>

      <div className="cw-body">
        <nav className="cw-cats">
          {cats.map(([id, label, count]) => (
            <button key={id} className={cat === id ? 'active' : ''} onClick={() => setCat(id)}>
              <span>{label}</span>
              <span className="muted small">{count}</span>
            </button>
          ))}
        </nav>

        <section className="cw-list">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="레시피 검색…" />
          <div className="cw-rows">
            {list.map((x) => {
              const ok = checkRecipe(x, crafter).ok;
              const o = ITEMS[x.output.itemId];
              return (
                <button key={x.id} className={`cw-row ${x.id === r.id ? 'sel' : ''} ${ok ? 'ok' : ''}`} onClick={() => (setSelId(x.id), setQty(1))}>
                  <span className="cw-icon">{o.icon}</span>
                  <span className="cw-row-text">
                    <span className="cw-row-name">{x.name}</span>
                    <span className="cw-row-req">
                      {x.inputs.map((i) => (
                        <span key={i.itemId} className={countItem(s.storage, i.itemId) >= i.qty ? 'have' : 'lack'}>
                          {ITEMS[i.itemId].name} {i.qty}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="cw-row-flags">
                    {fav.includes(x.id) && <span className="star">★</span>}
                    {x.station && <span title={STATION_NAME[x.station]}>{hasStation(x.station) ? '▣' : '□'}</span>}
                  </span>
                </button>
              );
            })}
            {list.length === 0 && <div className="muted small cw-empty">해당하는 레시피가 없다.</div>}
          </div>
        </section>

        <section className="cw-detail">
          <div className="cw-d-head">
            <span className="cw-big-icon">{out.icon}</span>
            <div>
              <div className="cw-d-name">{r.name}</div>
              <div className="muted small">
                {RECIPE_GROUP_LABEL[r.group]} · {SKILL_LABEL[r.skill]} Lv.{r.level}
              </div>
            </div>
            <button className={`ghost star-btn ${fav.includes(r.id) ? 'on' : ''}`} onClick={() => toggleFav(r.id)} title="즐겨찾기">
              {fav.includes(r.id) ? '★' : '☆'}
            </button>
          </div>
          <p className="muted small cw-desc">{out.desc}</p>

          <div className="cw-box">
            <div className="cw-box-title">필수 아이템</div>
            <div className="cw-slots">
              {r.inputs.map((i) => {
                const have = countItem(s.storage, i.itemId);
                const need = i.qty * n;
                return (
                  <div key={i.itemId} className={`cw-slot ${have >= need ? 'ok' : 'lack'}`} title={ITEMS[i.itemId].desc}>
                    <span className="cw-slot-icon">{ITEMS[i.itemId].icon}</span>
                    <span className="cw-slot-count">
                      {have}/{need}
                    </span>
                    <span className="cw-slot-name">{ITEMS[i.itemId].name}</span>
                  </div>
                );
              })}
              {(r.tools ?? []).map((t) => (
                <div key={t} className={`cw-slot tool ${toolOk(t, crafter) ? 'ok' : 'lack'}`} title="소모되지 않는 도구">
                  <span className="cw-slot-icon">⚒</span>
                  <span className="cw-slot-count">{toolOk(t, crafter) ? '보유' : '없음'}</span>
                  <span className="cw-slot-name">{TOOL_NAME[t] ?? t}</span>
                </div>
              ))}
              {r.station && (
                <div className={`cw-slot tool ${hasStation(r.station) ? 'ok' : 'lack'}`} title="거점에 배치되어 있어야 하는 시설">
                  <span className="cw-slot-icon">▣</span>
                  <span className="cw-slot-count">{hasStation(r.station) ? '있음' : '없음'}</span>
                  <span className="cw-slot-name">{STATION_NAME[r.station]}</span>
                </div>
              )}
            </div>
          </div>

          <div className="cw-box">
            <div className="cw-box-title">출력</div>
            <div className="cw-slots">
              <div className="cw-slot out">
                <span className="cw-slot-icon">{out.icon}</span>
                <span className="cw-slot-count">{r.output.qty * n}</span>
                <span className="cw-slot-name">{out.name}</span>
              </div>
            </div>
          </div>

          {!chk.ok && <div className="cw-missing small">{chk.missing.join(' · ')}</div>}

          {crafter?.crafting && <CraftJob c={crafter} />}
          <div className="cw-craft">
            <div className="cw-qty">
              <span className="muted small">수량</span>
              <input type="range" min={1} max={Math.max(1, max)} value={n} disabled={max <= 1} onChange={(e) => setQty(Number(e.target.value))} />
              <b>{n}</b>
              <span className="muted small">/ {max}</span>
            </div>
            <button
              className="primary big"
              disabled={!chk.ok}
              onClick={() => {
                if (!crafter) return;
                const err = startCraft(r, crafter, n);
                toast(err ?? `${out.name} x${r.output.qty * n} 완성!`, err ? 'bad' : 'good');
                setQty(1);
              }}
            >
              제작
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

/** 진행 중인 제작: 진행 막대와 그만두기 */
export function CraftJob({ c, compact }: { c: Character; compact?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, []);
  const job = c.crafting;
  if (!job) return null;
  const r = RECIPE_BY_ID[job.recipeId];
  if (!r) return null;
  const out = ITEMS[r.output.itemId];
  const pct = Math.min(100, Math.max(0, ((now - job.itemStart) / Math.max(1, job.itemEnd - job.itemStart)) * 100));
  const left = Math.max(0, Math.ceil((job.itemEnd - now) / 1000));
  const mm = Math.floor(left / 60);
  const ss = left % 60;
  return (
    <div className={`craft-job ${compact ? 'compact' : ''}`}>
      <div className="row item-row">
        <span>
          🔨 {out.icon} {out.name} {job.done + 1}/{job.total}
        </span>
        <span className="muted small">
          {mm}:{ss.toString().padStart(2, '0')}
        </span>
      </div>
      <div className="travel-bar">
        <div className="travel-fill" style={{ width: `${pct}%` }} />
      </div>
      <button className="ghost small" onClick={() => cancelCraft(c)}>
        그만두기
      </button>
    </div>
  );
}
