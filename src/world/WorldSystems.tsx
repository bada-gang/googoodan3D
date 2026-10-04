/**
 * 모든 장면이 함께 쓰는 것: 카메라, 해, 입력.
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, PMREMGenerator, Vector3, type DirectionalLight, type HemisphereLight, type Object3D } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PALETTE } from '@/config/artTokens';
import { gameEvents } from '@/bridge/eventBus';
import { daylight } from './core/dayNight';
import { input, player, resetInput } from './core/runtime';
import { useWorldScene } from './core/scenes';
import { SUN_OFFSET } from './core/sun';
import { TEST_FLAGS } from './core/testFlags';

/** 캐릭터에서 카메라까지 (뒤쪽 위). 동물의 숲처럼 비스듬히 내려다본다 */
const CAMERA_OFFSET = new Vector3(0, 5.6, 7.6);
/** 캐릭터보다 조금 위를 본다 (머리가 화면 가운데쯤) */
const LOOK_OFFSET = new Vector3(0, 0.9, 0);
/** 카메라가 따라붙는 빠르기. 너무 빠르면 어지럽고 느리면 캐릭터가 화면 밖으로 나간다 */
const FOLLOW = 5;

export function CameraRig(): null {
  const camera = useThree((s) => s.camera);
  const look = useRef(new Vector3());
  const first = useRef(true);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 20);
    const desired = player.position.clone().add(CAMERA_OFFSET);
    const lookAt = player.position.clone().add(LOOK_OFFSET);
    if (first.current) {
      // 처음에는 바로 그 자리에. 날아오는 카메라는 시작부터 어지럽다
      camera.position.copy(desired);
      look.current.copy(lookAt);
      first.current = false;
    } else {
      const k = 1 - Math.exp(-FOLLOW * dt);
      camera.position.lerp(desired, k);
      look.current.lerp(lookAt, k);
    }
    camera.lookAt(look.current);
  });
  return null;
}

/**
 * 해와 하늘빛. 해는 왼쪽 위 — 그림자는 오른쪽 아래로 떨어진다. (ART_DIRECTION 4)
 * 그림자 범위를 캐릭터 둘레로만 잡고 캐릭터를 따라 옮긴다. 태블릿에서 넓은 그림자 지도는 무겁다.
 */
const SUN_INTENSITY = 1.8;
const SKY_INTENSITY = 0.55;
const ENV_INTENSITY = 0.3;
const indoorColor = new Color();

/** 그림자를 계산하는 범위 (그림자 상자 가운데에서 ±m). 넓을수록 그릴 물체가 많아진다 */
const SHADOW_RANGE = 9;
/** 그림자 상자를 캐릭터보다 화면 위쪽으로 당기는 거리 (m) */
const SHADOW_AHEAD = 3;
/** 그림자를 몇 프레임에 한 번 다시 그리나 */
const SHADOW_EVERY = 2;

export function Sun(): React.ReactElement {
  const light = useRef<DirectionalLight>(null);
  const sky = useRef<HemisphereLight>(null);
  const target = useRef<Object3D>(null);
  const scene = useThree((s) => s.scene);
  const indoor = useWorldScene((s) => s.scene === 'HomeScene');

  useEffect(() => {
    if (light.current && target.current) light.current.target = target.current;
  }, []);

  // 그림자는 2프레임에 한 번 다시 그린다. 그림자 그리기는 물체를 한 번 더 그리는 일이라 태블릿에 무겁다.
  // 빨리 움직일 때 그림자가 한 프레임 늦게 따라오지만 눈에 거의 띄지 않는다
  const gl = useThree((s) => s.gl);
  const frame = useRef(0);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);

  useFrame(() => {
    frame.current += 1;
    if (frame.current % SHADOW_EVERY === 0) gl.shadowMap.needsUpdate = true;

    // 그림자 상자는 캐릭터보다 화면 위쪽(-z)으로 당긴다. 카메라가 남쪽에서 북쪽을 내려다봐서
    // 화면에 보이는 땅은 대부분 캐릭터 앞(-z)에 있다
    const p = player.position;
    const cz = p.z - SHADOW_AHEAD;
    light.current?.position.set(p.x + SUN_OFFSET.x, SUN_OFFSET.y, cz + SUN_OFFSET.z);
    target.current?.position.set(p.x, 0, cz);

    // 밤낮 (core/dayNight). 밤에도 나무 · 동물이 구별되게 너무 어둡게 하지 않는다. 집 안은 조금만
    const d = daylight.darkness * (indoor ? 0.35 : 1);
    if (light.current) {
      light.current.intensity = SUN_INTENSITY * (1 - 0.65 * d);
      light.current.color.copy(indoor ? indoorColor.set('#ffffff').lerp(daylight.sunColor, 0.35) : daylight.sunColor);
    }
    if (sky.current) {
      sky.current.intensity = SKY_INTENSITY * (1 - 0.25 * d);
      if (!indoor) {
        sky.current.color.copy(daylight.skyLight);
        sky.current.groundColor.copy(daylight.groundLight);
      }
    }
    // 주변광(흰 방 반사)은 밤에 많이 줄인다. 남아 있으면 달빛 파랑이 회색으로 바랜다
    scene.environmentIntensity = ENV_INTENSITY * (1 - 0.8 * d);
  });

  return (
    <>
      <hemisphereLight ref={sky} args={[PALETTE.skyTop, PALETTE.grassShade, SKY_INTENSITY]} />
      <directionalLight
        ref={light}
        intensity={SUN_INTENSITY}
        castShadow={!TEST_FLAGS.noShadow}
        shadow-mapSize={[512, 512]}
        shadow-camera-left={-SHADOW_RANGE}
        shadow-camera-right={SHADOW_RANGE}
        shadow-camera-top={SHADOW_RANGE}
        shadow-camera-bottom={-SHADOW_RANGE}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
      />
      <object3D ref={target} />
    </>
  );
}


/** 조이스틱(React UI 에서 오는 이벤트)과 키보드를 runtime.input 에 옮긴다 */
export function InputSystem(): null {
  useEffect(() => {
    resetInput();
    const offStick = gameEvents.on('move:vector', (vector) => {
      input.stick = vector;
    });
    const isTyping = (event: KeyboardEvent) =>
      event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    const down = (event: KeyboardEvent) => {
      if (isTyping(event)) return;
      input.keys.add(event.code);
    };
    const up = (event: KeyboardEvent) => input.keys.delete(event.code);
    // 창을 벗어나면 뗀 키 이벤트를 못 받는다. 계속 걸어가지 않게 비운다
    const blur = () => input.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      offStick();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      resetInput();
    };
  }, []);
  return null;
}

/**
 * 은은한 주변 반사광. 방 안처럼 사방에서 오는 부드러운 빛이라, 점토 재질에 입체감을 준다.
 * 바깥 파일(HDR)을 받지 않고 그 자리에서 한 번 만든다.
 */
export function SoftEnvironment({ intensity = 0.3 }: { intensity?: number }): null {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const texture = pmrem.fromScene(room, 0.04).texture;
    scene.environment = texture;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
      texture.dispose();
      room.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, intensity]);
  return null;
}
