import { useEffect } from 'react';
import { eventBus } from '@/game/EventBus';
import { soundManager } from '@/sounds/SoundManager';

export function SoundSystem() {
  useEffect(() => {
    return eventBus.on('play-sound', (id) => soundManager.play(id));
  }, []);
  return null;
}
