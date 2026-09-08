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

    const config = createPhaserConfig(containerRef.current);
    gameRef.current = new Phaser.Game(config);

    return () => {
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
