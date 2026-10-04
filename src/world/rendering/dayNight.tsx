/**
 * 밤낮을 3D 화면에 입힌다. 시각 계산은 config/dayNight.ts (12분 순환, 벽시계 기준).
 *
 * 2D 판은 화면 위에 반투명 색을 덮었다. 3D 판은 덮지 않고 빛을 바꾼다:
 *  - 바깥: 하늘 · 안개 색, 햇빛 색과 세기, 밤에는 별
 *  - 집 안: 빛만 조금 어두워진다 (창문 유리는 바깥 하늘색)
 *  - 가로등 · 스탠드는 밤에 은은하게 빛난다 (NightGlow)
 * 밤에도 나무 종류와 동물이 구별돼야 한다 — 2D 판에서 덮개 진하기 0.46 이 한계였고, 같은 표에서 값을 가져온다.
 *
 * 값은 0.25초마다 한 번 계산해 daylight 에 두고, 해 · 하늘 · 빛나는 것들이 매 프레임 읽는다.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  type Points,
  type PointsMaterial,
  type Sprite,
  type SpriteMaterial,
} from 'three';
import { PALETTE } from '@/config/artTokens';
import { SUNSET_LIGHT, cycleNow, starAlphaAt, tintAt } from '@/config/dayNight';
import { player } from '../state/runtime';

/** 2D 판 덮개의 가장 진한 값 (한밤) */
const NIGHT_ALPHA = 0.46;

const DAY_SKY = new Color(PALETTE.skyTop);
const DAY_FOG = new Color(PALETTE.skyBottom);
const WHITE = new Color('#ffffff');
const DAY_GROUND = new Color(PALETTE.grassShade);
/** 밤빛: 해 대신 달, 하늘빛 · 땅빛도 푸르게 */
const MOON = new Color('#9fb4ee');
const NIGHT_SKY_LIGHT = new Color('#6a80c8');
const NIGHT_GROUND_LIGHT = new Color('#2e3b63');

/** 지금 빛 상태. DayNightSystem 이 채우고 다른 것들이 읽는다 */
export const daylight = {
  /** 어두운 정도 0(낮) ~ 1(한밤) */
  darkness: 0,
  /** 밤 0~1 (노을이 끝나 갈 때부터). 달빛으로 바뀌는 정도 */
  night: 0,
  /** 밤 불빛 진하기 0~1 (노을 중간부터 켜진다) */
  glow: 0,
  /** 별 진하기 0~1 */
  stars: 0,
  sky: DAY_SKY.clone(),
  fog: DAY_FOG.clone(),
  /** 햇빛 · 하늘빛 색 */
  sunColor: WHITE.clone(),
  skyLight: DAY_SKY.clone(),
  groundLight: new Color(PALETTE.grassShade),
};

const tint = new Color();

function update(ms: number): void {
  const { color, alpha } = tintAt(ms);
  tint.setHex(color);
  const darkness = Math.min(1, alpha / NIGHT_ALPHA);
  daylight.darkness = darkness;
  // 노을 중간(덮개 0.15)부터 켜져서 밤(0.4)에 다 켜진다
  daylight.glow = Math.min(1, Math.max(0, (alpha - 0.15) / 0.25));
  daylight.stars = starAlphaAt(ms);
  // 하늘은 덮개 색으로 꽤 많이 (노을은 주황, 밤은 남색), 빛은 그보다 덜
  daylight.sky.copy(DAY_SKY).lerp(tint, Math.min(1, alpha * 2.1));
  daylight.fog.copy(DAY_FOG).lerp(tint, Math.min(1, alpha * 2.1));
  // 노을빛은 덮개 색(주황)으로, 밤에는 맑은 달빛 파랑으로. 남색을 섞기만 하면 어둡고 칙칙한 흐린 날처럼 보인다
  const night = Math.min(1, Math.max(0, (alpha - 0.3) / (NIGHT_ALPHA - 0.3)));
  daylight.night = night;
  daylight.sunColor.copy(WHITE).lerp(tint, Math.min(1, alpha * 1.6 * SUNSET_LIGHT)).lerp(MOON, night);
  daylight.skyLight.copy(DAY_SKY).lerp(tint, Math.min(1, alpha * 1.5 * SUNSET_LIGHT)).lerp(NIGHT_SKY_LIGHT, night);
  daylight.groundLight.copy(DAY_GROUND).lerp(NIGHT_GROUND_LIGHT, night);
}

update(cycleNow());

/** 장면 하나에 하나. 바깥이면 하늘 · 안개 색을 칠한다 */
export function DayNightSystem({ outdoor }: { outdoor: boolean }): null {
  const scene = useThree((s) => s.scene);
  const elapsed = useRef(0);

  const apply = () => {
    const ms = cycleNow();
    update(ms);
    if (outdoor) {
      if (scene.background instanceof Color) scene.background.copy(daylight.sky);
      if (scene.fog) scene.fog.color.copy(daylight.fog);
    }
    // 시간대가 바뀌어도 안내 문구는 띄우지 않는다 (사용자 요청)
  };

  useEffect(apply, [outdoor]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    // 12분에 걸쳐 변하는 색이라 0.25초마다 칠해도 계단이 보이지 않는다
    elapsed.current += delta;
    if (elapsed.current < 0.25) return;
    elapsed.current = 0;
    apply();
  });
  return null;
}

/* ---------------------------------- 별 ---------------------------------- */

const STAR_COUNT = 220;

/**
 * 밤하늘의 별. 카메라는 북쪽(-z)을 비스듬히 내려다보므로 화면 위쪽에 걸리는 북쪽 먼 하늘에 뿌린다.
 * 캐릭터를 따라다녀서 어디서 봐도 같은 자리에 있다.
 */
export function NightStars(): React.ReactElement {
  const points = useRef<Points>(null);
  const material = useRef<PointsMaterial>(null);
  const geometry = useMemo(() => {
    let seed = 11;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const positions: number[] = [];
    for (let i = 0; i < STAR_COUNT; i += 1) {
      positions.push((random() - 0.5) * 130, 6 + random() * 34, -42 - random() * 20);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    if (!points.current || !material.current) return;
    points.current.position.set(player.position.x, 0, player.position.z);
    // 반짝반짝: 전체 밝기를 아주 조금 흔든다
    const twinkle = 0.85 + Math.sin(performance.now() / 700) * 0.15;
    material.current.opacity = daylight.stars * twinkle;
    points.current.visible = daylight.stars > 0.01;
  });

  return (
    <points ref={points} geometry={geometry} renderOrder={-1}>
      <pointsMaterial
        ref={material}
        color="#fff8d6"
        size={0.55}
        sizeAttenuation
        transparent
        opacity={0}
        depthWrite={false}
        fog={false}
        toneMapped={false}
      />
    </points>
  );
}

/* -------------------------------- 밤 불빛 -------------------------------- */

let glowTextureCache: CanvasTexture | null = null;

/** 가운데가 밝고 가장자리로 갈수록 사라지는 따뜻한 빛 */
function glowTexture(): CanvasTexture {
  if (glowTextureCache) return glowTextureCache;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d')!;
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255, 236, 170, 1)');
  gradient.addColorStop(0.25, 'rgba(255, 214, 130, 0.6)');
  gradient.addColorStop(1, 'rgba(255, 190, 100, 0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  glowTextureCache = new CanvasTexture(canvas);
  return glowTextureCache;
}

/**
 * 밤에 등불 자리에 번지는 빛. 진짜 조명(point light)은 하나 늘 때마다 모든 물체가 무거워져서
 * 태블릿을 생각해 빛 번짐 그림으로 대신한다.
 */
export function NightGlow({ y, size }: { y: number; size: number }): React.ReactElement {
  const sprite = useRef<Sprite>(null);
  const material = useRef<SpriteMaterial>(null);
  useFrame(() => {
    if (!sprite.current || !material.current) return;
    sprite.current.visible = daylight.glow > 0.01;
    material.current.opacity = daylight.glow * 0.9;
  });
  return (
    <sprite ref={sprite} position-y={y} scale={size} visible={false}>
      <spriteMaterial
        ref={material}
        map={glowTexture()}
        transparent
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}
