import Phaser from 'phaser';
import { bus, toast } from '../game/bus';
import { BUILD_BY_ID, FURNITURE, footprint, type FurnitureUse } from '../game/data/furniture';
import { ITEMS } from '../game/data/items';
import { countItem } from '../game/inventory';
import { sessionStore, store } from '../game/store';
import {
  addProp, build, canAfford, canPlace, demolish, furnitureAt, idx, inClaimed, moveFurniture, placeFurniture, walkable,
} from '../game/systems/base';
import type { BaseState, Character, PlacedFurniture } from '../game/types';
import { hourOf } from '../game/util';
import { ASSET_MANIFEST } from './assetManifest';
import { findPath, type P } from './pathfinding';
import { FURN_H, HH, HW, LOW_H, WALL_H, WALL_T } from './pixel';
import { buildPixelTextures, characterTexture, floorKey, furnTexture, panelKey } from './pixelTextures';
import { toolStore, type Tool } from './tool';

type Pose = 'stand' | 'sit' | 'sleep';

interface Actor {
  id: string;
  root: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  gx: number;
  gy: number;
  path: P[];
  pose: Pose;
  pendingPose: Pose;
  seat: string | null;
  nextThink: number;
  bubble: Phaser.GameObjects.Container | null;
  bubbleUntil: number;
  texKey: string;
  sig: string;
}

const FONT = 'Galmuri11, "Noto Sans KR", monospace';
const SPEED = 2.4; // 칸/초
const MARGIN = 20;

export class BaseScene extends Phaser.Scene {
  private ox = 0;
  private oy = 0;
  private worldW = 0;
  private worldH = 0;
  private world!: Phaser.GameObjects.Layer;
  private ui!: Phaser.GameObjects.Layer;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private floorRT!: Phaser.GameObjects.RenderTexture;
  private darkRT!: Phaser.GameObjects.RenderTexture;
  private fence!: Phaser.GameObjects.Graphics;
  private hover!: Phaser.GameObjects.Graphics;
  private selectG!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Image;
  private wallObjs: Phaser.GameObjects.GameObject[] = [];
  private furnObjs: Phaser.GameObjects.GameObject[] = [];
  /** 확대해도 커지지 않는 글자들 (월드 좌표에 붙어 다닌다) */
  private labels: { obj: Phaser.GameObjects.GameObject & { setPosition: (x: number, y: number) => unknown }; wx: number; wy: number }[] = [];
  private actors = new Map<string, Actor>();
  private walk: boolean[] = [];
  private tilesSig = '';
  private furnSig = '';
  private darkSig = '';
  private claimSig = '';
  private painting = false;
  private lastPaint = -1;
  private hoverTile: P = { x: -1, y: -1 };
  private selectedFurniture: string | null = null;
  private drag: { x: number; y: number; sx: number; sy: number; moved: boolean; button: number } | null = null;
  private unsubs: (() => void)[] = [];

  constructor() {
    super('base');
  }

  // ───────────── 좌표 ─────────────
  private iso(gx: number, gy: number) {
    return { x: this.ox + (gx - gy) * HW, y: this.oy + (gx + gy) * HH };
  }
  private toGrid(px: number, py: number) {
    const x = (px - this.ox) / HW;
    const y = (py - this.oy) / HH;
    return { gx: (x + y) / 2, gy: (y - x) / 2 };
  }
  private depthOf(gx: number, gy: number, layer = 0) {
    return 100 + (gx + gy) * 10 + layer;
  }
  private put<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.world.add(o);
    return o;
  }
  private label<T extends Phaser.GameObjects.GameObject & { setPosition: (x: number, y: number) => unknown }>(o: T, wx: number, wy: number): T {
    this.ui.add(o);
    this.labels.push({ obj: o, wx, wy });
    return o;
  }

  preload() {
    for (const [key, url] of Object.entries(ASSET_MANIFEST)) this.load.image(key, url);
  }

  create() {
    buildPixelTextures(this);
    const b = store.s.base;
    this.ox = MARGIN + b.height * HW;
    this.oy = MARGIN + WALL_H + 8;
    this.worldW = (b.width + b.height) * HW + MARGIN * 2;
    this.worldH = (b.width + b.height) * HH + WALL_H + MARGIN * 2 + 8;
    this.cameras.main.setBackgroundColor('#07080a');
    this.cameras.main.setRoundPixels(true);

    this.world = this.add.layer();
    this.ui = this.add.layer();
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCam.ignore(this.world);
    this.cameras.main.ignore(this.ui);

    this.floorRT = this.put(this.add.renderTexture(0, 0, this.worldW, this.worldH).setOrigin(0, 0).setDepth(0));
    this.fence = this.put(this.add.graphics().setDepth(1));
    this.hover = this.put(this.add.graphics().setDepth(2));
    this.darkRT = this.put(this.add.renderTexture(0, 0, this.worldW, this.worldH).setOrigin(0, 0).setDepth(5000));
    this.selectG = this.put(this.add.graphics().setDepth(5500));
    this.ghost = this.put(this.add.image(0, 0, '__DEFAULT').setOrigin(0, 0).setAlpha(0.75).setDepth(6000).setVisible(false));

    this.scale.on('resize', (size: Phaser.Structs.Size) => {
      this.uiCam.setSize(size.width, size.height);
      this.fitCamera();
    });

    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onPointerUp(p));
    // 휠: 정수 배율로만 확대 (도트가 뭉개지지 않게)
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(Math.round(cam.zoom) + (dy > 0 ? -1 : 1), 1, 6));
    });
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (ev.key === 'r' || ev.key === 'R' || ev.key === 'ㄱ') this.rotateTool();
      if (ev.key === 'Escape') toolStore.set({ kind: 'view' });
    });

    this.syncAll();
    this.unsubs.push(
      store.subscribe(() => this.syncAll()),
      toolStore.subscribe(() => this.refreshGhost()),
      sessionStore.subscribe(() => this.refreshRings()),
      bus.on('speech', ({ characterId, text }) => this.say(characterId, text)),
      bus.on('sitTogether', ({ a, b: bb }) => this.sitTogether(a, bb)),
      bus.on('selectFurniture', ({ uid }) => {
        this.selectedFurniture = uid;
        this.refreshSelectBox();
      }),
    );
    this.events.once('shutdown', () => this.unsubs.forEach((u) => u()));
    this.events.once('destroy', () => this.unsubs.forEach((u) => u()));
  }

  /** 거점 부지가 화면에 들어오도록 정수 배율로 맞춘다 */
  private fitCamera() {
    const c = store.s.base.claimed;
    const cam = this.cameras.main;
    const top = this.iso(c.x0, c.y0);
    const right = this.iso(c.x1 + 1, c.y0);
    const bottom = this.iso(c.x1 + 1, c.y1 + 1);
    const left = this.iso(c.x0, c.y1 + 1);
    const w = right.x - left.x + 24;
    const h = bottom.y - top.y + WALL_H + 24;
    cam.setZoom(Phaser.Math.Clamp(Math.floor(Math.min(cam.width / w, cam.height / h)), 1, 6));
    cam.centerOn(Math.round((left.x + right.x) / 2), Math.round((top.y - WALL_H + bottom.y) / 2));
  }

  // ───────────── 동기화 ─────────────

  private syncAll() {
    if (!store.has) return;
    const s = store.s;
    const b = s.base;
    const tSig = b.floor.join(',') + '|' + b.walls.join(',') + '|' + JSON.stringify(b.claimed);
    if (tSig !== this.tilesSig) {
      this.tilesSig = tSig;
      this.drawTiles();
    }
    const cSig = JSON.stringify(b.claimed);
    if (cSig !== this.claimSig) {
      this.claimSig = cSig;
      this.fitCamera();
    }
    const fSig = JSON.stringify(b.furniture.map((f) => [f.uid, f.itemId, f.x, f.y, f.rot, f.props, f.ownerId, f.prod?.stored, f.prod?.planted]));
    if (fSig !== this.furnSig) {
      this.furnSig = fSig;
      this.drawFurniture();
    }
    this.walk = walkable(b);
    const dSig = `${hourOf(s.time)}|${fSig}`;
    if (dSig !== this.darkSig) {
      this.darkSig = dSig;
      this.drawDarkness();
    }
    this.syncActors();
    this.refreshSelectBox();
  }

  private interior(b: BaseState, x: number, y: number) {
    if (x < 0 || y < 0 || x >= b.width || y >= b.height) return false;
    const i = idx(b, x, y);
    return !!b.floor[i] && !b.walls[i];
  }

  /** 벽 한 칸을 얇은 판으로: 실내와 맞닿은 변마다 판을 세운다 */
  private wallPanels(b: BaseState, x: number, y: number, wall: string) {
    const id = BUILD_BY_ID[wall] ? wall : 'wall_concrete';
    const out: { key: string; px: number; py: number; depth: number }[] = [];
    const back = (dir: 'x' | 'y', h: number) => {
      // 뒤쪽 판: 칸의 앞쪽 변 (실내는 판 앞)
      if (dir === 'x') {
        const p = this.iso(x, y + 1);
        out.push({ key: panelKey(id, 'x', h), px: p.x, py: p.y - WALL_T - h, depth: this.depthOf(x, y, 1) });
      } else {
        const q = this.iso(x + 1, y + 1);
        out.push({ key: panelKey(id, 'y', h), px: q.x - WALL_T, py: q.y - (HH + WALL_T + h), depth: this.depthOf(x, y, 1) });
      }
    };
    const front = (dir: 'x' | 'y') => {
      // 앞쪽 판: 칸의 뒤쪽 변, 낮게 잘라 실내가 보이게
      if (dir === 'x') {
        const p = this.iso(x, y);
        out.push({ key: panelKey(id, 'x', LOW_H), px: p.x, py: p.y - WALL_T - LOW_H, depth: this.depthOf(x, y, 1) });
      } else {
        const q = this.iso(x, y + 1);
        out.push({ key: panelKey(id, 'y', LOW_H), px: q.x - WALL_T, py: q.y - (HH + WALL_T + LOW_H), depth: this.depthOf(x, y, 1) });
      }
    };
    const inYp = this.interior(b, x, y + 1);
    const inXp = this.interior(b, x + 1, y);
    const inYm = this.interior(b, x, y - 1);
    const inXm = this.interior(b, x - 1, y);
    if (inYp) back('x', WALL_H);
    if (inXp) back('y', WALL_H);
    if (inYm && !inYp) front('x');
    if (inXm && !inXp) front('y');
    if (!inYp && !inXp && !inYm && !inXm) {
      // 모서리: 양옆 벽의 판이 이미 꼭짓점에서 만나므로 따로 그리지 않는다
      for (const [dx, dy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) if (this.interior(b, x + dx, y + dy)) return out;
      // 실내와 닿지 않은 벽(울타리 등): 중간 높이
      back('x', 35);
      back('y', 35);
    }
    return out;
  }

  private drawTiles() {
    const b = store.s.base;
    const rt = this.floorRT;
    rt.clear();
    this.wallObjs.forEach((o) => o.destroy());
    this.wallObjs = [];
    for (let y = 0; y < b.height; y++)
      for (let x = 0; x < b.width; x++) {
        const i = idx(b, x, y);
        const floor = b.floor[i];
        const claimed = inClaimed(b, x, y);
        const p = this.iso(x, y);
        rt.draw(floor ? floorKey(this, floor) : claimed ? 'gen_ground_dirt' : 'gen_ground_grass', p.x - HW, p.y, claimed || floor ? 1 : 0.5);
        const wall = b.walls[i];
        if (wall)
          for (const w of this.wallPanels(b, x, y, wall))
            this.wallObjs.push(this.put(this.add.image(w.px, w.py, w.key).setOrigin(0, 0).setDepth(w.depth)));
      }
    const c = b.claimed;
    const pts = [this.iso(c.x0, c.y0), this.iso(c.x1 + 1, c.y0), this.iso(c.x1 + 1, c.y1 + 1), this.iso(c.x0, c.y1 + 1)];
    this.fence.clear();
    this.fence.lineStyle(1, 0xc9a25a, 0.6);
    this.fence.strokePoints(pts, true);
  }

  /** 가구 그림 위치: 바닥 마름모가 그림 맨 아래에 오도록 */
  private furnPlacement(itemId: string, x: number, y: number, rot: number) {
    const fp = footprint(itemId, rot);
    const t = furnTexture(this, itemId, rot);
    const tex = this.textures.get(t.key).getSourceImage() as { width: number; height: number };
    const A = this.iso(x, y);
    return { key: t.key, flip: t.flip, x: A.x - fp.h * HW, y: A.y + (fp.w + fp.h) * HH - tex.height, fp };
  }

  private clearLabels(filter: (o: Phaser.GameObjects.GameObject) => boolean) {
    this.labels = this.labels.filter((l) => {
      if (filter(l.obj)) {
        l.obj.destroy();
        return false;
      }
      return true;
    });
  }

  private drawFurniture() {
    const s = store.s;
    this.furnObjs.forEach((o) => o.destroy());
    const old = new Set(this.furnObjs);
    this.clearLabels((o) => old.has(o));
    this.furnObjs = [];
    for (const f of s.base.furniture) {
      const def = FURNITURE[f.itemId];
      if (!def) continue;
      const pl = this.furnPlacement(f.itemId, f.x, f.y, f.rot);
      const rug = def.layer === 'rug';
      const depth = rug ? 50 : this.depthOf(f.x + pl.fp.w - 1, f.y + pl.fp.h - 1, 2);
      this.furnObjs.push(this.put(this.add.image(Math.round(pl.x), Math.round(pl.y), pl.key).setOrigin(0, 0).setFlipX(pl.flip).setDepth(depth)));
      // 위면 중앙
      const c = this.iso(f.x + pl.fp.w / 2, f.y + pl.fp.h / 2);
      const topY = c.y - (FURN_H[f.itemId] ?? 14);
      f.props.forEach((p, i) => {
        const off = (i - (f.props.length - 1) / 2) * 9;
        this.furnObjs.push(this.put(this.add.image(Math.round(c.x + off), Math.round(topY - 5), `prop_${p}`).setDepth(depth + 0.5)));
      });
      if (def.production && f.prod) {
        let txt = '';
        if (f.prod.stored > 0) txt = `${ITEMS[def.production.output].icon}${f.prod.stored}`;
        else if (def.production.needsSeed) txt = f.prod.planted ? '🌱' : '';
        if (txt) this.furnObjs.push(this.label(this.add.text(0, 0, txt, { fontSize: '13px', fontFamily: FONT, color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1), c.x, topY - 8));
      }
      if (f.ownerId && s.characters[f.ownerId]) {
        this.furnObjs.push(
          this.label(this.add.text(0, 0, s.characters[f.ownerId].name, { fontSize: '11px', fontFamily: FONT, color: '#ffe9a8', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 0), c.x, c.y + 4),
        );
      }
    }
  }

  private drawDarkness() {
    const s = store.s;
    const h = hourOf(s.time);
    const table = [0.62, 0.62, 0.62, 0.62, 0.6, 0.45, 0.25, 0.08, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.06, 0.18, 0.32, 0.45, 0.55, 0.6, 0.62];
    const a = Math.max(0.14, table[h] * 1.15);
    const rt = this.darkRT;
    rt.clear();
    rt.fill(a > 0.35 ? 0x020308 : 0x0a1210, a);
    for (const f of s.base.furniture) {
      const def = FURNITURE[f.itemId];
      const fp = footprint(f.itemId, f.rot);
      const c = this.iso(f.x + fp.w / 2, f.y + fp.h / 2);
      if (def?.light) rt.erase('px_light_big', c.x - 60, c.y - 70);
      else if (def?.station === 'stove') rt.erase('px_light_small', c.x - 22, c.y - 30);
      if (f.props.includes('p_candle')) rt.erase('px_light_small', c.x - 22, c.y - 30);
    }
  }

  // ───────────── 캐릭터 ─────────────

  private visibleChars(): Character[] {
    const s = store.s;
    return s.characterOrder.map((id) => s.characters[id]).filter((c): c is Character => !!c && (c.status === 'base' || c.status === 'down'));
  }

  private syncActors() {
    const chars = this.visibleChars();
    const ids = new Set(chars.map((c) => c.id));
    for (const [id, a] of this.actors)
      if (!ids.has(id)) {
        a.root.destroy();
        a.bubble?.destroy();
        this.clearLabels((o) => o === a.name || o === a.bubble);
        this.actors.delete(id);
      }
    for (const c of chars) {
      const sig = (c.sprite ?? '').slice(-32) + JSON.stringify(c.appearance) + c.name;
      const ex = this.actors.get(c.id);
      if (ex && ex.sig === sig) continue;
      let start: P = this.randomFreeTile() ?? { x: 8, y: 8 };
      if (ex) {
        start = this.tileOf(ex);
        ex.root.destroy();
        ex.bubble?.destroy();
        this.clearLabels((o) => o === ex.name || o === ex.bubble);
      }
      this.actors.set(c.id, this.makeActor(c, start, sig));
    }
    this.refreshRings();
  }

  private makeActor(c: Character, at: P, sig: string): Actor {
    const key = characterTexture(this, c, (loaded) => {
      const a = this.actors.get(c.id);
      if (a && a.sig === sig) {
        a.sprite.setTexture(loaded);
        a.texKey = loaded;
      }
    });
    const shadow = this.add.image(0, 0, 'px_shadow');
    const ring = this.add.image(0, 0, 'px_ring').setVisible(false);
    const sprite = this.add.image(0, 2, key).setOrigin(0.5, 1);
    const gx = at.x + 0.5;
    const gy = at.y + 0.5;
    const p = this.iso(gx, gy);
    const root = this.put(this.add.container(Math.round(p.x), Math.round(p.y), [shadow, ring, sprite]));
    root.setDepth(this.depthOf(gx, gy, 3));
    const name = this.add.text(0, 0, c.name, { fontSize: '12px', fontFamily: FONT, color: '#d9d2c0', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5, 1);
    this.ui.add(name);
    return {
      id: c.id, root, sprite, ring, name, gx, gy, path: [], pose: 'stand', pendingPose: 'stand', seat: null,
      nextThink: this.time.now + 500 + Math.random() * 2000, bubble: null, bubbleUntil: 0, texKey: key, sig,
    };
  }

  private refreshRings() {
    const active = sessionStore.get().activeCharacterId;
    for (const [id, a] of this.actors) a.ring.setVisible(id === active);
  }

  private randomFreeTile(): P | null {
    const b = store.s.base;
    if (!this.walk.length) this.walk = walkable(b);
    const cand: P[] = [];
    for (let y = 0; y < b.height; y++)
      for (let x = 0; x < b.width; x++) if (this.walk[idx(b, x, y)] && b.floor[idx(b, x, y)] && !b.walls[idx(b, x, y)]) cand.push({ x, y });
    return cand.length ? cand[Math.floor(Math.random() * cand.length)] : null;
  }

  private tileOf(a: Actor): P {
    return { x: Math.floor(a.gx), y: Math.floor(a.gy) };
  }

  private setPose(a: Actor, pose: Pose) {
    a.pose = pose;
    a.sprite.setAngle(pose === 'sleep' ? -90 : 0);
    a.sprite.setPosition(pose === 'sleep' ? -8 : 0, pose === 'sit' ? 4 : pose === 'sleep' ? -2 : 2);
  }

  private walkTo(a: Actor, goals: P[], pose: Pose, seat: string | null): boolean {
    const b = store.s.base;
    const path = findPath(b.width, b.height, this.walk, this.tileOf(a), goals);
    if (!path) return false;
    a.path = path;
    a.pendingPose = pose;
    a.seat = seat;
    this.setPose(a, 'stand');
    return true;
  }

  private seatTaken(uid: string, except: Actor) {
    for (const a of this.actors.values()) if (a !== except && a.seat === uid) return true;
    return false;
  }

  private cellsOf(f: PlacedFurniture): P[] {
    const fp = footprint(f.itemId, f.rot);
    const out: P[] = [];
    for (let dy = 0; dy < fp.h; dy++) for (let dx = 0; dx < fp.w; dx++) out.push({ x: f.x + dx, y: f.y + dy });
    return out;
  }

  private adjacentOf(f: PlacedFurniture): P[] {
    const b = store.s.base;
    const cells = this.cellsOf(f);
    const set = new Set(cells.map((c) => c.y * b.width + c.x));
    const out: P[] = [];
    for (const c of cells)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = c.x + dx;
        const y = c.y + dy;
        if (x < 0 || y < 0 || x >= b.width || y >= b.height) continue;
        const i = y * b.width + x;
        if (!set.has(i) && this.walk[i]) out.push({ x, y });
      }
    return out;
  }

  private goUse(a: Actor, c: Character, use: FurnitureUse | 'barricade'): boolean {
    const s = store.s;
    let list = s.base.furniture.filter((f) => (use === 'barricade' ? f.itemId === 'f_barricade' : FURNITURE[f.itemId]?.use === use));
    if (use === 'sleep') {
      const own = list.filter((f) => f.ownerId === c.id);
      list = own.length ? own : list.filter((f) => !f.ownerId || !s.characters[f.ownerId]);
    }
    list = list.filter((f) => !this.seatTaken(f.uid, a));
    if (!list.length) return false;
    const f = list[Math.floor(Math.random() * list.length)];
    if (use === 'sleep' || use === 'sit') {
      const cells = this.cellsOf(f);
      return this.walkTo(a, use === 'sleep' ? [cells[0]] : cells, use === 'sleep' ? 'sleep' : 'sit', f.uid);
    }
    return this.walkTo(a, this.adjacentOf(f), 'stand', null);
  }

  private think(a: Actor, c: Character) {
    const s = store.s;
    const h = hourOf(s.time);
    const night = h >= 22 || h < 6;
    a.nextThink = this.time.now + 6000 + Math.random() * 9000;
    if (sessionStore.get().activeCharacterId === c.id && a.path.length === 0) {
      if (!(night || c.status === 'down')) return;
    }
    if (c.status === 'down' || night || c.task === 'rest') {
      if (a.pose === 'sleep') {
        a.nextThink = this.time.now + 20000;
        return;
      }
      if (this.goUse(a, c, 'sleep')) return;
    }
    const taskUse: Partial<Record<Character['task'], FurnitureUse | 'barricade'>> = {
      farm: 'farm', water: 'water', workshop: 'work', guard: 'barricade',
    };
    const tu = taskUse[c.task];
    if (tu && Math.random() < 0.75 && this.goUse(a, c, tu)) return;
    const r = Math.random();
    if (r < 0.3 && this.goUse(a, c, 'sit')) return;
    if (r < 0.5 && this.goUse(a, c, Math.random() < 0.5 ? 'look' : 'cook')) return;
    const t = this.randomFreeTile();
    if (t) this.walkTo(a, [t], 'stand', null);
  }

  private sitTogether(aId: string, bId: string) {
    const a = this.actors.get(aId);
    const b = this.actors.get(bId);
    if (!a || !b) return;
    const s = store.s;
    const sofa = s.base.furniture.find((f) => f.itemId === 'f_sofa');
    const now = this.time.now;
    if (sofa) {
      const cells = this.cellsOf(sofa);
      this.walkTo(a, [cells[0]], 'sit', sofa.uid);
      this.walkTo(b, [cells[cells.length - 1]], 'sit', sofa.uid);
    } else {
      const bt = this.tileOf(b);
      this.walkTo(a, [{ x: bt.x + 1, y: bt.y }, { x: bt.x - 1, y: bt.y }, { x: bt.x, y: bt.y + 1 }], 'sit', null);
      b.path = [];
      this.setPose(b, 'sit');
    }
    a.nextThink = now + 40000;
    b.nextThink = now + 40000;
  }

  private say(characterId: string, text: string) {
    const a = this.actors.get(characterId);
    if (!a) return;
    a.bubble?.destroy();
    const short = text.length > 60 ? text.slice(0, 58) + '…' : text;
    const t = this.add
      .text(0, 0, short, { fontSize: '12px', fontFamily: FONT, color: '#d8d0bc', wordWrap: { width: 170, useAdvancedWrap: true }, align: 'center' })
      .setOrigin(0.5, 1);
    const pad = 6;
    const bg = this.add.graphics();
    const bx = Math.round(-t.width / 2 - pad);
    const by = Math.round(-t.height - pad);
    const bw = Math.round(t.width + pad * 2);
    const bh = Math.round(t.height + pad * 2);
    bg.fillStyle(0x000000, 1).fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    bg.fillStyle(0x16130f, 0.96).fillRect(bx, by, bw, bh);
    bg.fillStyle(0x6b5a3a, 1).fillRect(bx, by, bw, 2);
    bg.fillStyle(0x000000, 1).fillRect(-5, pad + 2, 10, 4).fillRect(-3, pad + 6, 6, 3);
    bg.fillStyle(0x16130f, 1).fillRect(-3, pad, 6, 4).fillRect(-1, pad + 4, 2, 3);
    a.bubble = this.add.container(0, 0, [bg, t]);
    this.ui.add(a.bubble);
    a.bubbleUntil = this.time.now + 4000 + short.length * 90;
  }

  // ───────────── 루프 ─────────────

  /** 월드 좌표 → 화면 좌표 (글자 레이어용) */
  private toScreen(wx: number, wy: number) {
    const cam = this.cameras.main;
    return { x: Math.round((wx - cam.worldView.x) * cam.zoom), y: Math.round((wy - cam.worldView.y) * cam.zoom) };
  }

  update(time: number, delta: number) {
    if (!store.has) return;
    const s = store.s;
    for (const [id, a] of this.actors) {
      const c = s.characters[id];
      if (!c) continue;
      if (a.path.length) {
        const n = a.path[0];
        const tx = n.x + 0.5;
        const ty = n.y + 0.5;
        const dx = tx - a.gx;
        const dy = ty - a.gy;
        const dist = Math.hypot(dx, dy);
        const step = (SPEED * delta) / 1000;
        if (dist <= step) {
          a.gx = tx;
          a.gy = ty;
          a.path.shift();
          if (!a.path.length) this.setPose(a, a.pendingPose);
        } else {
          a.gx += (dx / dist) * step;
          a.gy += (dy / dist) * step;
        }
        // 걷는 동안 위아래로 1px 흔들림
        a.sprite.setY(2 - (Math.floor(time / 160) % 2));
        const sx = dx - dy;
        if (Math.abs(sx) > 0.01) a.sprite.setFlipX(sx < 0);
      } else if (time > a.nextThink) {
        a.seat = a.pose === 'stand' ? null : a.seat;
        this.think(a, c);
      }
      const p = this.iso(a.gx, a.gy);
      const lift = a.pose === 'sit' ? 8 : a.pose === 'sleep' ? 6 : 0;
      a.root.setPosition(Math.round(p.x), Math.round(p.y - lift));
      a.root.setDepth(this.depthOf(a.gx, a.gy, a.pose === 'stand' ? 3 : 4));
      const head = this.toScreen(a.root.x, a.root.y - 38);
      a.name.setPosition(head.x, head.y);
      if (a.bubble) {
        a.bubble.setPosition(head.x, head.y - 16);
        if (time > a.bubbleUntil) {
          a.bubble.destroy();
          a.bubble = null;
        }
      }
    }
    for (const l of this.labels) {
      const p = this.toScreen(l.wx, l.wy);
      l.obj.setPosition(p.x, p.y);
    }
  }

  // ───────────── 입력 ─────────────

  private tileAt(p: Phaser.Input.Pointer): P {
    const g = this.toGrid(p.worldX, p.worldY);
    return { x: Math.floor(g.gx), y: Math.floor(g.gy) };
  }

  private inBounds(t: P) {
    const b = store.s.base;
    return t.x >= 0 && t.y >= 0 && t.x < b.width && t.y < b.height;
  }

  private regionPts(x: number, y: number, w: number, h: number) {
    return [this.iso(x, y), this.iso(x + w, y), this.iso(x + w, y + h), this.iso(x, y + h)];
  }

  private drawHover(t: P, w: number, h: number, color: number, alpha: number) {
    this.hover.clear();
    if (!this.inBounds(t)) return;
    const pts = this.regionPts(t.x, t.y, w, h);
    this.hover.fillStyle(color, alpha).fillPoints(pts, true);
    this.hover.lineStyle(1, 0xffffff, 0.5).strokePoints(pts, true);
  }

  private onPointerMove(p: Phaser.Input.Pointer) {
    const t = this.tileAt(p);
    this.hoverTile = t;
    // 끌어서 화면 이동 (보기 모드의 왼쪽 버튼, 또는 가운데 버튼)
    if (this.drag && p.isDown) {
      const dx = p.x - this.drag.x;
      const dy = p.y - this.drag.y;
      if (!this.drag.moved && Math.hypot(dx, dy) > 5) this.drag.moved = true;
      if (this.drag.moved) {
        const cam = this.cameras.main;
        cam.scrollX = this.drag.sx - dx / cam.zoom;
        cam.scrollY = this.drag.sy - dy / cam.zoom;
      }
      return;
    }
    this.refreshGhost();
    if (this.painting && p.isDown) this.paint(t);
  }

  private onPointerDown(p: Phaser.Input.Pointer) {
    const t = this.tileAt(p);
    const tool = toolStore.get();
    const cam = this.cameras.main;
    if (p.middleButtonDown() || (tool.kind === 'view' && p.leftButtonDown())) {
      this.drag = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY, moved: false, button: p.button };
      return;
    }
    if (p.rightButtonDown()) {
      if (tool.kind === 'place' || tool.kind === 'move') this.rotateTool();
      else toolStore.set({ kind: 'view' });
      return;
    }
    if (!this.inBounds(t)) return;
    switch (tool.kind) {
      case 'place': {
        if (!placeFurniture(tool.itemId, t.x, t.y, tool.rot)) {
          toast('여기에는 놓을 수 없다.', 'bad');
          return;
        }
        if (countItem(store.s.storage, tool.itemId) <= 0) toolStore.set({ kind: 'view' });
        return;
      }
      case 'move': {
        if (moveFurniture(tool.uid, t.x, t.y, tool.rot)) toolStore.set({ kind: 'view' });
        else toast('여기에는 옮길 수 없다.', 'bad');
        return;
      }
      case 'prop': {
        const f = furnitureAt(t.x, t.y);
        if (!f) return toast('소품을 올릴 가구(책상/선반/식탁 등)를 클릭하세요.', 'info');
        const err = addProp(f.uid, tool.propId);
        if (err) toast(err, 'bad');
        if (countItem(store.s.storage, tool.propId) <= 0) toolStore.set({ kind: 'view' });
        return;
      }
      case 'build':
      case 'demolish':
        this.painting = true;
        this.lastPaint = -1;
        this.paint(t);
        return;
    }
  }

  private onPointerUp(p: Phaser.Input.Pointer) {
    this.painting = false;
    this.lastPaint = -1;
    const d = this.drag;
    this.drag = null;
    // 끌지 않았으면 클릭으로 처리
    if (d && !d.moved && d.button === 0 && toolStore.get().kind === 'view') this.clickView(p, this.tileAt(p));
  }

  private paint(t: P) {
    if (!this.inBounds(t)) return;
    const b = store.s.base;
    const i = idx(b, t.x, t.y);
    if (i === this.lastPaint) return;
    this.lastPaint = i;
    const tool = toolStore.get();
    let err: string | null = null;
    if (tool.kind === 'build') err = build(t.x, t.y, tool.buildId);
    else if (tool.kind === 'demolish') err = demolish(t.x, t.y, tool.what);
    if (err) {
      toast(err, 'bad');
      this.painting = false;
    }
  }

  private clickView(p: Phaser.Input.Pointer, t: P) {
    let best: Actor | null = null;
    let bestD = 14;
    for (const a of this.actors.values()) {
      const d = Math.hypot(p.worldX - a.root.x, p.worldY - (a.root.y - 16));
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    if (best) {
      bus.emit('selectCharacter', { characterId: best.id });
      return;
    }
    if (!this.inBounds(t)) return;
    const f = furnitureAt(t.x, t.y);
    const active = sessionStore.get().activeCharacterId;
    const a = active ? this.actors.get(active) : undefined;
    if (f) {
      bus.emit('selectFurniture', { uid: f.uid });
      if (a) {
        const use = FURNITURE[f.itemId]?.use;
        if (use === 'sit' || use === 'sleep') {
          const cells = this.cellsOf(f);
          this.walkTo(a, use === 'sleep' ? [cells[0]] : cells, use === 'sleep' ? 'sleep' : 'sit', f.uid);
        } else this.walkTo(a, this.adjacentOf(f), 'stand', null);
        a.nextThink = this.time.now + 60000;
      }
      return;
    }
    bus.emit('selectFurniture', { uid: null });
    if (a) {
      if (!this.walkTo(a, [t], 'stand', null)) toast('그곳으로 갈 수 없다.', 'info');
      a.nextThink = this.time.now + 60000;
    }
  }

  private rotateTool() {
    const tool = toolStore.get();
    if (tool.kind === 'place' || tool.kind === 'move') toolStore.set({ ...tool, rot: ((tool.rot + 1) % 4) as 0 | 1 | 2 | 3 });
  }

  private refreshGhost() {
    const tool: Tool = toolStore.get();
    const t = this.hoverTile;
    if (tool.kind === 'place' || tool.kind === 'move') {
      if (!FURNITURE[tool.itemId]) return;
      const pl = this.furnPlacement(tool.itemId, t.x, t.y, tool.rot);
      const ok = canPlace(tool.itemId, t.x, t.y, tool.rot, tool.kind === 'move' ? tool.uid : undefined);
      this.ghost
        .setTexture(pl.key)
        .setFlipX(pl.flip)
        .setPosition(Math.round(pl.x), Math.round(pl.y))
        .setTint(ok ? 0x88ff88 : 0xff6666)
        .setVisible(this.inBounds(t));
      this.drawHover(t, pl.fp.w, pl.fp.h, ok ? 0x44ff44 : 0xff4444, 0.2);
      return;
    }
    this.ghost.setVisible(false);
    if (tool.kind === 'build') {
      const ok = canAfford(BUILD_BY_ID[tool.buildId]?.cost ?? []) && inClaimed(store.s.base, t.x, t.y);
      this.drawHover(t, 1, 1, ok ? 0x44ff44 : 0xff4444, 0.3);
    } else if (tool.kind === 'demolish') {
      this.drawHover(t, 1, 1, 0xff8844, 0.3);
    } else {
      this.drawHover(t, 1, 1, 0xffffff, 0.08);
    }
  }

  private refreshSelectBox() {
    this.selectG.clear();
    const f = this.selectedFurniture ? store.s.base.furniture.find((x) => x.uid === this.selectedFurniture) : null;
    if (!f) return;
    const fp = footprint(f.itemId, f.rot);
    this.selectG.lineStyle(1, 0xffd84a, 1).strokePoints(this.regionPts(f.x, f.y, fp.w, fp.h), true);
  }
}
