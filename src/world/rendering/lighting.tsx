/**
 * 빛: 해(그림자 포함) · 하늘빛 · 은은한 주변 반사광(환경맵). 밤낮 색은 rendering/dayNight 에서 받는다.
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, PMREMGenerator, Vector3, type DirectionalLight, type HemisphereLight, type Object3D } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PALETTE } from '@/config/artTokens';
import { TEST_FLAGS } from '../debug/testFlags';
import { player } from '../state/runtime';
import { useWorldScene } from '../state/scenes';
import { isIndoorScene } from '../state/sceneStore';
import { daylight } from './dayNight';
import { setShadowProxiesVisible, useShadowProxyGate } from './shadowProxies';

/**
 * 해의 방향. 해는 늘 같은 방향(화면 왼쪽 위 뒤쪽)에서 비춘다 — 시간에 따라 바뀌는 것은 색과 밝기뿐이다.
 * 방향이 고정이라 움직이지 않는 물체의 그림자를 미리 그려 둘 수 있다 (rendering/bakedShadows).
 */
/** 그림자 중심에서 해까지 (m). 실시간 그림자의 해 위치와 미리 그리는 그림자의 방향에 같이 쓴다 */
export const SUN_OFFSET = new Vector3(-8, 14, 6);

/**
 * 해와 하늘빛. 해는 왼쪽 위 — 그림자는 오른쪽 아래로 떨어진다. (ART_DIRECTION 4)
 * 그림자 범위를 캐릭터 둘레로만 잡고 캐릭터를 따라 옮긴다. 태블릿에서 넓은 그림자 지도는 무겁다.
 */
const SUN_INTENSITY = 1.8;
const SKY_INTENSITY = 0.55;
const ENV_INTENSITY = 0.3;
const indoorColor = new Color();

/** 장면마다 빛 배율 (1 = 그대로). 마굿간은 약간 어둡게 */
const NO_DIM = { sun: 1, sky: 1, env: 1 };
const BARN_LIGHT = { sun: 0.5, sky: 0.45, env: 0.5 };
/** 마굿간 햇빛 색: 짚빛이 도는 따뜻한 색 */
const BARN_SUN_COLOR = '#ffd9a6';

/** 그림자를 계산하는 범위 (그림자 상자 가운데에서 ±m). 넓을수록 그릴 물체가 많아진다 */
const SHADOW_RANGE = 7;
/** 그림자 상자를 캐릭터보다 화면 위쪽으로 당기는 거리 (m) */
const SHADOW_AHEAD = 3;

export function Sun(): React.ReactElement {
  const light = useRef<DirectionalLight>(null);
  const sky = useRef<HemisphereLight>(null);
  const target = useRef<Object3D>(null);
  const scene = useThree((s) => s.scene);
  const indoor = useWorldScene((s) => isIndoorScene(s.scene));
  const barn = useWorldScene((s) => s.scene === 'BarnScene');

  useEffect(() => {
    if (light.current && target.current) light.current.target = target.current;
  }, []);

  // 그림자 사본을 그림자 그리는 동안만 켜는 물체 (rendering/shadowProxies)
  const gate = useShadowProxyGate();

  // 그림자는 매 프레임 다시 그린다. 2프레임에 한 번 그렸더니 그림자가 한 박자 늦게 따라와
  // 걸을 때 캐릭터가 2~3개 겹쳐 보였다 (태블릿에서 확인)
  useFrame(() => {
    setShadowProxiesVisible(false);

    // 그림자 상자는 캐릭터보다 화면 위쪽(-z)으로 당긴다. 카메라가 남쪽에서 북쪽을 내려다봐서
    // 화면에 보이는 땅은 대부분 캐릭터 앞(-z)에 있다.
    // 집 안은 카메라가 방 전체를 고정해서 비추므로, 그림자 상자도 방 가운데에 고정한다 (방이 통째로 들어간다)
    const p = player.position;
    const cx = indoor ? 0 : p.x;
    const cz = indoor ? 0 : p.z - SHADOW_AHEAD;
    light.current?.position.set(cx + SUN_OFFSET.x, SUN_OFFSET.y, cz + SUN_OFFSET.z);
    target.current?.position.set(cx, 0, cz);

    // 밤낮 (rendering/dayNight). 밤에도 나무 · 동물이 구별되게 너무 어둡게 하지 않는다. 집 안은 조금만
    const d = daylight.darkness * (indoor ? 0.35 : 1);
    // 마굿간은 약간 어둡고 따뜻하게 (햇빛은 창 · 판자 틈으로만 들어오는 느낌, scenes/barn)
    const dim = barn ? BARN_LIGHT : NO_DIM;
    if (light.current) {
      light.current.intensity = SUN_INTENSITY * (1 - 0.65 * d) * dim.sun;
      if (barn) light.current.color.copy(indoorColor.set(BARN_SUN_COLOR).lerp(daylight.sunColor, 0.35));
      else light.current.color.copy(indoor ? indoorColor.set('#ffffff').lerp(daylight.sunColor, 0.35) : daylight.sunColor);
    }
    if (sky.current) {
      sky.current.intensity = SKY_INTENSITY * (1 - 0.25 * d) * dim.sky;
      if (!indoor) {
        sky.current.color.copy(daylight.skyLight);
        sky.current.groundColor.copy(daylight.groundLight);
      }
    }
    // 주변광(흰 방 반사)은 밤에 많이 줄인다. 남아 있으면 달빛 파랑이 회색으로 바랜다
    scene.environmentIntensity = ENV_INTENSITY * (1 - 0.8 * d) * dim.env;
  });

  return (
    <>
      {/* 그림자 사본을 켜는 물체. 장면에서 가장 먼저 그림자를 그리도록 맨 앞에 둔다 */}
      {/* 실내(집 안 · 마굿간)는 실시간 그림자가 없어 이 물체도 필요 없다 */}
      <primitive object={gate} visible={!indoor} />
      <hemisphereLight ref={sky} args={[PALETTE.skyTop, PALETTE.grassShade, SKY_INTENSITY]} />
      <directionalLight
        ref={light}
        intensity={SUN_INTENSITY}
        // 실내는 실시간 그림자를 끈다: 캐릭터는 발밑 동그란 그림자(player/BlobShadow), 물건은 미리 구운 그림자
        castShadow={!TEST_FLAGS.noShadow && !indoor}
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
