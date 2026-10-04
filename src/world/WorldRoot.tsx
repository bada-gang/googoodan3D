/**
 * 3D 월드의 뿌리. 캔버스 설정과 지금 보여줄 장면을 고른다.
 *
 * 태블릿 성능을 위해 화면 배율(dpr)을 1 로 고정한다 (화질 "보통"). 레티나 태블릿의 2~3배를 그대로 쓰면
 * 픽셀 수가 4~9배가 되어 프레임이 떨어진다. 프레임에 따라 화질을 바꾸던 장치는 사용자 요청으로 뺐다.
 * 그림자 경계는 PCF (soft 보다 픽셀마다 그림자를 덜 읽는다).
 */
import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { PALETTE } from '@/config/artTokens';
import { gameEvents } from '@/bridge/eventBus';
import { DayNightSystem, NightStars } from './rendering/dayNight';
import { EffectsLayer } from './effects/effects';
import { InteractionSystem } from './systems/interaction';
import { Player } from './player/Player';
import { HomeWorld } from './scenes/home/HomeWorld';
import { TownWorld } from './scenes/town/TownWorld';
import { YardWorld } from './scenes/yard/YardWorld';
import { resetWorldScene, useWorldScene } from './state/scenes';
import { DevHandle, FrameCap, FrameCounter } from './debug/DebugTools';
import { DEBUG_HANDLES, setupDevTools } from './debug/devSetup';
import { TEST_FLAGS } from './debug/testFlags';
import { SoftEnvironment, Sun } from './rendering/lighting';
import { CameraRig } from './systems/CameraRig';
import { InputSystem } from './systems/InputSystem';

/** 집 안에서 벽 너머로 보이는 빈 곳의 색 (하늘이 보이면 어색하다) */
const INDOOR_BACKGROUND = '#efe2cc';

export default function WorldRoot(): React.ReactElement {
  const scene = useWorldScene((s) => s.scene);

  useEffect(() => {
    // 게임 화면에 들어올 때는 마당에서 시작한다. 장면이 준비되면 HUD 가 뜬다 (useGameBridge 가 booting 을 끈다)
    resetWorldScene();
    gameEvents.emit('scene:changed', { sceneKey: 'YardScene' });
    // 콘솔 손잡이 · 개발용 주소 옵션(?dev-animals 등) (debug/devSetup)
    setupDevTools();
  }, []);

  return (
    <Canvas
      dpr={1}
      // ?cap30 이면 직접 박자를 맞춰 그린다 (FrameCap)
      frameloop={TEST_FLAGS.cap30 ? 'never' : 'always'}
      shadows={TEST_FLAGS.noShadow ? false : 'percentage'}
      camera={{ position: [0, 9, 12], fov: 40, near: 0.5, far: 120 }}
      gl={{ antialias: !TEST_FLAGS.noAntialias, powerPreference: 'high-performance' }}
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
      <FrameCounter />
      {TEST_FLAGS.cap30 && <FrameCap fps={30} />}
      {(import.meta.env.DEV || DEBUG_HANDLES) && <DevHandle />}
    </Canvas>
  );
}
