/**
 * 3D 월드의 뿌리. 캔버스 설정과 지금 보여줄 장면을 고른다.
 *
 * 태블릿 성능을 위해 화면 배율(dpr)을 1 로 고정한다 (화질 "보통"). 레티나 태블릿의 2~3배를 그대로 쓰면
 * 픽셀 수가 4~9배가 되어 프레임이 떨어진다. 프레임에 따라 화질을 바꾸던 장치는 사용자 요청으로 뺐다.
 */
import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PALETTE } from '@/config/artTokens';
import { gameEvents } from '@/bridge/eventBus';
import { FURNITURE } from '@/config/catalog';
import { useGameStore } from '@/state/gameStore';
import { decorateFloorHover, decorateFloorTap, useDecorate } from './core/decorate';
import { DayNightSystem, NightStars } from './core/dayNight';
import { EffectsLayer } from './core/effects';
import { InteractionSystem } from './core/interaction';
import { input, obstacles, player } from './core/runtime';
import { Player } from './Player';
import { HomeWorld } from './scenes/HomeWorld';
import { TownWorld } from './scenes/TownWorld';
import { YardWorld } from './scenes/YardWorld';
import { resetWorldScene, useWorldScene } from './core/scenes';
import { CameraRig, InputSystem, SoftEnvironment, Sun } from './WorldSystems';

/** 집 안에서 벽 너머로 보이는 빈 곳의 색 (하늘이 보이면 어색하다) */
const INDOOR_BACKGROUND = '#efe2cc';

export default function WorldRoot(): React.ReactElement {
  const scene = useWorldScene((s) => s.scene);

  useEffect(() => {
    // 게임 화면에 들어올 때는 마당에서 시작한다. 장면이 준비되면 HUD 가 뜬다 (useGameBridge 가 booting 을 끈다)
    resetWorldScene();
    gameEvents.emit('scene:changed', { sceneKey: 'YardScene' });
    if (import.meta.env.DEV) {
      // 개발 중 콘솔에서 캐릭터 위치·입력을 들여다볼 수 있게 해 둔다.
      (window as unknown as { __googooWorld?: unknown }).__googooWorld = {
        player,
        input,
        obstacles,
        // 게임이 실제로 쓰는 것과 같은 것 (콘솔에서 import 하면 개발 서버가 다른 사본을 줄 수 있다)
        store: useGameStore,
        scene: useWorldScene,
        decorate: { tap: decorateFloorTap, hover: decorateFloorHover, state: useDecorate },
        events: gameEvents,
      };
      // 주소에 ?dev-animals 를 붙이면 동물을 한 마리씩 넣어 준다 (시장이 생기기 전 시험용)
      // ?dev-furniture 면 가구 · 장식을 하나씩 가방에 넣어 준다 (시장이 생기기 전 꾸미기 시험용)
      if (new URLSearchParams(window.location.search).has('dev-furniture')) {
        const store = useGameStore.getState();
        for (const item of FURNITURE) {
          if (store.itemCount(item.id) === 0) useGameStore.getState().addItem(item.id);
        }
      }
      if (new URLSearchParams(window.location.search).has('dev-animals')) {
        const store = useGameStore.getState();
        for (const species of ['chicken', 'goat', 'sheep', 'cow'] as const) {
          if (!store.animals.some((a) => a.species === species)) useGameStore.getState().addAnimal(species);
        }
      }
      // ?dev-ready 면 밭마다 열매가 열리고(빈 밭엔 사과나무) 동물은 생산물이 준비된다 (수확 소리 · 연출 시험용)
      if (new URLSearchParams(window.location.search).has('dev-ready')) {
        useGameStore.setState((s) => ({
          plots: s.plots.map((plot) => ({
            ...plot,
            species: plot.species ?? 'apple',
            stage: 'fruiting',
            fruitCount: Math.max(plot.fruitCount, 5),
          })),
          animals: s.animals.map((animal) => ({ ...animal, produceReady: true })),
        }));
      }
    }
  }, []);

  return (
    <Canvas
      dpr={1}
      shadows
      camera={{ position: [0, 9, 12], fov: 40, near: 0.5, far: 120 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      style={{ background: PALETTE.skyBottom }}
    >
      {/* key 를 나눠야 바깥 · 집 안 배경이 각자 따로 만들어진다. 같은 자리라 하나를 같이 쓰면
          밤낮이 칠한 하늘색(노을 · 밤)이 집 안 배경에 남는다 */}
      {scene === 'HomeScene' ? (
        <color key="indoor" attach="background" args={[INDOOR_BACKGROUND]} />
      ) : (
        <>
          <color key="outdoor" attach="background" args={[PALETTE.skyTop]} />
          <fog attach="fog" args={[PALETTE.skyBottom, 26, 60]} />
        </>
      )}

      <Sun />
      <SoftEnvironment />
      {/* 밤낮: 장면이 바뀌면 바로 그 장면의 하늘색으로 */}
      <DayNightSystem key={`daynight_${scene}`} outdoor={scene !== 'HomeScene'} />
      {scene !== 'HomeScene' && <NightStars />}
      {/* 장면이 바뀌면 카메라를 새 자리로 바로 옮긴다 (날아가면 어지럽다) */}
      <CameraRig key={`camera_${scene}`} />
      <InputSystem />
      <InteractionSystem />

      {scene === 'YardScene' && <YardWorld />}
      {scene === 'HomeScene' && <HomeWorld />}
      {scene === 'TownScene' && <TownWorld />}
      <Player />
      <EffectsLayer />
      {import.meta.env.DEV && <DevHandle />}
    </Canvas>
  );
}

/** 개발 중 콘솔에서 프레임을 직접 돌려 볼 수 있게 한다 (화면이 숨겨진 창에서 시험할 때) */
function DevHandle(): null {
  const state = useThree();
  useEffect(() => {
    (window as unknown as { __googooR3f?: unknown }).__googooR3f = state;
  }, [state]);
  return null;
}
