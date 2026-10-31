import { useState } from 'react';
import { toast } from '../game/bus';
import { ITEMS } from '../game/data/items';
import { SKILL_LABEL } from '../game/data/jobs';
import { RECIPE_GROUP_LABEL, RECIPES, type RecipeGroup } from '../game/data/recipes';
import { countItem } from '../game/inventory';
import { store, useSession } from '../game/store';
import { level } from '../game/systems/character';
import { checkRecipe, craft, craftTime, hasStation, STATION_NAME, TOOL_NAME } from '../game/systems/crafting';
import { formatDuration } from '../game/util';
import { ItemName, myCharacters, Panel } from './common';

export function CraftingView() {
  const s = store.s;
  const session = useSession();
  const mine = myCharacters().filter((c) => c.status === 'base');
  const [crafterId, setCrafterId] = useState('');
  const [group, setGroup] = useState<RecipeGroup | 'all' | 'can'>('all');
  const crafter = s.characters[crafterId] ?? s.characters[session.activeCharacterId ?? ''] ?? mine[0] ?? null;
  const usable = crafter && crafter.status === 'base' ? crafter : null;

  const recipes = RECIPES.filter((r) => (group === 'all' ? true : group === 'can' ? checkRecipe(r, usable).ok : r.group === group));

  return (
    <div className="crafting">
      <Panel title="🛠️ 제작">
        <div className="row wrap">
          <label className="field inline">
            제작자
            <select value={usable?.id ?? ''} onChange={(e) => setCrafterId(e.target.value)}>
              {mine.length === 0 && <option value="">거점에 있는 내 캐릭터가 없음</option>}
              {mine.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (제작 Lv.{level(c, 'crafting')} / 요리 Lv.{level(c, 'cooking')} / 의료 Lv.{level(c, 'medical')})
                </option>
              ))}
            </select>
          </label>
          <span className="stations">
            {Object.entries(STATION_NAME).map(([k, n]) => (
              <span key={k} className={`chip ${hasStation(k) ? 'ok' : 'off'}`}>
                {hasStation(k) ? '✔' : '✖'} {n}
              </span>
            ))}
          </span>
        </div>
        <div className="tabs">
          <button className={group === 'all' ? 'active' : ''} onClick={() => setGroup('all')}>
            전체
          </button>
          <button className={group === 'can' ? 'active' : ''} onClick={() => setGroup('can')}>
            지금 제작 가능
          </button>
          {(Object.keys(RECIPE_GROUP_LABEL) as RecipeGroup[]).map((g) => (
            <button key={g} className={group === g ? 'active' : ''} onClick={() => setGroup(g)}>
              {RECIPE_GROUP_LABEL[g]}
            </button>
          ))}
        </div>
      </Panel>
      <div className="recipe-grid">
        {recipes.map((r) => {
          const chk = checkRecipe(r, usable);
          return (
            <div key={r.id} className={`recipe ${chk.ok ? 'ok' : ''}`}>
              <div className="recipe-head">
                <ItemName id={r.output.itemId} qty={r.output.qty} />
                <span className="muted small">{RECIPE_GROUP_LABEL[r.group]}</span>
              </div>
              <div className="small muted">{ITEMS[r.output.itemId].desc}</div>
              <div className="recipe-inputs">
                {r.inputs.map((i) => {
                  const have = countItem(s.storage, i.itemId);
                  return (
                    <span key={i.itemId} className={`chip ${have >= i.qty ? 'ok' : 'bad'}`}>
                      {ITEMS[i.itemId].icon} {ITEMS[i.itemId].name} {have}/{i.qty}
                    </span>
                  );
                })}
              </div>
              <div className="small">
                {r.tools?.length ? <>도구: {r.tools.map((t) => TOOL_NAME[t] ?? t).join(', ')} · </> : null}
                {r.station ? <>시설: {STATION_NAME[r.station]} · </> : null}
                {SKILL_LABEL[r.skill]} Lv.{r.level} · {usable ? formatDuration(craftTime(r, usable)) : formatDuration(r.minutes)}
              </div>
              {!chk.ok && <div className="small bad-text">{chk.missing.join(' / ')}</div>}
              <div className="row">
                <button className="primary" disabled={!chk.ok} onClick={() => usable && toast(craft(r, usable), 'good')}>
                  제작
                </button>
                <button disabled={!chk.ok} onClick={() => usable && toast(craft(r, usable, 5), 'good')}>
                  x5
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
