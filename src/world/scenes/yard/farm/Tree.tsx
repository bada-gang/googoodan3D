/**
 * 밭의 나무: 단계별 모양(싹 · 어린나무 · 다 자란 나무)과 흔들림, 열매를 달 수관 재기.
 */
import { useCallback, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box3, Matrix4, type Group, type Mesh, type Object3D } from 'three';
import { PALETTE } from '@/config/artTokens';
import { MODELS } from '@/config/models';
import type { TreeSpeciesId, TreeStage } from '@/types/game';
import { GltfModel } from '../../../rendering/assets';
import { PLOT_HEIGHT } from './farmShared';
import { Fruits } from './Fruits';

/** 어린나무는 다 자란 나무 모델을 이만큼 줄여 쓴다 */
const SAPLING_SCALE = 0.55;

/** 나무 잎 덩어리(수관)의 대략적인 타원체. 열매를 그 겉면에 단다 */
export interface Crown {
  center: [number, number, number];
  radius: [number, number, number];
}

/** 불러온 나무 모델의 크기를 재서 수관 타원체를 정한다 (나무 그룹 기준 좌표) */
function measureCrown(object: Object3D): Crown {
  object.updateWorldMatrix(true, true);
  const toLocal = new Matrix4().copy(object.parent?.matrixWorld ?? new Matrix4()).invert();
  const box = new Box3();
  object.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    const part = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(toLocal);
    box.union(part);
  });
  const height = box.max.y - box.min.y;
  // 아래 40% 는 줄기. 그 위가 잎 덩어리
  const bottom = box.min.y + height * 0.4;
  return {
    center: [(box.min.x + box.max.x) / 2, (bottom + box.max.y) / 2, (box.min.z + box.max.z) / 2],
    radius: [((box.max.x - box.min.x) / 2) * 0.92, (box.max.y - bottom) / 2, ((box.max.z - box.min.z) / 2) * 0.92],
  };
}

/**
 * 단계별 나무. 단계가 바뀌어도 나무 자체는 그대로 둔다 (사라졌다 나타나 보이지 않게).
 * 움직임은 바람에 살랑이는 것과 열매가 돋아나는 것뿐이다.
 */
export function Tree({
  species,
  stage,
  onCrown,
}: {
  species: TreeSpeciesId;
  stage: TreeStage;
  onCrown: (crown: Crown | null) => void;
}): React.ReactElement {
  const group = useRef<Group>(null);
  const [crown, setCrown] = useState<Crown | null>(null);
  const onTreeLoaded = useCallback(
    (object: Object3D | null) => {
      const measured = object ? measureCrown(object) : null;
      setCrown(measured);
      onCrown(measured);
    },
    [onCrown],
  );

  useFrame(() => {
    if (!group.current) return;
    // 잎이 바람에 살랑. 흔들림 각도는 아주 작게 (ART_DIRECTION 8)
    group.current.rotation.z = Math.sin((performance.now() / 1000 / 2.6) * Math.PI) * 0.015;
  });

  return (
    <group ref={group} position-y={PLOT_HEIGHT}>
      {stage === 'seed' && (
        <mesh position-y={0.05} castShadow>
          <sphereGeometry args={[0.28, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={PALETTE.soilShade} roughness={1} />
        </mesh>
      )}
      {stage === 'sprout' && <GltfModel modelKey={MODELS.sprout} fallback={<Sprout />} />}
      {stage === 'sapling' && (
        <group scale={SAPLING_SCALE}>
          <GltfModel modelKey={MODELS.trees[species]} fallback={<Trunk height={1.4} radius={0.13} crown={0.95} />} />
        </group>
      )}
      {(stage === 'mature' || stage === 'fruiting') && (
        <GltfModel
          modelKey={MODELS.trees[species]}
          fallback={<Trunk height={1.4} radius={0.13} crown={0.95} />}
          onLoaded={onTreeLoaded}
        />
      )}
      {stage === 'fruiting' && <Fruits species={species} crown={crown} />}
    </group>
  );
}

function Sprout(): React.ReactElement {
  return (
    <group>
      <mesh position-y={0.18} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 0.36, 8]} />
        <meshStandardMaterial color={PALETTE.leafShade} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.11, 0.36, 0]} rotation-z={side * -0.6} scale={[1, 0.45, 0.7]} castShadow>
          <sphereGeometry args={[0.13, 12, 8]} />
          <meshStandardMaterial color={PALETTE.leafLight} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Trunk({ height, radius, crown }: { height: number; radius: number; crown: number }): React.ReactElement {
  return (
    <group>
      <mesh position-y={height / 2} castShadow>
        <cylinderGeometry args={[radius * 0.8, radius, height, 10]} />
        <meshStandardMaterial color={PALETTE.trunk} roughness={0.9} />
      </mesh>
      {/* 수관: 덩어리 세 개를 겹쳐 둥실한 모양으로 */}
      {[
        [0, height + crown * 0.55, 0, crown],
        [-crown * 0.55, height + crown * 0.3, crown * 0.15, crown * 0.7],
        [crown * 0.55, height + crown * 0.35, -crown * 0.1, crown * 0.72],
      ].map(([cx, cy, cz, r], i) => (
        <mesh key={i} position={[cx, cy, cz]} castShadow receiveShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={i === 0 ? PALETTE.leaf : PALETTE.leafLight} flatShading roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}
