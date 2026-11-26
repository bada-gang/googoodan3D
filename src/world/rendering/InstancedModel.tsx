/**
 * 같은 모델을 여러 자리에 한 번에 그린다 (인스턴싱). 따로 놓으면 개수만큼 그리기 호출이 들지만,
 * 묶으면 모델 안의 모양 수만큼(보통 1번)만 든다. 움직이지 않는 장식용 (자리는 처음 한 번만 정한다).
 *
 * castShadow 를 주면 그림자를 만든다. StaticShadow 안에 두면 미리 그린 그림자로 한 번만 구워진다.
 * 모델이 아직 없으면 자리마다 fallback 을 그린다.
 */
import { useLayoutEffect, useRef } from 'react';
import { Euler, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three';
import { ModelParts, type ModelPart } from './assets';

export interface ModelPlacement {
  x: number;
  z: number;
  /** 바닥에서 높이 (m) */
  y?: number;
  /** y 축 돌림 (라디안) */
  rot?: number;
  scale?: number;
}

export function InstancedModel({
  modelKey,
  placements,
  fallback,
  castShadow = false,
}: {
  modelKey: string;
  placements: readonly ModelPlacement[];
  /** 모델이 없을 때 자리 하나에 그릴 임시 모양 */
  fallback: React.ReactNode;
  castShadow?: boolean;
}): React.ReactElement {
  const fallbacks = (
    <>
      {placements.map((p, i) => (
        <group key={i} position={[p.x, p.y ?? 0, p.z]} rotation-y={p.rot ?? 0} scale={p.scale ?? 1}>
          {fallback}
        </group>
      ))}
    </>
  );
  return (
    <ModelParts modelKey={modelKey} fallback={fallbacks}>
      {(parts) => <Instances parts={parts} placements={placements} castShadow={castShadow} />}
    </ModelParts>
  );
}

const base = new Matrix4();
const matrix = new Matrix4();
const rotation = new Quaternion();
const euler = new Euler();
const position = new Vector3();
const scale = new Vector3();

function Instances({
  parts,
  placements,
  castShadow,
}: {
  parts: ModelPart[];
  placements: readonly ModelPlacement[];
  castShadow: boolean;
}): React.ReactElement {
  const meshes = useRef<(InstancedMesh | null)[]>([]);
  useLayoutEffect(() => {
    placements.forEach((p, i) => {
      rotation.setFromEuler(euler.set(0, p.rot ?? 0, 0));
      base.compose(position.set(p.x, p.y ?? 0, p.z), rotation, scale.setScalar(p.scale ?? 1));
      parts.forEach((part, k) => meshes.current[k]?.setMatrixAt(i, matrix.multiplyMatrices(base, part.matrix)));
    });
    for (const mesh of meshes.current) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [parts, placements]);
  return (
    <group>
      {parts.map((part, k) => (
        <instancedMesh
          key={k}
          ref={(mesh) => void (meshes.current[k] = mesh)}
          args={[part.geometry, part.material, placements.length]}
          castShadow={castShadow}
          // 모양 · 재질은 불러온 모델 것을 같이 쓴다. 장면을 떠날 때 정리하면 다른 장면이 다시 올려야 한다
          dispose={null}
        />
      ))}
    </group>
  );
}
