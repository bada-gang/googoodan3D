/**
 * 마굿간 안 물건 (3D 모델, config/models 의 MODELS.barnProps): 건초 뭉치 · 건초 더미 · 도구 걸이 · 양동이 ·
 * 사과 상자 · 손수레 · 우유 통 · 벽 등불. 여물통은 바깥 우리 것을 같이 쓴다.
 * 모델이 아직 없으면 코드로 만든 임시 모양을 쓴다. 자리는 barnLayout.ts 의 PLACE · LANTERNS.
 *
 * 가볍게: 같은 모델이 여러 개면(건초 뭉치 6 · 건초 더미 2 · 양동이 2 · 우유 통 2 · 등불 2) 인스턴싱으로
 * 모델마다 한 번에 그린다 (rendering/InstancedModel). 등불 빛 번짐 두 개도 한 모양이다.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Object3D, PlaneGeometry, type MeshBasicMaterial } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE } from '@/config/artTokens';
import { MODELS } from '@/config/models';
import { GltfModel } from '../../rendering/assets';
import { InstancedModel, type ModelPlacement } from '../../rendering/InstancedModel';
import { daylight, glowTexture } from '../../rendering/dayNight';
import { BARN_VIEW, COLORS, LANTERNS, LOFT, PLACE } from './barnLayout';

const M = MODELS.barnProps;
const s = PLACE.hayStack;
const loftZ = (LOFT.minZ + LOFT.maxZ) / 2;

/** 건초 뭉치 6개: 뒷벽 앞에 아래 둘 · 위 하나, 통로 쪽 하나, 칸 안 하나, 다락 위 하나 */
const BALES: ModelPlacement[] = [
  { x: s.x - 0.55, z: s.z },
  { x: s.x + 0.55, z: s.z, rot: 0.05 },
  { x: s.x, z: s.z + 0.05, y: 0.72, rot: -0.08 },
  { x: PLACE.looseBale.x, z: PLACE.looseBale.z, rot: PLACE.looseBale.rot },
  { x: PLACE.baleStall.x, z: PLACE.baleStall.z, rot: PLACE.baleStall.rot },
  { x: LOFT.minX + 0.6, z: loftZ, y: LOFT.y + 0.07, rot: 0.2 },
];
/** 수북한 건초: 칸 안, 다락 위 (조금 작게) */
const HAY_PILES: ModelPlacement[] = [
  { x: PLACE.hayPileStall.x, z: PLACE.hayPileStall.z, rot: 0.6 },
  { x: (LOFT.minX + LOFT.maxX) / 2 + 0.4, z: loftZ - 0.05, y: LOFT.y + 0.07, scale: 0.8 },
];
const BUCKETS: ModelPlacement[] = [
  { x: PLACE.bucketFront.x, z: PLACE.bucketFront.z, rot: 0.4 },
  { x: PLACE.bucketBack.x, z: PLACE.bucketBack.z, rot: -0.5 },
];
const MILK_CANS: ModelPlacement[] = PLACE.milkCans.map((can, i) => ({ x: can.x, z: can.z, rot: i * 1.3 }));

/** 한 개뿐인 물건 */
function Prop({
  modelKey,
  fallback,
  x,
  z,
  rot = 0,
}: {
  modelKey: string;
  fallback: React.ReactNode;
  x: number;
  z: number;
  rot?: number;
}): React.ReactElement {
  return (
    <group position={[x, 0, z]} rotation-y={rot}>
      <GltfModel modelKey={modelKey} fallback={fallback} />
    </group>
  );
}

/** 물건 전부. 그림자는 BarnWorld 의 StaticShadow 가 한 번만 그려 바닥에 굽는다 (실시간 그림자에서는 빠진다) */
export function BarnProps(): React.ReactElement {
  return (
    <group>
      <InstancedModel modelKey={M.hayBale} placements={BALES} fallback={<FallbackBale />} castShadow />
      <InstancedModel modelKey={M.hayPile} placements={HAY_PILES} fallback={<FallbackHayPile />} castShadow />
      <InstancedModel modelKey={M.bucket} placements={BUCKETS} fallback={<FallbackBucket />} castShadow />
      <InstancedModel modelKey={M.milkCan} placements={MILK_CANS} fallback={<FallbackCan />} castShadow />
      {/* 칸 안 여물통 (바깥 우리 것과 같은 모델) */}
      <Prop
        modelKey={MODELS.buildings.trough}
        fallback={<FallbackBox w={0.6} h={0.5} d={1.5} color={PALETTE.wood} />}
        x={PLACE.troughStall.x}
        z={PLACE.troughStall.z}
        rot={Math.PI / 2}
      />
      {/* 오른쪽: 도구 걸이(벽을 등지고), 손수레, 다락 밑 사과 상자 */}
      <Prop
        modelKey={M.toolRack}
        fallback={<FallbackBox w={1.4} h={1.7} d={0.3} color={PALETTE.woodDark} />}
        x={PLACE.toolRack.x}
        z={PLACE.toolRack.z}
        rot={-Math.PI / 2}
      />
      <Prop
        modelKey={M.wheelbarrow}
        fallback={<FallbackBox w={0.8} h={0.6} d={1.3} color={PALETTE.wood} />}
        x={PLACE.wheelbarrow.x}
        z={PLACE.wheelbarrow.z}
        rot={PLACE.wheelbarrow.rot}
      />
      <Prop
        modelKey={M.appleCrate}
        fallback={<FallbackBox w={0.7} h={0.5} d={0.5} color={PALETTE.woodLight} />}
        x={PLACE.appleCrate.x}
        z={PLACE.appleCrate.z}
        rot={-0.15}
      />
    </group>
  );
}

/* --------------------------------- 등불 --------------------------------- */

const LANTERN_PLACEMENTS: ModelPlacement[] = LANTERNS.map((l) => ({ x: l.x, y: l.y, z: l.z, rot: l.rot }));

/** 벽 등불. 마굿간은 어두워서 낮에도 켜 둔다. 밤에는 번짐이 더 진하다 */
export function Lanterns(): React.ReactElement {
  return (
    <group>
      <InstancedModel modelKey={M.lantern} placements={LANTERN_PLACEMENTS} fallback={<FallbackLantern />} />
      <LanternGlow />
    </group>
  );
}

/**
 * 빛 번짐: 등불 자리마다 둥근 빛 판 하나, 모두 한 모양. 카메라가 고정이라 판을 카메라 쪽으로 돌려 둔다.
 * 진짜 조명은 태블릿에서 무거워 쓰지 않는다
 */
const GLOW_SIZE = 1.4;
function LanternGlow(): React.ReactElement {
  const geometry = useMemo(() => {
    const camera = new Object3D();
    const planes = LANTERNS.map((l) => {
      // 등불 안쪽 불꽃 자리: 벽에서 0.25m 앞, 0.32m 위
      camera.position.set(l.x + 0.25 * Math.sin(l.rot), l.y + 0.32, l.z + 0.25 * Math.cos(l.rot));
      camera.lookAt(...BARN_VIEW.position);
      camera.updateMatrix();
      return new PlaneGeometry(GLOW_SIZE, GLOW_SIZE).applyMatrix4(camera.matrix);
    });
    const merged = mergeGeometries(planes, false);
    for (const plane of planes) plane.dispose();
    return merged;
  }, []);
  const material = useRef<MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!material.current) return;
    // 아주 살짝 일렁인다 (반복 2.2초 이상, ART_DIRECTION 8)
    const flicker = 0.94 + 0.06 * Math.sin((clock.elapsedTime * (Math.PI * 2)) / 2.6);
    material.current.opacity = (0.5 + 0.4 * daylight.glow) * flicker;
  });
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        ref={material}
        map={glowTexture()}
        transparent
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/* ------------------------- 모델이 아직 없을 때 임시 모양 ------------------------- */

function FallbackBox({ w, h, d, color }: { w: number; h: number; d: number; color: string }): React.ReactElement {
  return (
    <mesh position-y={h / 2}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

function FallbackBale(): React.ReactElement {
  return <FallbackBox w={1} h={0.55} d={0.6} color={COLORS.straw} />;
}

function FallbackHayPile(): React.ReactElement {
  return (
    <mesh position-y={0.3} scale={[1.2, 0.75, 1]}>
      <sphereGeometry args={[0.6, 14, 10]} />
      <meshStandardMaterial color={COLORS.straw} roughness={1} />
    </mesh>
  );
}

function FallbackBucket(): React.ReactElement {
  return (
    <mesh position-y={0.2}>
      <cylinderGeometry args={[0.22, 0.18, 0.4, 14]} />
      <meshStandardMaterial color={PALETTE.wood} roughness={0.9} />
    </mesh>
  );
}

function FallbackCan(): React.ReactElement {
  return (
    <mesh position-y={0.32}>
      <cylinderGeometry args={[0.2, 0.22, 0.65, 14]} />
      <meshStandardMaterial color="#c8ccd2" roughness={0.5} metalness={0.3} />
    </mesh>
  );
}

function FallbackLantern(): React.ReactElement {
  return (
    <mesh position={[0, 0.25, 0.15]}>
      <boxGeometry args={[0.2, 0.32, 0.2]} />
      <meshStandardMaterial color="#4a4a4a" emissive="#ffd36b" emissiveIntensity={0.4} roughness={0.6} />
    </mesh>
  );
}
