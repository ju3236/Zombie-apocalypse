import { useEffect, useState } from 'react';
import { bus, toast } from '../game/bus';
import { ALBUM_MAX, loadAlbum, saveAlbum, type Photo } from '../game/album';
import { ITEMS } from '../game/data/items';
import { residentsOf } from '../game/homes';
import { store } from '../game/store';
import { BASE_TIERS, basePoints, baseTier, FACILITIES } from '../game/systems/baseLevel';
import { attitude, attitudeLabel, FACTIONS, FACTION_IDS } from '../game/systems/factions';
import { MAX_NPC_PER_BASE } from '../game/systems/npc';
import { currentSeason } from '../game/systems/season';
import { formatTime } from '../game/util';
import { Panel } from './common';

/** 세력과의 관계 */
export function FactionPanel() {
  const s = store.s;
  return (
    <Panel title="🌍 세력" actions={<span className="muted small">사건에서 어떻게 대하느냐에 따라 바뀐다</span>}>
      {FACTION_IDS.map((id) => {
        const f = FACTIONS[id];
        const n = attitude(s, id);
        const lb = attitudeLabel(n);
        return (
          <div key={id} className="faction">
            <div className="row">
              <b>
                {f.icon} {f.name}
              </b>
              <span className={`tag ${lb.kind}`}>
                {lb.text} {n > 0 ? '+' : ''}
                {n}
              </span>
            </div>
            <div className="faction-bar">
              <i style={{ left: '50%', width: `${Math.abs(n) / 2}%`, transform: n < 0 ? 'translateX(-100%)' : undefined }} className={n < 0 ? 'neg' : 'pos'} />
            </div>
            <div className="muted small">{f.desc}</div>
          </div>
        );
      })}
      <div className="muted small">💡 무전 장비·무전 탑이 있으면 세력과 연락이 더 자주 닿는다.</div>
    </Panel>
  );
}

/** 거점 레벨 배지 (누르면 자세히) */
export function BaseTierBadge() {
  const s = store.s;
  const b = s.base;
  const [open, setOpen] = useState(false);
  const t = baseTier(s, b);
  const tier = BASE_TIERS[t];
  const next = BASE_TIERS[t + 1];
  const p = basePoints(s, b);
  const facilities = b.furniture.filter((f) => FACILITIES[f.itemId]);
  const npcs = residentsOf(s, b.id).filter((c) => c.npc).length;
  return (
    <span className="tier-wrap">
      <button className="ghost small tier-badge" onClick={() => setOpen(!open)} title="거점 레벨 · 평판">
        {tier.icon} {tier.name}
      </button>
      {open && (
        <div className="tier-pop">
          <div className="row">
            <b>
              {tier.icon} {b.name} — {tier.name}
            </b>
            <button className="ghost small" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="small">
            점수 {p.total}
            {next ? ` / 다음 단계(${next.icon}${next.name}) ${next.min}` : ' (최고 단계)'}
          </div>
          <div className="progress">
            <div style={{ width: `${next ? Math.min(100, ((p.total - tier.min) / (next.min - tier.min)) * 100) : 100}%` }} />
          </div>
          <div className="muted small">
            가구 {p.furniture} · 특수 시설 {p.facilities} · 주민 {p.people} · 평판 {p.rep}
          </div>
          <div className="small">혜택: {tier.perk}</div>
          <div className="small">NPC 생존자 {npcs}/{MAX_NPC_PER_BASE}</div>
          <div className="small">
            특수 시설:{' '}
            {facilities.length ? facilities.map((f) => `${ITEMS[f.itemId].icon}${ITEMS[f.itemId].name}`).join(', ') : <span className="muted">없음</span>}
          </div>
          <details className="small">
            <summary>특수 시설 목록 (창고 → 제작 → 시설)</summary>
            {Object.entries(FACILITIES).map(([id, f]) => (
              <div key={id}>
                {ITEMS[id].icon} <b>{f.name}</b> — {f.desc}
              </div>
            ))}
          </details>
          <div className="muted small">평판은 습격을 막거나, 생존자를 받아들이거나, 목표를 이루면 오른다.</div>
        </div>
      )}
    </span>
  );
}

/** 계절 행사 배너 */
export function SeasonBanner() {
  const se = currentSeason();
  if (!se) return null;
  return (
    <div className="season-banner" title={se.desc}>
      {se.icon} {se.name} 행사 중
    </div>
  );
}

/** 사진첩 (거점 화면 위 창) */
export function AlbumModal() {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Photo[]>([]);
  const [view, setView] = useState<Photo | null>(null);
  useEffect(
    () =>
      bus.on('openAlbum', () => {
        setList(loadAlbum());
        setOpen(true);
      }),
    [],
  );
  if (!open) return null;
  const update = (l: Photo[]) => {
    saveAlbum(l);
    setList(l);
  };
  return (
    <div className="album-modal" onClick={() => (view ? setView(null) : setOpen(false))}>
      <div className="album-box" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <b>📷 사진첩</b>
          <span className="muted small">
            {list.length}/{ALBUM_MAX} · 이 브라우저에만 저장됩니다
          </span>
          <button className="ghost" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
        {view ? (
          <div className="album-view">
            <img src={view.data} alt={view.caption} />
            <input
              value={view.caption}
              placeholder="한 줄 남기기…"
              onChange={(e) => {
                const v = { ...view, caption: e.target.value };
                setView(v);
                update(list.map((p) => (p.id === v.id ? v : p)));
              }}
            />
            <div className="muted small">
              {view.base} · {formatTime(view.gameT)} · {new Date(view.at).toLocaleString()}
            </div>
            <div className="row">
              <button onClick={() => setView(null)}>◂ 목록</button>
              <a className="btn" href={view.data} download={`피난처_${view.id}.jpg`}>
                내려받기
              </a>
              <button
                className="danger"
                onClick={() => {
                  update(list.filter((p) => p.id !== view.id));
                  setView(null);
                  toast('사진을 지웠다.', 'info');
                }}
              >
                지우기
              </button>
            </div>
          </div>
        ) : list.length === 0 ? (
          <div className="muted">아직 사진이 없다. 거점 화면 오른쪽의 📷 버튼으로 찍어 보자.</div>
        ) : (
          <div className="album-grid">
            {[...list].reverse().map((p) => (
              <button key={p.id} className="album-item" onClick={() => setView(p)}>
                <img src={p.data} alt={p.caption} />
                <span className="small">{p.caption || formatTime(p.gameT)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
