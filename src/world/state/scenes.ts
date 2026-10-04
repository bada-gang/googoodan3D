/**
 * 지금 보이는 장면(마당 · 집 안)과 장면 바꾸기.
 *
 * 문을 지나면 화면이 크림색으로 잠깐 덮였다가(0.22초) 새 장면이 열린다. (2D 판 gotoScene 과 같다)
 * 3D 장면 안에서는 이 스토어만 보고, React UI 에는 scene:changed 이벤트로 알린다.
 */
import { gameEvents } from '@/bridge/eventBus';
import { audio } from '@/audio/sfx';
import { clearParticles } from '../effects/particles';
import { resetInput } from './runtime';
import { SCENE_FADE_MS, useWorldScene, type Spawn, type WorldSceneKey } from './sceneStore';

export { useWorldScene, type Spawn, type WorldSceneKey } from './sceneStore';

export function goToScene(scene: WorldSceneKey, spawn?: Spawn): void {
  const state = useWorldScene.getState();
  if (state.fading || state.scene === scene) return;
  audio.play('door');
  resetInput();
  useWorldScene.setState({ fading: true });
  window.setTimeout(() => {
    gameEvents.emit('interaction:changed', { prompts: [] });
    // 마당 흙먼지 · 별이 집 안에 남지 않게
    clearParticles();
    useWorldScene.setState({ scene, spawn: spawn ?? null });
    gameEvents.emit('scene:changed', { sceneKey: scene });
    // 새 장면이 한 번 그려진 뒤에 걷힌다
    window.setTimeout(() => useWorldScene.setState({ fading: false }), 60);
  }, SCENE_FADE_MS);
}

/** 게임 화면에 처음 들어올 때는 마당에서 시작한다 */
export function resetWorldScene(): void {
  useWorldScene.setState({ scene: 'YardScene', spawn: null, fading: false });
}

