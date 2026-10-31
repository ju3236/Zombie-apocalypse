import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { store } from '../game/store';
import { BaseScene } from './BaseScene';
import { T } from './textures';

/** 거점 2D 화면. 탭을 바꿔도 게임 인스턴스는 유지된다. */
export function PhaserBase() {
  const ref = useRef<HTMLDivElement>(null);
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
        width: b.width * T,
        height: b.height * T,
        backgroundColor: '#0b0d0b',
        render: { antialias: true, roundPixels: true },
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        scene: [BaseScene],
        banner: false,
      });
    });
    return () => {
      cancelled = true;
      game?.destroy(true);
    };
  }, []);
  return <div ref={ref} className="phaser-host" />;
}
