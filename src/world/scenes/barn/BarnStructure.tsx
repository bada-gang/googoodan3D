/**
 * 마굿간 건물: 흙바닥과 짚 · 입구 밖 풀밭, 판자 벽(위는 지붕 그늘), 기둥 · 들보, 다락 창,
 * 입구(문틀 · 열린 붉은 문짝), 칸막이, 다락 바닥판, 사다리. 모두 코드로 만든 모양이다 (새 그림 없음).
 * 자리 · 색은 barnLayout.ts.
 */
import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Color, type BufferGeometry, type MeshBasicMaterial } from 'three';
import { PALETTE } from '@/config/artTokens';
import { ASSETS } from '@/config/assets';
import { ArtTexture } from '../../rendering/assets';
import { daylight } from '../../rendering/dayNight';
import { mergedBoxGeometry, type BoxSpec } from '../../props/mergedBoxes';
import { FloorGlow } from './BarnLight';
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
          {(map) => <meshStandardMaterial map={map} color={COLORS.floor} roughness={1} />}
        </ArtTexture>
      </mesh>
      <mesh geometry={straw} receiveShadow>
        <meshStandardMaterial color={COLORS.straw} roughness={1} />
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

/** 판자 벽: 아래(지붕 밑까지)는 따뜻한 나무색, 그 위는 지붕 그늘처럼 어둡게. 입구 양옆은 낮게 잘라 낸 앞벽 */
export function Walls(): React.ReactElement {
  const upper = VISIBLE_WALL_HEIGHT - ROOM.wallHeight;
  const sides: { y: number; height: number; color: string }[] = [
    { y: ROOM.wallHeight / 2, height: ROOM.wallHeight, color: COLORS.wall },
    { y: ROOM.wallHeight + upper / 2, height: upper, color: COLORS.wallShade },
  ];
  const frontLength = HALF_W - ENTRANCE.halfWidth;
  return (
    <group>
      {sides.map(({ y, height, color }) => (
        <group key={color}>
          <PlankWall position={[0, y, BACK_Z]} length={ROOM.width + WALL_THICKNESS} height={height} color={color} />
          <PlankWall position={[-HALF_W, y, 0]} length={ROOM.depth} height={height} rotation={Math.PI / 2} color={color} />
          <PlankWall position={[HALF_W, y, 0]} length={ROOM.depth} height={height} rotation={-Math.PI / 2} color={color} />
        </group>
      ))}
      {[-1, 1].map((side) => (
        <PlankWall
          key={side}
          position={[side * (ENTRANCE.halfWidth + frontLength / 2), 0.35, FRONT_Z]}
          length={frontLength}
          height={0.7}
          color={COLORS.wall}
        />
      ))}
      <LoftWindow />
    </group>
  );
}

function PlankWall({
  position,
  length,
  height,
  rotation = 0,
  color,
}: {
  position: [number, number, number];
  length: number;
  height: number;
  rotation?: number;
  color: string;
}): React.ReactElement {
  return (
    // 벽은 그림자를 드리우지 않는다 (집 안과 같다: 왼쪽 벽 그림자가 바닥을 덮는다)
    <mesh position={position} rotation-y={rotation} receiveShadow>
      <boxGeometry args={[length, height, WALL_THICKNESS]} />
      {/* 집 안 바닥 판자 질감(흰 바탕)에 색을 곱한다 */}
      <ArtTexture assetKey={ASSETS.textures.floor} repeat={[length / 2, height / 1.2]}>
        {(map) => <meshStandardMaterial map={map} color={color} roughness={0.95} />}
      </ArtTexture>
    </mesh>
  );
}

/** 뒷벽 다락 창: 바깥 빛이 들어오는 밝은 네모 + 나무 틀, 왼쪽에 판자 틈. 밤에는 바깥 하늘색 */
const WINDOW_DAY = new Color(COLORS.window);
function LoftWindow(): React.ReactElement {
  const z = BACK_Z + WALL_THICKNESS / 2 + 0.01;
  const materials = useRef<(MeshBasicMaterial | null)[]>([]);
  useFrame(() => {
    const k = Math.min(1, daylight.darkness * 1.2);
    for (const material of materials.current) material?.color.copy(WINDOW_DAY).lerp(daylight.sky, k);
  });
  const glass = (index: number) => (material: MeshBasicMaterial | null) => {
    materials.current[index] = material;
  };
  const { x, y, width, height } = LOFT_WINDOW;
  return (
    <group>
      <mesh position={[x, y, z + 0.01]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial ref={glass(0)} color={WINDOW_DAY} toneMapped={false} />
      </mesh>
      {[
        [x, y + height / 2, width + 0.2, 0.14],
        [x, y - height / 2, width + 0.2, 0.14],
        [x - width / 2, y, 0.14, height],
        [x + width / 2, y, 0.14, height],
        [x, y, 0.09, height],
      ].map(([bx, by, w, h], i) => (
        <mesh key={i} position={[bx, by, z + 0.05]}>
          <boxGeometry args={[w, h, 0.08]} />
          <meshStandardMaterial color={COLORS.beam} roughness={0.9} />
        </mesh>
      ))}
      {SLITS.map((sx, i) => (
        <mesh key={sx} position={[sx, 1.95, z + 0.01]}>
          <planeGeometry args={[0.05, 1.5]} />
          <meshBasicMaterial ref={glass(i + 1)} color={WINDOW_DAY} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------- 기둥 · 들보 ------------------------------- */

/** 벽 모서리와 칸막이 자리에 기둥, 벽 위에 가로 들보. 한 모양으로 합쳐 그리기 1번 */
export function Frame(): React.ReactElement {
  const geometry = useMemo(() => {
    const t = 0.22;
    const h = ROOM.wallHeight + 0.15;
    const inX = HALF_W - WALL_THICKNESS / 2 - t / 2;
    const inZ = BACK_Z + WALL_THICKNESS / 2 + t / 2;
    const boxes: BoxSpec[] = [
      ...[-inX, -2.0, 2.0, inX].map((x) => ({ x, y: h / 2, z: inZ, w: t, h, d: t })),
      ...[...STALL_WALLS_Z, FRONT_Z - t / 2].flatMap((z) => [
        { x: -inX, y: h / 2, z, w: t, h, d: t },
        { x: inX, y: h / 2, z, w: t, h, d: t },
      ]),
      { x: 0, y: ROOM.wallHeight, z: inZ, w: ROOM.width, h: t, d: t },
      { x: -inX, y: ROOM.wallHeight, z: 0, w: t, h: t, d: ROOM.depth },
      { x: inX, y: ROOM.wallHeight, z: 0, w: t, h: t, d: ROOM.depth },
      // 뒷벽 가운데 가로대 (판자를 받치는 띠)
      { x: 0, y: 1.2, z: inZ + 0.02, w: ROOM.width - 0.4, h: 0.12, d: 0.08 },
    ];
    return mergedBoxGeometry(boxes);
  }, []);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={COLORS.beam} roughness={0.9} />
    </mesh>
  );
}

/* ---------------------------------- 입구 ---------------------------------- */

/** 입구: 문틀 기둥 두 개, 바깥쪽으로 활짝 열린 붉은 문짝 두 개 (바깥 헛간 문과 같은 흰 테두리 · X) */
export function Entrance(): React.ReactElement {
  const leafWidth = 1.15;
  const leafHeight = 2.3;
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * ENTRANCE.halfWidth, ENTRANCE.height / 2, FRONT_Z]} castShadow>
            <boxGeometry args={[0.2, ENTRANCE.height, 0.24]} />
            <meshStandardMaterial color={COLORS.beam} roughness={0.9} />
          </mesh>
          {/* 문짝: 기둥에 달려 바깥(카메라 쪽)으로 열려 있다. 통로 쪽 면에 무늬 */}
          <group position={[side * (ENTRANCE.halfWidth + 0.05), leafHeight / 2 + 0.02, FRONT_Z + 0.1]} rotation-y={side * 0.35}>
            <group position-z={leafWidth / 2}>
              <mesh castShadow>
                <boxGeometry args={[0.08, leafHeight, leafWidth]} />
                <meshStandardMaterial color={COLORS.barnRed} roughness={0.85} />
              </mesh>
              <DoorTrim side={-side} width={leafWidth} height={leafHeight} />
            </group>
          </group>
        </group>
      ))}
      {/* 문틀 위 가로대는 두지 않는다: 카메라가 가까워서 화면 아래를 가로질러 캐릭터를 가린다 */}
      {/* 입구로 스며드는 바깥 빛 */}
      <FloorGlow x={0} z={FRONT_Z - 0.6} width={3.2} depth={2.2} strength={0.32} />
    </group>
  );
}

/** 문짝 한 면의 흰 테두리와 X (side: 어느 면에 붙일지 ±x) */
function DoorTrim({ side, width, height }: { side: number; width: number; height: number }): React.ReactElement {
  const { frame, diagonal, angle } = useMemo(() => {
    const t = 0.1;
    const parts: BoxSpec[] = [
      { x: 0, y: height / 2 - t / 2, z: 0, w: 0.03, h: t, d: width },
      { x: 0, y: -height / 2 + t / 2, z: 0, w: 0.03, h: t, d: width },
      { x: 0, y: 0, z: width / 2 - t / 2, w: 0.03, h: height, d: t },
      { x: 0, y: 0, z: -width / 2 + t / 2, w: 0.03, h: height, d: t },
    ];
    return { frame: mergedBoxGeometry(parts), diagonal: Math.hypot(width, height) - 0.2, angle: Math.atan2(height, width) };
  }, [width, height]);
  return (
    <group position-x={side * 0.055}>
      <mesh geometry={frame}>
        <meshStandardMaterial color={COLORS.trim} roughness={0.85} />
      </mesh>
      {[1, -1].map((sign) => (
        <mesh key={sign} rotation-x={sign * (Math.PI / 2 - angle)}>
          <boxGeometry args={[0.03, 0.09, diagonal]} />
          <meshStandardMaterial color={COLORS.trim} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/* --------------------------------- 칸막이 --------------------------------- */

/** 왼쪽 벽의 칸막이 두 칸: 가로 판자 세 줄 + 통로 쪽 끝 기둥 */
export function Stalls(): React.ReactElement {
  const geometry = useMemo(() => {
    const length = STALL_FRONT_X + HALF_W;
    const cx = -HALF_W + length / 2;
    const boxes: BoxSpec[] = STALL_WALLS_Z.flatMap((z) => [
      ...[0.3, 0.65, 1.0].map((y) => ({ x: cx, y, z, w: length, h: 0.24, d: 0.08 })),
      { x: STALL_FRONT_X, y: 0.65, z, w: 0.18, h: 1.3, d: 0.18 },
    ]);
    return mergedBoxGeometry(boxes);
  }, []);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={PALETTE.wood} roughness={0.9} />
    </mesh>
  );
}

/* ------------------------------- 다락 · 사다리 ------------------------------- */

/** 오른쪽 안쪽 위 다락: 바닥판 + 앞 들보 + 받침 기둥 (위의 건초는 BarnProps) */
export function Loft(): React.ReactElement {
  const width = LOFT.maxX - LOFT.minX;
  const depth = LOFT.maxZ - LOFT.minZ;
  const cx = (LOFT.minX + LOFT.maxX) / 2;
  return (
    <group>
      <mesh position={[cx, LOFT.y, (LOFT.minZ + LOFT.maxZ) / 2]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.14, depth]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={0.9} />
      </mesh>
      <mesh position={[cx, LOFT.y - 0.12, LOFT.maxZ]} castShadow>
        <boxGeometry args={[width, 0.22, 0.2]} />
        <meshStandardMaterial color={COLORS.beam} roughness={0.9} />
      </mesh>
      <mesh position={[LOFT.minX, LOFT.y / 2, LOFT.maxZ]} castShadow>
        <boxGeometry args={[0.2, LOFT.y, 0.2]} />
        <meshStandardMaterial color={COLORS.beam} roughness={0.9} />
      </mesh>
    </group>
  );
}

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
