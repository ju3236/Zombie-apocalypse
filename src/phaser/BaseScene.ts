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
import { generateIsoTextures, HH, HW, isoFurnAnchor, isoFurnKey, LOW_H, WALL_H } from './isoTextures';
import { findPath, type P } from './pathfinding';
import { generatePlaceholders } from './textures';
import { toolStore, type Tool } from './tool';

type Pose = 'stand' | 'sit' | 'sleep';

interface Actor {
  id: string;
  root: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Container;
  legs: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  ring: Phaser.GameObjects.Ellipse;
  /** 격자 좌표 (칸 중앙 = n + 0.5) */
  gx: number;
  gy: number;
  path: P[];
  pose: Pose;
  pendingPose: Pose;
  seat: string | null;
  nextThink: number;
  bubble: Phaser.GameObjects.Container | null;
  bubbleUntil: number;
  appearanceKey: string;
}

const FONT = 'Galmuri11, "Noto Sans KR", monospace';
const SPEED = 2.4; // 칸/초
const MARGIN = 24;

/** 아이소메트릭 캔버스 크기 */
export function isoCanvasSize(w: number, h: number) {
  return { width: (w + h) * HW + MARGIN * 2, height: (w + h) * HH + WALL_H + MARGIN * 2 };
}

export class BaseScene extends Phaser.Scene {
  private ox = 0;
  private oy = 0;
  private floorRT!: Phaser.GameObjects.RenderTexture;
  private darkRT!: Phaser.GameObjects.RenderTexture;
  private fence!: Phaser.GameObjects.Graphics;
  private hover!: Phaser.GameObjects.Graphics;
  private selectG!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Image;
  private wallObjs: Phaser.GameObjects.GameObject[] = [];
  private furnObjs: Phaser.GameObjects.GameObject[] = [];
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
  private unsubs: (() => void)[] = [];

  constructor() {
    super('base');
  }

  // ───────────── 좌표 변환 ─────────────
  /** 격자 (gx, gy) → 화면. 정수면 칸의 위 꼭짓점 */
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

  preload() {
    for (const [key, url] of Object.entries(ASSET_MANIFEST)) this.load.image(key, url);
  }

  create() {
    for (const key of Object.keys(ASSET_MANIFEST))
      if (this.textures.exists(key)) this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    generatePlaceholders(this);
    generateIsoTextures(this);
    const b = store.s.base;
    const size = isoCanvasSize(b.width, b.height);
    this.ox = MARGIN + b.height * HW;
    this.oy = MARGIN + WALL_H;
    this.cameras.main.setBackgroundColor('#07080a');

    this.floorRT = this.add.renderTexture(0, 0, size.width, size.height).setOrigin(0, 0).setDepth(0);
    this.fence = this.add.graphics().setDepth(1);
    this.selectG = this.add.graphics().setDepth(5500);
    this.hover = this.add.graphics().setDepth(4900);
    this.darkRT = this.add.renderTexture(0, 0, size.width, size.height).setOrigin(0, 0).setDepth(5000);
    this.ghost = this.add.image(0, 0, isoFurnKey('f_chair', 0)).setOrigin(0, 0).setAlpha(0.7).setDepth(6000).setVisible(false);

    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on('pointerup', () => {
      this.painting = false;
      this.lastPaint = -1;
    });
    // 휠로 확대 / 축소
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.6, 3));
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

  /** 거점 부지가 화면에 꽉 차도록 카메라를 맞춘다 */
  private fitCamera() {
    const c = store.s.base.claimed;
    const cam = this.cameras.main;
    const top = this.iso(c.x0, c.y0);
    const right = this.iso(c.x1 + 1, c.y0);
    const bottom = this.iso(c.x1 + 1, c.y1 + 1);
    const left = this.iso(c.x0, c.y1 + 1);
    const w = right.x - left.x + 80;
    const h = bottom.y - top.y + WALL_H + 80;
    const zoom = Phaser.Math.Clamp(Math.min(cam.width / w, cam.height / h), 0.6, 2.6);
    cam.setZoom(zoom);
    cam.centerOn((left.x + right.x) / 2, (top.y - WALL_H + bottom.y) / 2);
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

  /** 실내 바닥 (벽이 없는 바닥 칸) */
  private interior(b: BaseState, x: number, y: number) {
    if (x < 0 || y < 0 || x >= b.width || y >= b.height) return false;
    const i = idx(b, x, y);
    return !!b.floor[i] && !b.walls[i];
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
        rt.draw(floor ? `iso_${floor}` : claimed ? 'iso_dirt' : 'iso_grass', p.x - HW, p.y, claimed || floor ? 1 : 0.55);
        const wall = b.walls[i];
        if (wall) {
          // 안쪽이 벽 뒤에 있으면(앞벽) 낮게 잘라 실내가 보이게 한다
          const front = this.interior(b, x - 1, y) || this.interior(b, x, y - 1) || this.interior(b, x - 1, y - 1);
          const h = front ? LOW_H : WALL_H;
          const key = `iso_${BUILD_BY_ID[wall] ? wall : 'wall_concrete'}${front ? '_low' : ''}`;
          const img = this.add.image(p.x - HW, p.y - h, key).setOrigin(0, 0).setDepth(this.depthOf(x, y, 1));
          this.wallObjs.push(img);
        }
      }
    const c = b.claimed;
    const pts = [this.iso(c.x0, c.y0), this.iso(c.x1 + 1, c.y0), this.iso(c.x1 + 1, c.y1 + 1), this.iso(c.x0, c.y1 + 1)];
    this.fence.clear();
    this.fence.lineStyle(2, 0xc9a25a, 0.7);
    this.fence.strokePoints(pts, true);
  }

  private furnScreen(f: { itemId: string; x: number; y: number; rot: number }) {
    const an = isoFurnAnchor(f.itemId, f.rot);
    const p = this.iso(f.x, f.y);
    return { x: p.x - an.x, y: p.y - an.y, an };
  }

  private drawFurniture() {
    const s = store.s;
    this.furnObjs.forEach((o) => o.destroy());
    this.furnObjs = [];
    for (const f of s.base.furniture) {
      const def = FURNITURE[f.itemId];
      if (!def) continue;
      const fp = footprint(f.itemId, f.rot);
      const { x, y } = this.furnScreen(f);
      const rug = def.layer === 'rug';
      // 깊이: 가장 앞쪽 칸 기준
      const depth = rug ? 50 : this.depthOf(f.x + fp.w - 1, f.y + fp.h - 1, 2);
      const custom = this.textures.exists(def.sprite + '_iso') ? def.sprite + '_iso' : isoFurnKey(f.itemId, f.rot);
      this.furnObjs.push(this.add.image(x, y, custom).setOrigin(0, 0).setDepth(depth));
      // 위면 중앙
      const c = this.iso(f.x + fp.w / 2, f.y + fp.h / 2);
      const topY = c.y - (isoFurnAnchor(f.itemId, f.rot).H - 40);
      f.props.forEach((p, i) => {
        const n = f.props.length;
        const off = (i - (n - 1) / 2) * 14;
        const key = `prop_${p}`;
        const obj = this.textures.exists(key)
          ? this.add.image(c.x + off, topY - 6, key)
          : this.add.text(c.x + off, topY - 4, ITEMS[p]?.icon ?? '?', { fontSize: '14px' }).setOrigin(0.5, 1);
        this.furnObjs.push(obj.setDepth(depth + 0.5));
      });
      if (def.production && f.prod) {
        let label = '';
        if (f.prod.stored > 0) label = `${ITEMS[def.production.output].icon}${f.prod.stored}`;
        else if (def.production.needsSeed) label = f.prod.planted ? '🌱' : '';
        if (label)
          this.furnObjs.push(
            this.add.text(c.x, topY - 6, label, { fontSize: '13px', fontFamily: FONT, color: '#fff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(depth + 0.6),
          );
      }
      if (f.ownerId && s.characters[f.ownerId]) {
        this.furnObjs.push(
          this.add
            .text(c.x, c.y + 8, s.characters[f.ownerId].name, { fontSize: '10px', fontFamily: FONT, color: '#ffe9a8', stroke: '#000', strokeThickness: 3 })
            .setOrigin(0.5, 0)
            .setResolution(2)
            .setDepth(depth + 0.7),
        );
      }
    }
  }

  private drawDarkness() {
    const s = store.s;
    const h = hourOf(s.time);
    const table = [0.62, 0.62, 0.62, 0.62, 0.6, 0.45, 0.25, 0.08, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.06, 0.18, 0.32, 0.45, 0.55, 0.6, 0.62];
    const a = Math.max(0.16, table[h] * 1.15);
    const rt = this.darkRT;
    rt.clear();
    rt.fill(a > 0.35 ? 0x020308 : 0x0a1210, a);
    for (const f of s.base.furniture) {
      const def = FURNITURE[f.itemId];
      const fp = footprint(f.itemId, f.rot);
      const c = this.iso(f.x + fp.w / 2, f.y + fp.h / 2);
      if (def?.light) rt.erase('light_big', c.x - 120, c.y - 130);
      else if (f.itemId === 'f_stove' || f.itemId === 'f_gas_range') rt.erase('light_small', c.x - 48, c.y - 60);
      if (f.props.includes('p_candle')) rt.erase('light_small', c.x - 48, c.y - 60);
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
        start = this.tileOf(ex);
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
    const ring = this.add.ellipse(0, 0, 28, 12).setStrokeStyle(2, 0xffd84a).setVisible(false);
    const name = this.add
      .text(0, -36, c.name, { fontSize: '12px', fontFamily: FONT, color: '#d9d2c0', stroke: '#000000', strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setResolution(2);
    const gx = at.x + 0.5;
    const gy = at.y + 0.5;
    const p = this.iso(gx, gy);
    const root = this.add.container(p.x, p.y, [shadow, ring, body, name]);
    root.setDepth(this.depthOf(gx, gy, 3));
    return {
      id: c.id, root, body, legs, name, ring, gx, gy, path: [], pose: 'stand', pendingPose: 'stand', seat: null,
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
    return { x: Math.floor(a.gx), y: Math.floor(a.gy) };
  }

  private setPose(a: Actor, pose: Pose) {
    a.pose = pose;
    a.body.setAngle(pose === 'sleep' ? -70 : 0);
    a.body.setPosition(pose === 'sleep' ? -6 : 0, pose === 'sit' ? 2 : pose === 'sleep' ? -2 : 0);
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
      .setOrigin(0.5, 1)
      .setResolution(2);
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
    a.bubble = this.add.container(a.root.x, a.root.y - 46, [bg, t]).setDepth(7000);
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
        a.legs.setY(-5 + Math.sin(time / 70) * 1.2);
        // 화면상 좌우 방향
        const sx = dx - dy;
        if (Math.abs(sx) > 0.01) a.body.setScale(sx < 0 ? -1 : 1, 1);
      } else if (time > a.nextThink) {
        a.seat = a.pose === 'stand' ? null : a.seat;
        this.think(a, c);
      }
      const p = this.iso(a.gx, a.gy);
      // 가구 위(앉기/눕기)일 때는 살짝 위로
      const lift = a.pose === 'sit' ? 10 : a.pose === 'sleep' ? 12 : 0;
      a.root.setPosition(p.x, p.y - lift);
      a.root.setDepth(this.depthOf(a.gx, a.gy, a.pose === 'stand' ? 3 : 4));
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
    const g = this.toGrid(p.worldX, p.worldY);
    return { x: Math.floor(g.gx), y: Math.floor(g.gy) };
  }

  private inBounds(t: P) {
    const b = store.s.base;
    return t.x >= 0 && t.y >= 0 && t.x < b.width && t.y < b.height;
  }

  /** (x, y)에서 w × h 칸을 덮는 마름모 */
  private regionPts(x: number, y: number, w: number, h: number) {
    return [this.iso(x, y), this.iso(x + w, y), this.iso(x + w, y + h), this.iso(x, y + h)];
  }

  private drawHover(t: P, w: number, h: number, color: number, alpha: number) {
    this.hover.clear();
    if (!this.inBounds(t)) return;
    const pts = this.regionPts(t.x, t.y, w, h);
    this.hover.fillStyle(color, alpha).fillPoints(pts, true);
    this.hover.lineStyle(1, 0xffffff, 0.6).strokePoints(pts, true);
  }

  private onPointerMove(p: Phaser.Input.Pointer) {
    const t = this.tileAt(p);
    this.hoverTile = t;
    this.refreshGhost();
    if (this.painting && p.isDown) this.paint(t);
  }

  private onPointerDown(p: Phaser.Input.Pointer) {
    const t = this.tileAt(p);
    const tool = toolStore.get();
    if (p.rightButtonDown()) {
      if (tool.kind === 'place' || tool.kind === 'move') this.rotateTool();
      else toolStore.set({ kind: 'view' });
      return;
    }
    if (tool.kind === 'view') return this.clickView(p, t);
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
    let bestD = 18;
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
      const def = FURNITURE[tool.itemId];
      if (!def) return;
      const fp = footprint(tool.itemId, tool.rot);
      const ok = canPlace(tool.itemId, t.x, t.y, tool.rot, tool.kind === 'move' ? tool.uid : undefined);
      const sc = this.furnScreen({ itemId: tool.itemId, x: t.x, y: t.y, rot: tool.rot });
      this.ghost
        .setTexture(isoFurnKey(tool.itemId, tool.rot))
        .setPosition(sc.x, sc.y)
        .setTint(ok ? 0x88ff88 : 0xff6666)
        .setVisible(this.inBounds(t));
      this.drawHover(t, fp.w, fp.h, ok ? 0x44ff44 : 0xff4444, 0.2);
      return;
    }
    this.ghost.setVisible(false);
    if (tool.kind === 'build') {
      const ok = canAfford(BUILD_BY_ID[tool.buildId]?.cost ?? []) && inClaimed(store.s.base, t.x, t.y);
      this.drawHover(t, 1, 1, ok ? 0x44ff44 : 0xff4444, 0.3);
    } else if (tool.kind === 'demolish') {
      this.drawHover(t, 1, 1, 0xff8844, 0.3);
    } else {
      this.drawHover(t, 1, 1, 0xffffff, 0.1);
    }
  }

  private refreshSelectBox() {
    this.selectG.clear();
    const f = this.selectedFurniture ? store.s.base.furniture.find((x) => x.uid === this.selectedFurniture) : null;
    if (!f) return;
    const fp = footprint(f.itemId, f.rot);
    this.selectG.lineStyle(2, 0xffd84a, 1).strokePoints(this.regionPts(f.x, f.y, fp.w, fp.h), true);
  }
}

