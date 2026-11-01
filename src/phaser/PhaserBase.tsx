import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { BaseScene } from './BaseScene';
import { bus, toast } from '../game/bus';
import { addPhoto, shrink } from '../game/album';
import { store } from '../game/store';

/** 거점 2D 화면. 탭을 바꿔도 게임 인스턴스는 유지된다. */
export function PhaserBase({ visible = true }: { visible?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const visibleRef = useRef(visible);
  // 거점 화면이 안 보일 때는 렌더링을 멈춰 CPU/GPU 를 아낀다
  useEffect(() => {
    visibleRef.current = visible;
    const g = gameRef.current;
    if (!g) return;
    if (visible) g.loop.wake();
    else g.loop.sleep();
  }, [visible]);
  useEffect(() => {
    if (!ref.current) return;
    const parent = ref.current;
    let game: Phaser.Game | null = null;
    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let offSnap: (() => void) | null = null;
    // 도트 폰트가 로드된 뒤 캔버스 텍스트를 그린다
    void Promise.race([document.fonts.load('12px Galmuri11'), new Promise((r) => setTimeout(r, 1500))]).then(() => {
      if (cancelled) return;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent,
        width: Math.max(320, parent.clientWidth),
        height: Math.max(240, parent.clientHeight),
        backgroundColor: '#0b0d0b',
        pixelArt: true,
        render: { pixelArt: true, antialias: false, roundPixels: true },
        // 크기는 아래 ResizeObserver 가 맞춘다 (숨겨져 0이 될 때는 무시)
        scale: { mode: Phaser.Scale.NONE },
        scene: [BaseScene],
        banner: false,
        fps: { target: 30, limit: 30 },
      });
      gameRef.current = game;
      const g = game;
      ro = new ResizeObserver(() => {
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        if (w < 2 || h < 2) return;
        if (w !== g.scale.width || h !== g.scale.height) g.scale.resize(w, h);
      });
      ro.observe(parent);
      offSnap = bus.on('snapshot', ({ caption }) => {
        g.renderer.snapshot((img) => {
          if (!(img instanceof HTMLImageElement)) return;
          const done = () => {
            const s = store.s;
            addPhoto({ at: Date.now(), gameT: s.time, base: s.base.name, caption, data: shrink(img) });
            toast('📷 찰칵! 사진첩에 저장했다.', 'good');
          };
          if (img.complete) done();
          else img.onload = done;
        });
      });
      // Phaser 는 ready 직후에 루프를 시작하므로, 첫 프레임 뒤에 현재 표시 상태를 반영한다
      game.events.once('poststep', () => {
        if (!visibleRef.current) game?.loop.sleep();
      });
    });
    return () => {
      cancelled = true;
      ro?.disconnect();
      offSnap?.();
      game?.destroy(true);
      gameRef.current = null;
    };
  }, []);
  return <div ref={ref} className="phaser-host" />;
}
