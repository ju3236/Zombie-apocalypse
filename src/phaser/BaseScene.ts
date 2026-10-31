import Phaser from 'phaser';
import { bus, toast } from '../game/bus';
import { BUILD_BY_ID, FURNITURE, footprint, type FurnitureUse } from '../game/data/furniture';
import { ITEMS } from '../game/data/items';
import { countItem } from '../game/inventory';
import { sessionStore, store } from '../game/store';
import {
  addProp, build, canAfford, canPlace, demolish, furnitureAt, idx, inClaimed, moveFurniture, placeFurniture, walkable,
} from '../game/systems/base';
import type { Character, PlacedFurniture } from '../game/types';
import { hourOf } from '../game/util';
import { ASSET_MANIFEST } from './assetManifest';
import { findPath, type P } from './pathfinding';
import { generatePlaceholders, T } from './textures';
import { toolStore, type Tool } from './tool';

type Pose = 'stand' | 'sit' | 'sleep';

interface Actor {
  id: string;
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Container;
  legs: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  ring: Phaser.GameObjects.Ellipse;
  path: P[];
  pose: Pose;
  pendingPose: Pose;
  seat: string | null; // 앉거나 누운 가구 uid
  nextThink: number;
  bubble: Phaser.GameObjects.Container | null;
  bubbleUntil: number;
  appearanceKey: string;
}

const FONT = 'Galmuri11, "Noto Sans KR", monospace';
const SPEED = 72; // px/s

export class BaseScene extends Phaser.Scene {
  private tilesRT!: Phaser.GameObjects.RenderTexture;
  private darkRT!: Phaser.GameObjects.RenderTexture;
  private fence!: Phaser.GameObjects.Graphics;
  private furnLayer!: Phaser.GameObjects.Container;
  private hover!: Phaser.GameObjects.Rectangle;
  private ghost!: Phaser.GameObjects.Image;
  private selectBox!: Phaser.GameObjects.Rectangle;
  private actors = new Map<string, Actor>();
  private walk: boolean[] = [];
  private tilesSig = '';
  private furnSig = '';
  private darkSig = '';
  private painting = false;
  private lastPaint = -1;
  private hoverTile: P = { x: -1, y: -1 };
  private selectedFurniture: string | null = null;
  private unsubs: (() => void)[] = [];

  constructor() {
    super('base');
  }

  preload() {
    for (const [key, url] of Object.entries(ASSET_MANIFEST)) this.load.image(key, url);
  }

  create() {
    for (const key of Object.keys(ASSET_MANIFEST))
      if (this.textures.exists(key)) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    generatePlaceholders(this);
    const b = store.s.base;
    const W = b.width * T;
    const H = b.height * T;
    this.cameras.main.setBackgroundColor('#0b0d0b');

    this.tilesRT = this.add.renderTexture(0, 0, W, H).setOrigin(0, 0).setDepth(0);
    this.fence = this.add.graphics().setDepth(1);
    this.furnLayer = this.add.container(0, 0).setDepth(2);
    this.darkRT = this.add.renderTexture(0, 0, W, H).setOrigin(0, 0).setDepth(50);
    this.selectBox = this.add.rectangle(0, 0, T, T).setStrokeStyle(2, 0xffd84a).setOrigin(0, 0).setDepth(55).setVisible(false);
    this.hover = this.add.rectangle(0, 0, T, T, 0xffffff, 0.12).setStrokeStyle(1, 0xffffff, 0.6).setOrigin(0, 0).setDepth(70);
    this.ghost = this.add.image(0, 0, 'furn_chair').setAlpha(0.65).setDepth(71).setVisible(false);

    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on('pointerup', () => {
      this.painting = false;
      this.lastPaint = -1;
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
      bus.on('sitTogether', ({ a, b }) => this.sitTogether(a, b)),
      bus.on('selectFurniture', ({ uid }) => {
        this.selectedFurniture = uid;
        this.refreshSelectBox();
      }),
    );
    this.events.once('shutdown', () => this.unsubs.forEach((u) => u()));
    this.events.once('destroy', () => this.unsubs.forEach((u) => u()));
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
    const fSig = JSON.stringify(b.furniture.map((f) => [f.uid, f.itemId, f.x, f.y, f.rot, f.props, f.ownerId, f.prod?.stored, f.prod?.planted]));
    const structural = fSig !== this.furnSig;
    if (structural) {
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

  private drawTiles() {
    const b = store.s.base;
    const rt = this.tilesRT;
    rt.clear();
    for (let y = 0; y < b.height; y++)
      for (let x = 0; x < b.width; x++) {
        const i = idx(b, x, y);
        const floor = b.floor[i];
        const claimed = inClaimed(b, x, y);
        rt.draw(floor ? BUILD_BY_ID[floor]?.sprite ?? 'floor_concrete' : claimed ? 'ground_dirt' : 'ground_grass', x * T, y * T);
        const wall = b.walls[i];
        if (wall) rt.draw(BUILD_BY_ID[wall]?.sprite ?? 'wall_concrete', x * T, y * T);
        if (!claimed) rt.fill(0x000000, 0.28, x * T, y * T, T, T);
      }
    const c = b.claimed;
    this.fence.clear();
    this.fence.lineStyle(2, 0xc9a25a, 0.8);
    this.fence.strokeRect(c.x0 * T, c.y0 * T, (c.x1 - c.x0 + 1) * T, (c.y1 - c.y0 + 1) * T);
  }

  private drawFurniture() {
    const s = store.s;
    this.furnLayer.removeAll(true);
    const sorted = [...s.base.furniture].sort((a, b) => (FURNITURE[a.itemId]?.layer === 'rug' ? -1 : 0) - (FURNITURE[b.itemId]?.layer === 'rug' ? -1 : 0));
    for (const f of sorted) {
      const def = FURNITURE[f.itemId];
      if (!def) continue;
      const fp = footprint(f.itemId, f.rot);
      const cx = (f.x + fp.w / 2) * T;
      const cy = (f.y + fp.h / 2) * T;
      const img = this.add.image(cx, cy, def.sprite).setAngle(f.rot * 90);
      this.furnLayer.add(img);
      // 소품
      f.props.forEach((p, i) => {
        const n = f.props.length;
        const horizontal = fp.w >= fp.h;
        const span = (horizontal ? fp.w : fp.h) * T;
        const off = (i + 0.5) * (span / Math.max(n, def.surface ?? 1)) - span / 2;
        const key = `prop_${p}`;
        const px = horizontal ? cx + off : cx;
        const py = horizontal ? cy - 2 : cy + off;
        if (this.textures.exists(key)) this.furnLayer.add(this.add.image(px, py, key));
        else this.furnLayer.add(this.add.text(px, py, ITEMS[p]?.icon ?? '?', { fontSize: '15px' }).setOrigin(0.5));
      });
      // 생산 상태
      if (def.production && f.prod) {
        let label = '';
        if (f.prod.stored > 0) label = `${ITEMS[def.production.output].icon}${f.prod.stored}`;
        else if (def.production.needsSeed) label = f.prod.planted ? '🌱' : '';
        if (label)
          this.furnLayer.add(
            this.add.text(cx, cy, label, { fontSize: '13px', fontFamily: FONT, color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5),
          );
      }
      // 소유자
      if (f.ownerId && s.characters[f.ownerId]) {
        this.furnLayer.add(
          this.add
            .text(cx, f.y * T + fp.h * T - 2, s.characters[f.ownerId].name, { fontSize: '9px', fontFamily: FONT, color: '#ffe9a8', stroke: '#000', strokeThickness: 2 })
            .setOrigin(0.5, 1)
            .setResolution(2),
        );
      }
    }
  }

  private drawDarkness() {
    const s = store.s;
    const h = hourOf(s.time);
    const table = [0.62, 0.62, 0.62, 0.62, 0.6, 0.45, 0.25, 0.08, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.06, 0.18, 0.32, 0.45, 0.55, 0.6, 0.62];
    // 낮에도 잿빛 안개가 깔린 음산한 분위기
    const a = Math.max(0.2, table[h] * 1.15);
    const rt = this.darkRT;
    rt.clear();
    rt.fill(a > 0.35 ? 0x020308 : 0x0a1210, a);
    for (const f of s.base.furniture) {
      const def = FURNITURE[f.itemId];
      const fp = footprint(f.itemId, f.rot);
      const cx = (f.x + fp.w / 2) * T;
      const cy = (f.y + fp.h / 2) * T;
      if (def?.light) rt.erase('light_big', cx - 120, cy - 120);
      else if (f.itemId === 'f_stove') rt.erase('light_small', cx - 48, cy - 48);
      if (f.props.includes('p_candle')) rt.erase('light_small', cx - 48, cy - 48);
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
        this.actors.delete(id);
      }
    for (const c of chars) {
      const key = JSON.stringify(c.appearance) + c.name;
      const ex = this.actors.get(c.id);
      if (ex && ex.appearanceKey === key) continue;
      let start: P = this.randomFreeTile() ?? { x: 8, y: 8 };
      if (ex) {
        start = { x: Math.floor(ex.root.x / T), y: Math.floor(ex.root.y / T) };
        ex.root.destroy();
        ex.bubble?.destroy();
      }
      this.actors.set(c.id, this.makeActor(c, start));
    }
    this.refreshRings();
  }

  private makeActor(c: Character, at: P): Actor {
    const tint = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;
    const shadow = this.add.image(0, 0, 'char_shadow');
    const legs = this.add.image(0, -5, 'char_legs').setTint(tint(c.appearance.pants));
    const torso = this.add.image(0, -14, 'char_body').setTint(tint(c.appearance.shirt));
    const head = this.add.image(0, -25, 'char_head').setTint(tint(c.appearance.skin));
    const hair = this.add.image(0, -29, 'char_hair').setTint(tint(c.appearance.hair));
    const body = this.add.container(0, 0, [legs, torso, head, hair]);
    const ring = this.add.ellipse(0, 0, 24, 10).setStrokeStyle(2, 0xffd84a).setVisible(false);
    const name = this.add
      .text(0, -36, c.name, { fontSize: '12px', fontFamily: FONT, color: '#d9d2c0', stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setResolution(2);
    const root = this.add.container(at.x * T + T / 2, at.y * T + T / 2 + 6, [shadow, ring, body, name]);
    root.setDepth(10);
    return {
      id: c.id, root, body, legs, name, ring, path: [], pose: 'stand', pendingPose: 'stand', seat: null,
      nextThink: this.time.now + 500 + Math.random() * 2000, bubble: null, bubbleUntil: 0, appearanceKey: JSON.stringify(c.appearance) + c.name,
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
    return { x: Math.floor(a.root.x / T), y: Math.floor((a.root.y - 6) / T) };
  }

  private setPose(a: Actor, pose: Pose) {
    a.pose = pose;
    a.body.setAngle(pose === 'sleep' ? -90 : 0);
    a.body.setPosition(pose === 'sleep' ? -8 : 0, pose === 'sit' ? 4 : pose === 'sleep' ? 6 : 0);
    a.legs.setVisible(pose !== 'sit');
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

  /** 가구를 사용하러 이동 */
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
      // 직접 조종 중인 캐릭터는 스스로 움직이지 않는다 (밤/요양 제외)
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
    // 소파 우선, 없으면 붙어 있는 의자, 그것도 없으면 옆자리에 선다
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
      .setOrigin(0.5, 1)
      .setResolution(2);
    const pad = 6;
    const bg = this.add.graphics();
    // 도트풍 말풍선: 각진 사각형 + 두꺼운 테두리
    const bx = Math.round(-t.width / 2 - pad);
    const by = Math.round(-t.height - pad);
    const bw = Math.round(t.width + pad * 2);
    const bh = Math.round(t.height + pad * 2);
    bg.fillStyle(0x000000, 1).fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    bg.fillStyle(0x16130f, 0.96).fillRect(bx, by, bw, bh);
    bg.fillStyle(0x6b5a3a, 1).fillRect(bx, by, bw, 2);
    bg.fillStyle(0x000000, 1).fillRect(-5, pad + 2, 10, 4).fillRect(-3, pad + 6, 6, 3);
    bg.fillStyle(0x16130f, 1).fillRect(-3, pad, 6, 4).fillRect(-1, pad + 4, 2, 3);
    t.setY(0);
    a.bubble = this.add.container(a.root.x, a.root.y - 46, [bg, t]).setDepth(60);
    a.bubbleUntil = this.time.now + 4000 + short.length * 90;
  }

  // ───────────── 루프 ─────────────

  update(time: number, delta: number) {
    if (!store.has) return;
    const s = store.s;
    for (const [id, a] of this.actors) {
      const c = s.characters[id];
      if (!c) continue;
      if (a.path.length) {
        const n = a.path[0];
        const tx = n.x * T + T / 2;
        const ty = n.y * T + T / 2 + 6;
        const dx = tx - a.root.x;
        const dy = ty - a.root.y;
        const dist = Math.hypot(dx, dy);
        const step = (SPEED * delta) / 1000;
        if (dist <= step) {
          a.root.setPosition(tx, ty);
          a.path.shift();
          if (!a.path.length) this.setPose(a, a.pendingPose);
        } else {
          a.root.x += (dx / dist) * step;
          a.root.y += (dy / dist) * step;
        }
        a.legs.setY(-5 + Math.sin(time / 70) * 1.2);
        if (Math.abs(dx) > 0.5) a.body.setScale(dx < 0 ? -1 : 1, 1);
      } else if (time > a.nextThink) {
        a.seat = a.pose === 'stand' ? null : a.seat;
        this.think(a, c);
      }
      a.root.setDepth(10 + a.root.y / 1000);
      if (a.bubble) {
        a.bubble.setPosition(a.root.x, a.root.y - 46);
        if (time > a.bubbleUntil) {
          a.bubble.destroy();
          a.bubble = null;
        }
      }
    }
  }

  // ───────────── 입력 ─────────────

  private tileAt(p: Phaser.Input.Pointer): P {
    return { x: Math.floor(p.worldX / T), y: Math.floor(p.worldY / T) };
  }

  private inBounds(t: P) {
    const b = store.s.base;
    return t.x >= 0 && t.y >= 0 && t.x < b.width && t.y < b.height;
  }

  private onPointerMove(p: Phaser.Input.Pointer) {
    const t = this.tileAt(p);
    this.hoverTile = t;
    this.hover.setPosition(t.x * T, t.y * T).setVisible(this.inBounds(t));
    this.refreshGhost();
    if (this.painting && p.isDown) this.paint(t);
  }

  private onPointerDown(p: Phaser.Input.Pointer) {
    const t = this.tileAt(p);
    if (!this.inBounds(t)) return;
    const tool = toolStore.get();
    if (p.rightButtonDown()) {
      if (tool.kind === 'place' || tool.kind === 'move') this.rotateTool();
      else toolStore.set({ kind: 'view' });
      return;
    }
    switch (tool.kind) {
      case 'view':
        return this.clickView(p, t);
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
    // 캐릭터 클릭?
    let best: Actor | null = null;
    let bestD = 16;
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
    const f = furnitureAt(t.x, t.y);
    const active = sessionStore.get().activeCharacterId;
    const a = active ? this.actors.get(active) : undefined;
    if (f) {
      bus.emit('selectFurniture', { uid: f.uid });
      // 조종 중인 캐릭터가 있으면 해당 가구를 사용하러 간다
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
    this.hover.setSize(T, T).setFillStyle(0xffffff, 0.12);
    if (tool.kind === 'place' || tool.kind === 'move') {
      const def = FURNITURE[tool.itemId];
      if (!def) return;
      const fp = footprint(tool.itemId, tool.rot);
      const ok = canPlace(tool.itemId, t.x, t.y, tool.rot, tool.kind === 'move' ? tool.uid : undefined);
      this.ghost
        .setTexture(def.sprite)
        .setAngle(tool.rot * 90)
        .setPosition((t.x + fp.w / 2) * T, (t.y + fp.h / 2) * T)
        .setTint(ok ? 0x88ff88 : 0xff6666)
        .setVisible(this.inBounds(t));
      this.hover.setSize(fp.w * T, fp.h * T).setFillStyle(ok ? 0x44ff44 : 0xff4444, 0.15);
      return;
    }
    this.ghost.setVisible(false);
    if (tool.kind === 'build') {
      const ok = canAfford(BUILD_BY_ID[tool.buildId]?.cost ?? []) && inClaimed(store.s.base, t.x, t.y);
      this.hover.setFillStyle(ok ? 0x44ff44 : 0xff4444, 0.25);
    } else if (tool.kind === 'demolish') {
      this.hover.setFillStyle(0xff8844, 0.25);
    }
  }

  private refreshSelectBox() {
    const f = this.selectedFurniture ? store.s.base.furniture.find((x) => x.uid === this.selectedFurniture) : null;
    if (!f) {
      this.selectBox.setVisible(false);
      return;
    }
    const fp = footprint(f.itemId, f.rot);
    this.selectBox.setPosition(f.x * T, f.y * T).setSize(fp.w * T, fp.h * T).setVisible(true);
  }
}
