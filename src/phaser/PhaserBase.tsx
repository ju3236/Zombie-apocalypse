import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { store } from '../game/store';
import { BaseScene, isoCanvasSize } from './BaseScene';

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
    // 도트 폰트가 로드된 뒤 캔버스 텍스트를 그린다
    void Promise.race([document.fonts.load('12px Galmuri11'), new Promise((r) => setTimeout(r, 1500))]).then(() => {
      if (cancelled) return;
      const b = store.s.base;
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent,
        ...isoCanvasSize(b.width, b.height),
        backgroundColor: '#0b0d0b',
        render: { antialias: true, roundPixels: true },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: [BaseScene],
        banner: false,
        fps: { target: 30, limit: 30 },
      });
      gameRef.current = game;
      // Phaser 는 ready 직후에 루프를 시작하므로, 첫 프레임 뒤에 현재 표시 상태를 반영한다
      game.events.once('poststep', () => {
        if (!visibleRef.current) game?.loop.sleep();
      });
    });
    return () => {
      cancelled = true;
      game?.destroy(true);
      gameRef.current = null;
    };
  }, []);
  return <div ref={ref} className="phaser-host" />;
}
