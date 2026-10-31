import { travelMinutes } from '../game/systems/expedition';
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { LOCATIONS, type LocationDef } from '../game/data/locations';
import { store } from '../game/store';
import { CENTERS, CITY, MAP_H, MAP_W, Tile } from '../game/world/cityGen';
import { DISTRICT_BY_ID, DISTRICTS } from '../game/world/districts';
import { Avatar } from './common';

// ───────────── 지도 이미지 (한 번만 그린다) ─────────────
const TILE_COLOR: Record<number, number> = {
  [Tile.Land]: 0x9d9779,
  [Tile.Forest]: 0x5f6a46,
  [Tile.Water]: 0x2d6468,
  [Tile.DeepWater]: 0x24555a,
  [Tile.Road]: 0x625e56,
  [Tile.Highway]: 0x524e47,
  [Tile.Park]: 0x7f8c58,
  [Tile.FieldA]: 0x8c8c56,
  [Tile.FieldB]: 0x7c7a4a,
  [Tile.Parking]: 0x7c796f,
  [Tile.Rail]: 0x3e3730,
  [Tile.Sand]: 0xb3a57e,
  [Tile.Trail]: 0x7d6545,
  [Tile.Plaza]: 0x8e8a7d,
};

let cachedImage: HTMLCanvasElement | null = null;
function cityImage(): HTMLCanvasElement {
  if (cachedImage) return cachedImage;
  const cv = document.createElement('canvas');
  cv.width = MAP_W;
  cv.height = MAP_H;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(MAP_W, MAP_H);
  const b = CITY.base;
  for (let i = 0; i < MAP_W * MAP_H; i++) {
    const t = CITY.tiles[i];
    let c = TILE_COLOR[t] ?? 0x9d9779;
    if (t === Tile.Building) {
      const d = DISTRICT_BY_ID[CITY.district[i]];
      const f = 0.86 + CITY.shade[i] * 0.07;
      const base = d?.roof ?? 0xa8643a;
      c = (Math.min(255, ((base >> 16) & 255) * f) << 16) | (Math.min(255, ((base >> 8) & 255) * f) << 8) | Math.min(255, (base & 255) * f);
      const x = i % MAP_W;
      const y = Math.floor(i / MAP_W);
      if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) c = 0xe8c06a;
    }
    img.data[i * 4] = (c >> 16) & 255;
    img.data[i * 4 + 1] = (c >> 8) & 255;
    img.data[i * 4 + 2] = c & 255;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  cachedImage = cv;
  return cv;
}

// ───────────── 지도 컴포넌트 ─────────────
const MIN_Z = 1.5;
const MAX_Z = 9;

interface Props {
  selected: string | null;
  onSelect: (id: string) => void;
  compact?: boolean;
  focus?: string | null; // 이 장소로 화면을 옮긴다
}

export function CityMap({ selected, onSelect, compact, focus }: Props) {
  const s = store.s;
  const vp = useRef<HTMLDivElement>(null);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(compact ? 3.4 : 2.4);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [hover, setHover] = useState<string | null>(null);
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  // 캔버스에 도시 이미지
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    cv.getContext('2d')!.drawImage(cityImage(), 0, 0);
  }, []);

  const centerOn = (p: { x: number; y: number }, z = zoom) => {
    const el = vp.current;
    if (!el) return;
    setOff({ x: el.clientWidth / 2 - p.x * z, y: el.clientHeight / 2 - p.y * z });
  };
  const basePos = { x: CITY.base.x + CITY.base.w / 2, y: CITY.base.y + CITY.base.h / 2 };

  // 처음엔 거점(또는 포커스 장소) 중심
  useEffect(() => {
    const f = focus ? LOCATIONS.find((l) => l.id === focus) : null;
    centerOn(f ? f.pos : basePos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, compact]);

  const zoomAt = (nz: number, cx: number, cy: number) => {
    const z2 = Math.min(MAX_Z, Math.max(MIN_Z, nz));
    // 커서 아래 지점이 고정되도록
    const wx = (cx - off.x) / zoom;
    const wy = (cy - off.y) / zoom;
    setZoom(z2);
    setOff({ x: cx - wx * z2, y: cy - wy * z2 });
  };

  useEffect(() => {
    const el = vp.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(zoom * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const onDown = (e: RPointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { sx: e.clientX, sy: e.clientY, ox: off.x, oy: off.y, moved: false };
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) > 4) {
      d.moved = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (d.moved) setOff({ x: d.ox + dx, y: d.oy + dy });
  };
  const onUp = () => {
    setTimeout(() => (drag.current = null), 0);
  };
  const click = (id: string) => {
    if (drag.current?.moved) return;
    onSelect(id);
  };

  const visible = useMemo(
    () => LOCATIONS.filter((l) => s.locations[l.id]?.discovered && !hidden.has(l.district)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.locations, hidden, store.rev()],
  );
  const results = query.trim()
    ? LOCATIONS.filter((l) => s.locations[l.id]?.discovered && (l.name.includes(query.trim()) || l.kind.includes(query.trim()) || (l.area ?? '').includes(query.trim()))).slice(0, 12)
    : [];
  const expAt = (id: string) => Object.values(s.expeditions).filter((e) => e.locationId === id).map((e) => s.characters[e.characterId]).filter(Boolean);
    // 확대 단계: 멀리(동네 이름만) → 중간(대형 시설) → 가까이(모든 장소)
  const showLabel = (l: LocationDef) => l.id === selected || l.id === hover || zoom >= 4.5 || (l.size === 'L' && zoom >= 3.1) || expAt(l.id).length > 0;
  const secretCount = LOCATIONS.filter((l) => !l.temporary && !s.locations[l.id]?.discovered).length;

  return (
    <div className={`citymap ${compact ? 'compact' : ''}`}>
      <div className="cm-viewport" ref={vp} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
        <div className="cm-world" style={{ transform: `translate(${off.x}px, ${off.y}px)` }}>
          <canvas ref={cvRef} width={MAP_W} height={MAP_H} style={{ width: MAP_W * zoom, height: MAP_H * zoom }} />
          {zoom < 3.1 &&
            CENTERS.map((c) => (
              <div key={c.name} className="cm-area" style={{ left: c.x * zoom, top: c.y * zoom }}>
                {c.name}
              </div>
            ))}
          <div className="cm-base" style={{ left: basePos.x * zoom, top: basePos.y * zoom }}>
            <span>⌂ 우리 거점</span>
          </div>
          {visible.map((l) => {
            const d = DISTRICT_BY_ID[l.district];
            const chars = expAt(l.id);
            const visited = (s.locations[l.id]?.visits ?? 0) > 0;
            return (
              <button
                key={l.id}
                className={`cm-loc size-${l.size} ${l.id === selected ? 'sel' : ''} ${visited ? 'visited' : ''} ${l.temporary ? 'temp' : ''}`}
                style={{ left: l.pos.x * zoom, top: l.pos.y * zoom, ['--dc' as string]: d?.color ?? '#ccc' }}
                onClick={() => click(l.id)}
                onPointerEnter={() => setHover(l.id)}
                onPointerLeave={() => setHover((h) => (h === l.id ? null : h))}
                title={`${l.name} · ${d?.name} · 위험 ${l.danger}`}
              >
                <i className="cm-dot" />
                {showLabel(l) && <span className="cm-label">{l.size === 'L' || zoom >= 5 ? `${l.icon} ${l.kind}` : l.kind}</span>}
                {chars.length > 0 && (
                  <span className="cm-chars">
                    {chars.map((c) => (
                      <Avatar key={c.id} a={c.appearance} size={16} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="cm-controls" onPointerDown={(e) => e.stopPropagation()}>
          <button onClick={() => vp.current && zoomAt(zoom * 1.3, vp.current.clientWidth / 2, vp.current.clientHeight / 2)}>＋</button>
          <button onClick={() => vp.current && zoomAt(zoom / 1.3, vp.current.clientWidth / 2, vp.current.clientHeight / 2)}>－</button>
          <button onClick={() => centerOn(basePos)} title="거점으로">⌂</button>
        </div>
        {!compact && (
          <div className="cm-search" onPointerDown={(e) => e.stopPropagation()}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="장소 검색 (예: 약국, 서림동)" />
            {results.length > 0 && (
              <div className="cm-results">
                {results.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => {
                      onSelect(l.id);
                      const z = Math.max(zoom, 4.5);
                      setZoom(z);
                      centerOn(l.pos, z);
                      setQuery('');
                    }}
                  >
                    <span style={{ color: DISTRICT_BY_ID[l.district]?.color }}>■</span> {l.name} <span className="muted small">· {travelMinutes(l)}분</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="cm-hint small">드래그: 이동 · 휠: 확대/축소 · 미발견 장소 {secretCount}곳</div>
      </div>

      {!compact && (
        <div className="cm-legend">
          {DISTRICTS.filter((d) => !d.hidden || LOCATIONS.some((l) => l.district === d.id && s.locations[l.id]?.discovered)).map((d) => (
            <button
              key={d.id}
              className={`chip ${hidden.has(d.id) ? 'off' : ''}`}
              title={`${d.desc}\n주요 물자: ${d.loot}`}
              onClick={() => {
                const n = new Set(hidden);
                if (n.has(d.id)) n.delete(d.id);
                else n.add(d.id);
                setHidden(n);
              }}
            >
              <span style={{ color: d.color }}>■</span> {d.short}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
