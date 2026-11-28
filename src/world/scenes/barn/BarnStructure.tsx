/**
 * 마굿간 건물: 흙바닥과 짚 · 입구 밖 풀밭, 판자 벽(위는 지붕 그늘), 기둥 · 들보 · 창틀, 다락 창,
 * 입구(문틀 · 열린 붉은 문짝), 칸막이, 다락 바닥판, 사다리. 모두 코드로 만든 모양이다 (새 그림 없음).
 *
 * 그림자: 기둥 · 들보는 드리우지 않고, 칸막이 · 다락 · 사다리 · 문짝은 BarnWorld 의 StaticShadow 로 바닥에 한 번 굽는다.
 * 가볍게: 움직이지 않는 상자는 색(재질)마다 모양 하나로 합친다 (props/mergedBoxes).
 * 상자마다 그리면 그리기 호출이 상자 수만큼(그림자까지 두 배) 늘어 태블릿에서 무겁다.
 * 그래서 이 파일의 그리기는 바닥 · 짚 · 풀밭 · 벽 2 · 들보 · 나무 · 판자 틈 빛 · 다락 창 풍경 · 문짝 · 문 무늬 · 사다리 = 12번이다.
 * 자리 · 색은 barnLayout.ts.
 */
import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Color, PlaneGeometry, type BufferGeometry, type Material, type MeshBasicMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE } from '@/config/artTokens';
import { ASSETS } from '@/config/assets';
import { ArtTexture } from '../../rendering/assets';
import { daylight } from '../../rendering/dayNight';
import { applyGroundShadow } from '../../rendering/groundShadow';
import { mergedBoxGeometry, type BoxSpec } from '../../props/mergedBoxes';
import { WindowView } from '../../props/WindowView';
import {
  BACK_Z,
  COLORS,
  ENTRANCE,
  FRONT_EXTENSION,
  FRONT_Z,
  HALF_W,
  LOFT,
  LOFT_WINDOW,
  PLACE,
  ROOM,
  SLITS,
  STALL_FRONT_X,
  STALL_WALLS_Z,
  VISIBLE_WALL_HEIGHT,
  WALL_THICKNESS,
} from './barnLayout';

/* --------------------------------- 바닥 --------------------------------- */

/** 흙바닥(흙길 질감 × 색) + 흩어진 짚, 입구 밖은 밝은 풀밭 */
export function Floor({ onTap }: { onTap: (event: ThreeEvent<MouseEvent>) => void }): React.ReactElement {
  const straw = useMemo(() => strawGeometry(), []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow onClick={onTap}>
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
        <ArtTexture assetKey={ASSETS.textures.path} repeat={[ROOM.width / 2.5, ROOM.depth / 2.5]}>
          {/* 미리 그린 그림자를 바닥 재질 안에서 칠한다 (rendering/groundShadow) */}
          {(map) => <meshStandardMaterial ref={withBakedShadow} map={map} color={COLORS.floor} roughness={1} />}
        </ArtTexture>
      </mesh>
      <mesh geometry={straw} receiveShadow>
        <meshStandardMaterial ref={withBakedShadow} color={COLORS.straw} roughness={1} />
      </mesh>
      <mesh position={[0, -0.01, FRONT_Z + FRONT_EXTENSION / 2]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[ROOM.width + 8, FRONT_EXTENSION]} />
        <ArtTexture assetKey={ASSETS.textures.grass} repeat={[(ROOM.width + 8) / 3, FRONT_EXTENSION / 3]}>
          {(map) => <meshStandardMaterial map={map} color={map ? '#ffffff' : PALETTE.grassLight} roughness={1} />}
        </ArtTexture>
      </mesh>
    </group>
  );
}

/** 바닥 · 짚 재질에 미리 그린 그림자를 칠하게 한다 */
function withBakedShadow(material: Material | null): void {
  if (material) applyGroundShadow(material);
}

/** 바닥에 흩어진 짚 가닥. 매번 같은 자리 (씨앗 고정). 통로 가운데는 적게 */
function strawGeometry(): BufferGeometry {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const boxes: BoxSpec[] = [];
  for (let i = 0; i < 150; i++) {
    const x = (random() * 2 - 1) * (HALF_W - 0.3);
    const z = BACK_Z + 0.3 + random() * (ROOM.depth - 0.6);
    if (Math.abs(x) < 1.1 && random() < 0.65) continue;
    boxes.push({ x, y: 0.008, z, w: 0.22 + random() * 0.2, h: 0.012, d: 0.025, rotationY: random() * Math.PI });
  }
  return mergedBoxGeometry(boxes);
}

/* --------------------------------- 벽 --------------------------------- */

/** 판자 한 장 (가로 length · 세로 height), 판자 질감이 같은 크기로 깔리게 uv 를 늘린다 */
function plank(x: number, y: number, z: number, length: number, height: number, rotationY = 0): BoxSpec {
  return { x, y, z, w: length, h: height, d: WALL_THICKNESS, rotationY, uvRepeat: [length / 2, height / 1.2] };
}

/** 벽 판자들: 아래(지붕 밑까지, 입구 양옆 낮은 앞벽 포함) · 위(지붕 그늘) */
function wallGeometries(): { lower: BufferGeometry; upper: BufferGeometry } {
  const upperHeight = VISIBLE_WALL_HEIGHT - ROOM.wallHeight;
  const ring = (y: number, height: number) => [
    plank(0, y, BACK_Z, ROOM.width + WALL_THICKNESS, height),
    plank(-HALF_W, y, 0, ROOM.depth, height, Math.PI / 2),
    plank(HALF_W, y, 0, ROOM.depth, height, -Math.PI / 2),
  ];
  const frontLength = HALF_W - ENTRANCE.halfWidth;
  const front = [-1, 1].map((side) => plank(side * (ENTRANCE.halfWidth + frontLength / 2), 0.35, FRONT_Z, frontLength, 0.7));
  return {
    lower: mergedBoxGeometry([...ring(ROOM.wallHeight / 2, ROOM.wallHeight), ...front]),
    upper: mergedBoxGeometry(ring(ROOM.wallHeight + upperHeight / 2, upperHeight)),
  };
}

/** 판자 벽 (그림자는 드리우지 않는다: 집 안과 같이 왼쪽 벽 그림자가 바닥을 덮는다) + 다락 창 빛 */
export function Walls(): React.ReactElement {
  const { lower, upper } = useMemo(wallGeometries, []);
  return (
    <group>
      {[
        { geometry: lower, color: COLORS.wall },
        { geometry: upper, color: COLORS.wallShade },
      ].map(({ geometry, color }) => (
        <mesh key={color} geometry={geometry} receiveShadow>
          {/* 집 안 바닥 판자 질감(흰 바탕)에 색을 곱한다. 반복은 uv 에 넣었다 */}
          <ArtTexture assetKey={ASSETS.textures.floor} repeat={[1, 1]}>
            {(map) => <meshStandardMaterial map={map} color={color} roughness={0.95} />}
          </ArtTexture>
        </mesh>
      ))}
      <WindowLight />
    </group>
  );
}

/**
 * 다락 창(풍경 그림, props/WindowView)과 판자 틈 2개의 빛(그대로: 낮에는 밝은 크림색, 밤에는 바깥 하늘색).
 * 다락 창에 그림이 들어가 판 하나가 늘었다 (그리기 1번)
 */
const WINDOW_DAY = new Color(COLORS.window);
function WindowLight(): React.ReactElement {
  const geometry = useMemo(() => {
    const z = BACK_Z + WALL_THICKNESS / 2 + 0.02;
    const panes = SLITS.map((x) => new PlaneGeometry(0.05, 1.5).translate(x, 1.95, z));
    const merged = mergeGeometries(panes, false);
    for (const pane of panes) pane.dispose();
    return merged;
  }, []);
  const material = useRef<MeshBasicMaterial>(null);
  useFrame(() => {
    material.current?.color.copy(WINDOW_DAY).lerp(daylight.sky, Math.min(1, daylight.darkness * 1.2));
  });
  return (
    <>
      <mesh geometry={geometry}>
        <meshBasicMaterial ref={material} color={WINDOW_DAY} toneMapped={false} />
      </mesh>
      <WindowView
        assetKey={ASSETS.environment.barnWindow}
        width={LOFT_WINDOW.width}
        height={LOFT_WINDOW.height}
        position={[LOFT_WINDOW.x, LOFT_WINDOW.y, BACK_Z + WALL_THICKNESS / 2 + 0.02]}
        fallbackColor={COLORS.window}
      />
    </>
  );
}

/* ------------------------- 기둥 · 들보 · 틀 (짙은 나무) ------------------------- */

/** 짙은 나무색 상자 전부: 벽 기둥 · 들보, 창틀, 입구 기둥, 다락 앞 들보 · 받침 기둥 */
export function Frame(): React.ReactElement {
  const geometry = useMemo(() => {
    const t = 0.22;
    const h = ROOM.wallHeight + 0.15;
    const inX = HALF_W - WALL_THICKNESS / 2 - t / 2;
    const inZ = BACK_Z + WALL_THICKNESS / 2 + t / 2;
    const glassZ = BACK_Z + WALL_THICKNESS / 2 + 0.06;
    const { x, y, width, height } = LOFT_WINDOW;
    const loftCx = (LOFT.minX + LOFT.maxX) / 2;
    const boxes: BoxSpec[] = [
      // 벽 기둥 · 들보
      ...[-inX, -2.0, 2.0, inX].map((px) => ({ x: px, y: h / 2, z: inZ, w: t, h, d: t })),
      ...[...STALL_WALLS_Z, FRONT_Z - t / 2].flatMap((z) => [
        { x: -inX, y: h / 2, z, w: t, h, d: t },
        { x: inX, y: h / 2, z, w: t, h, d: t },
      ]),
      { x: 0, y: ROOM.wallHeight, z: inZ, w: ROOM.width, h: t, d: t },
      { x: -inX, y: ROOM.wallHeight, z: 0, w: t, h: t, d: ROOM.depth },
      { x: inX, y: ROOM.wallHeight, z: 0, w: t, h: t, d: ROOM.depth },
      // 뒷벽 가운데 가로대 (판자를 받치는 띠)
      { x: 0, y: 1.2, z: inZ + 0.02, w: ROOM.width - 0.4, h: 0.12, d: 0.08 },
      // 다락 창틀
      { x, y: y + height / 2, z: glassZ, w: width + 0.2, h: 0.14, d: 0.08 },
      { x, y: y - height / 2, z: glassZ, w: width + 0.2, h: 0.14, d: 0.08 },
      { x: x - width / 2, y, z: glassZ, w: 0.14, h: height, d: 0.08 },
      { x: x + width / 2, y, z: glassZ, w: 0.14, h: height, d: 0.08 },
      { x, y, z: glassZ, w: 0.09, h: height, d: 0.08 },
      // 입구 기둥 (위 가로대는 두지 않는다: 카메라가 가까워 화면 아래를 가로질러 캐릭터를 가린다)
      ...[-1, 1].map((side) => ({ x: side * ENTRANCE.halfWidth, y: ENTRANCE.height / 2, z: FRONT_Z, w: 0.2, h: ENTRANCE.height, d: 0.24 })),
      // 다락 앞 들보 · 받침 기둥
      { x: loftCx, y: LOFT.y - 0.12, z: LOFT.maxZ, w: LOFT.maxX - LOFT.minX, h: 0.22, d: 0.2 },
      { x: LOFT.minX, y: LOFT.y / 2, z: LOFT.maxZ, w: 0.2, h: LOFT.y, d: 0.2 },
    ];
    return mergedBoxGeometry(boxes);
  }, []);
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color={COLORS.beam} roughness={0.9} />
    </mesh>
  );
}

/* ------------------------------ 칸막이 · 다락 바닥 ------------------------------ */

/** 보통 나무색 상자 전부: 왼쪽 칸막이 두 칸(가로 판자 세 줄 + 끝 기둥), 다락 바닥판 */
export function Woodwork(): React.ReactElement {
  const geometry = useMemo(() => {
    const length = STALL_FRONT_X + HALF_W;
    const cx = -HALF_W + length / 2;
    const boxes: BoxSpec[] = [
      ...STALL_WALLS_Z.flatMap((z) => [
        ...[0.3, 0.65, 1.0].map((y) => ({ x: cx, y, z, w: length, h: 0.24, d: 0.08 })),
        { x: STALL_FRONT_X, y: 0.65, z, w: 0.18, h: 1.3, d: 0.18 },
      ]),
      {
        x: (LOFT.minX + LOFT.maxX) / 2,
        y: LOFT.y,
        z: (LOFT.minZ + LOFT.maxZ) / 2,
        w: LOFT.maxX - LOFT.minX,
        h: 0.14,
        d: LOFT.maxZ - LOFT.minZ,
      },
    ];
    return mergedBoxGeometry(boxes);
  }, []);
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color={PALETTE.wood} roughness={0.9} />
    </mesh>
  );
}

/* --------------------------------- 입구 문짝 --------------------------------- */

const LEAF = { width: 1.15, height: 2.3, thickness: 0.08, open: 0.35 };

/** 문짝 안의 한 점(lx, ly, lz)을 바닥 좌표로. 문짝은 기둥에 달려 바깥(카메라 쪽)으로 open 만큼 열려 있다 */
function leafPoint(side: number, lx: number, ly: number, lz: number): { x: number; y: number; z: number; rot: number } {
  const rot = side * LEAF.open;
  const hingeX = side * (ENTRANCE.halfWidth + 0.05);
  const hingeZ = FRONT_Z + 0.1;
  const z = lz + LEAF.width / 2;
  return {
    x: hingeX + lx * Math.cos(rot) + z * Math.sin(rot),
    y: LEAF.height / 2 + 0.02 + ly,
    z: hingeZ - lx * Math.sin(rot) + z * Math.cos(rot),
    rot,
  };
}

/** 활짝 열린 붉은 문짝 두 개 (한 모양) + 통로 쪽 면의 흰 테두리 · X 무늬 (한 모양). 바깥 헛간 문과 같은 무늬 */
export function Entrance(): React.ReactElement {
  const { leaves, trim } = useMemo(() => {
    const leafBoxes: BoxSpec[] = [];
    const trimBoxes: BoxSpec[] = [];
    const t = 0.1;
    const { width: w, height: h } = LEAF;
    const diagonal = Math.hypot(w, h) - 0.2;
    const angle = Math.PI / 2 - Math.atan2(h, w);
    for (const side of [-1, 1]) {
      const center = leafPoint(side, 0, 0, 0);
      leafBoxes.push({ x: center.x, y: center.y, z: center.z, w: LEAF.thickness, h, d: w, rotationY: center.rot });
      // 무늬는 통로 쪽(-side) 면에
      const fx = -side * 0.055;
      const part = (ly: number, lz: number, ph: number, pd: number, rotationX = 0) => {
        const p = leafPoint(side, fx, ly, lz);
        trimBoxes.push({ x: p.x, y: p.y, z: p.z, w: 0.03, h: ph, d: pd, rotationY: p.rot, rotationX });
      };
      part(h / 2 - t / 2, 0, t, w);
      part(-h / 2 + t / 2, 0, t, w);
      part(0, w / 2 - t / 2, h, t);
      part(0, -w / 2 + t / 2, h, t);
      part(0, 0, 0.09, diagonal, angle);
      part(0, 0, 0.09, diagonal, -angle);
    }
    return { leaves: mergedBoxGeometry(leafBoxes), trim: mergedBoxGeometry(trimBoxes) };
  }, []);
  return (
    <group>
      <mesh geometry={leaves} castShadow>
        <meshStandardMaterial color={COLORS.barnRed} roughness={0.85} />
      </mesh>
      <mesh geometry={trim}>
        <meshStandardMaterial color={COLORS.trim} roughness={0.85} />
      </mesh>
    </group>
  );
}

/* --------------------------------- 사다리 --------------------------------- */

/** 다락으로 기대 놓은 사다리 (아래는 통로 쪽, 위는 다락 앞 들보) */
export function Ladder(): React.ReactElement {
  const geometry = useMemo(() => {
    const length = 3.15;
    const boxes: BoxSpec[] = [
      { x: -0.25, y: length / 2, z: 0, w: 0.08, h: length, d: 0.08 },
      { x: 0.25, y: length / 2, z: 0, w: 0.08, h: length, d: 0.08 },
      ...[0.35, 0.8, 1.25, 1.7, 2.15, 2.6, 3.0].map((y) => ({ x: 0, y, z: 0, w: 0.5, h: 0.06, d: 0.06 })),
    ];
    return mergedBoxGeometry(boxes);
  }, []);
  return (
    <mesh geometry={geometry} position={[PLACE.ladder.x, 0, PLACE.ladder.z]} rotation-x={-0.2} castShadow>
      <meshStandardMaterial color={PALETTE.woodLight} roughness={0.9} />
    </mesh>
  );
}
