/**
 * 마굿간 안 물건 (3D 모델, config/models 의 MODELS.barnProps): 건초 뭉치 · 건초 더미 · 도구 걸이 · 양동이 ·
 * 사과 상자 · 손수레 · 우유 통 · 벽 등불. 여물통은 바깥 우리 것을 같이 쓴다.
 * 모델이 아직 없으면 코드로 만든 임시 모양을 쓴다. 자리는 barnLayout.ts 의 PLACE · LANTERNS.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, type SpriteMaterial } from 'three';
import { PALETTE } from '@/config/artTokens';
import { MODELS } from '@/config/models';
import { GltfModel } from '../../rendering/assets';
import { daylight, glowTexture } from '../../rendering/dayNight';
import { COLORS, LANTERNS, LOFT, PLACE } from './barnLayout';

function Prop({
  modelKey,
  fallback,
  x,
  z,
  y = 0,
  rot = 0,
  scale = 1,
}: {
  modelKey: string;
  fallback: React.ReactNode;
  x: number;
  z: number;
  y?: number;
  rot?: number;
  scale?: number;
}): React.ReactElement {
  return (
    <group position={[x, y, z]} rotation-y={rot} scale={scale}>
      {/* 그림자는 BarnWorld 의 StaticShadow 가 한 번만 그려 바닥에 굽는다 (실시간 그림자에서는 빠진다) */}
      <GltfModel modelKey={modelKey} fallback={fallback} />
    </group>
  );
}

const M = MODELS.barnProps;

export function BarnProps(): React.ReactElement {
  const s = PLACE.hayStack;
  const loftZ = (LOFT.minZ + LOFT.maxZ) / 2;
  return (
    <group>
      {/* 뒷벽 앞 쌓인 건초 뭉치: 아래 둘, 위 하나 + 통로 쪽에 하나 */}
      <Prop modelKey={M.hayBale} fallback={<FallbackBale />} x={s.x - 0.55} z={s.z} />
      <Prop modelKey={M.hayBale} fallback={<FallbackBale />} x={s.x + 0.55} z={s.z} rot={0.05} />
      <Prop modelKey={M.hayBale} fallback={<FallbackBale />} x={s.x} z={s.z + 0.05} y={0.72} rot={-0.08} />
      <Prop modelKey={M.hayBale} fallback={<FallbackBale />} x={PLACE.looseBale.x} z={PLACE.looseBale.z} rot={PLACE.looseBale.rot} />

      {/* 칸 안: 수북한 건초, 여물통과 건초 뭉치, 앞쪽 양동이 */}
      <Prop modelKey={M.hayPile} fallback={<FallbackHayPile />} x={PLACE.hayPileStall.x} z={PLACE.hayPileStall.z} rot={0.6} />
      <Prop
        modelKey={MODELS.buildings.trough}
        fallback={<FallbackBox w={0.6} h={0.5} d={1.5} color={PALETTE.wood} />}
        x={PLACE.troughStall.x}
        z={PLACE.troughStall.z}
        rot={Math.PI / 2}
      />
      <Prop modelKey={M.hayBale} fallback={<FallbackBale />} x={PLACE.baleStall.x} z={PLACE.baleStall.z} rot={PLACE.baleStall.rot} />
      <Prop modelKey={M.bucket} fallback={<FallbackBucket />} x={PLACE.bucketFront.x} z={PLACE.bucketFront.z} rot={0.4} />

      {/* 오른쪽: 도구 걸이(벽을 등지고), 손수레, 우유 통 */}
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
      {PLACE.milkCans.map((can, i) => (
        <Prop key={i} modelKey={M.milkCan} fallback={<FallbackCan />} x={can.x} z={can.z} rot={i * 1.3} />
      ))}

      {/* 다락 밑: 사과 상자, 양동이 */}
      <Prop
        modelKey={M.appleCrate}
        fallback={<FallbackBox w={0.7} h={0.5} d={0.5} color={PALETTE.woodLight} />}
        x={PLACE.appleCrate.x}
        z={PLACE.appleCrate.z}
        rot={-0.15}
      />
      <Prop modelKey={M.bucket} fallback={<FallbackBucket />} x={PLACE.bucketBack.x} z={PLACE.bucketBack.z} rot={-0.5} />

      {/* 다락 위 건초 */}
      <Prop modelKey={M.hayPile} fallback={<FallbackHayPile />} x={(LOFT.minX + LOFT.maxX) / 2 + 0.4} z={loftZ - 0.05} y={LOFT.y + 0.07} scale={0.8} />
      <Prop modelKey={M.hayBale} fallback={<FallbackBale />} x={LOFT.minX + 0.6} z={loftZ} y={LOFT.y + 0.07} rot={0.2} />
    </group>
  );
}

/* --------------------------------- 등불 --------------------------------- */

/** 벽 등불. 마굿간은 어두워서 낮에도 켜 둔다. 밤에는 번짐이 더 진하다 */
export function Lanterns(): React.ReactElement {
  return (
    <group>
      {LANTERNS.map((lantern, i) => (
        <group key={i} position={[lantern.x, lantern.y, lantern.z]} rotation-y={lantern.rot}>
          <GltfModel modelKey={M.lantern} fallback={<FallbackLantern />} castShadow={false} />
          <LanternGlow />
        </group>
      ))}
    </group>
  );
}

/** 빛 번짐 그림 (진짜 조명은 태블릿에서 무거워 쓰지 않는다) */
function LanternGlow(): React.ReactElement {
  const material = useRef<SpriteMaterial>(null);
  useFrame(({ clock }) => {
    if (!material.current) return;
    // 아주 살짝 일렁인다 (반복 2.2초 이상, ART_DIRECTION 8)
    const flicker = 0.94 + 0.06 * Math.sin((clock.elapsedTime * (Math.PI * 2)) / 2.6);
    material.current.opacity = (0.5 + 0.4 * daylight.glow) * flicker;
  });
  return (
    <sprite position={[0, 0.32, 0.25]} scale={1.4}>
      <spriteMaterial ref={material} map={glowTexture()} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </sprite>
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
