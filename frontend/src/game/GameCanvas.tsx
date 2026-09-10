import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { createPhaserConfig } from './config';

interface Props {
  style?: React.CSSProperties;
}

export function GameCanvas({ style }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;
    const container = containerRef.current;

    // Delay one frame so Telegram WebApp.expand() has time to resize the viewport
    // before Phaser reads window.innerWidth/innerHeight for initial canvas size.
    const raf = requestAnimationFrame(() => {
      if (!container || gameRef.current) return;
      const config = createPhaserConfig(container);
      gameRef.current = new Phaser.Game(config);
    });

    return () => {
      cancelAnimationFrame(raf);
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed', inset: 0, width: '100%', height: '100%',
        ...style,
      }}
    />
  );
}
