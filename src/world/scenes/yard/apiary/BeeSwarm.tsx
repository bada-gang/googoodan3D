/**
 * 양봉 통 둘레를 날아다니는 작은 꿀벌. 새 그림 없이 코드로 만든다 (노란 몸 · 검은 줄 · 반투명 날개).
 *
 * 통마다 2~3마리 (apiaryLayout BEES_PER_HIVE). 가볍게: 몇 마리든 몸(줄무늬 포함, 꼭짓점 색) · 날개를 각각 인스턴싱으로 한 번에 그린다 (그리기 2번).
 * 그림자는 만들지 않는다 (작아서 티가 안 나고, 움직여서 미리 그릴 수도 없다).
 * 움직임: 통 둘레를 저마다 다른 반지름 · 높이 · 빠르기로 돌며 위아래로 출렁이고, 날개는 빠르게 파닥인다.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, CylinderGeometry, DoubleSide, Euler, Float32BufferAttribute, Matrix4, Quaternion, SphereGeometry, Vector3, type BufferGeometry, type InstancedMesh } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BEE_ORBIT, BEES_PER_HIVE } from './apiaryLayout';

/** 꿀벌 크기 (m). 실제보다 훨씬 크게 — 작으면 화면에서 점으로 보인다 */
const BODY = { radius: 0.09, length: 1.5 };
const BEE_YELLOW = '#f6c94a';
const BEE_BLACK = '#3a2f2a';

interface BeePath {
  hive: { x: number; z: number };
  radius: number;
  height: number;
  speed: number;
  phase: number;
  /** 위아래 출렁임 */
  bob: number;
}

const matrix = new Matrix4();
const position = new Vector3();
const rotation = new Quaternion();
const euler = new Euler();
const scale = new Vector3();
const wingMatrix = new Matrix4();
const wingOffset = new Matrix4();
const wingPosition = new Vector3();
const wingRotation = new Quaternion();
const ONE = new Vector3(1, 1, 1);

/** 모양 전체에 한 색을 꼭짓점 색으로 칠한다 */
function paint(geometry: BufferGeometry, hex: string): BufferGeometry {
  const c = new Color(hex);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

/** 몸: 노란 공 + 몸(앞뒤 = z 축)을 감싸는 검은 고리 둘을 한 모양으로 (그리기 1번) */
function bodyGeometry(): BufferGeometry {
  const parts = [
    paint(new SphereGeometry(BODY.radius, 10, 8), BEE_YELLOW),
    ...[-0.03, 0.035].map((z) =>
      paint(new CylinderGeometry(BODY.radius * 1.03, BODY.radius * 1.03, BODY.radius * 0.32, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, z), BEE_BLACK),
    ),
  ];
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  return merged;
}

export function BeeSwarm({ hives }: { hives: { x: number; z: number }[] }): React.ReactElement {
  const paths = useMemo<BeePath[]>(
    () =>
      hives.flatMap((hive, h) =>
        Array.from({ length: BEES_PER_HIVE[h] ?? 3 }, (_, i) => {
          const k = h * 7 + i;
          return {
            hive,
            radius: BEE_ORBIT.min + ((k * 0.37) % 1) * (BEE_ORBIT.max - BEE_ORBIT.min),
            height: 0.75 + ((k * 0.61) % 1) * 0.7,
            // 반은 반대 방향으로 돈다
            speed: (0.6 + ((k * 0.29) % 1) * 0.6) * (i % 2 === 0 ? 1 : -1),
            phase: k * 1.9,
            bob: 0.08 + ((k * 0.43) % 1) * 0.1,
          };
        }),
      ),
    [hives],
  );
  const count = paths.length;
  const bodies = useRef<InstancedMesh>(null);
  const wings = useRef<InstancedMesh>(null);
  const bodyShape = useMemo(bodyGeometry, []);

  useLayoutEffect(() => {
    for (const mesh of [bodies.current, wings.current]) if (mesh) mesh.count = mesh === wings.current ? count * 2 : count;
  }, [count]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    paths.forEach((p, i) => {
      const angle = p.phase + t * p.speed;
      // 둥근 길에 살짝 8자 흔들림을 섞는다
      const r = p.radius * (1 + 0.18 * Math.sin(angle * 2 + p.phase));
      position.set(p.hive.x + Math.cos(angle) * r, p.height + Math.sin(t * 2.3 + p.phase) * p.bob, p.hive.z + Math.sin(angle) * r);
      // 나는 방향을 바라본다 (돌아가는 방향의 접선)
      const heading = Math.atan2(-Math.sin(angle) * Math.sign(p.speed), Math.cos(angle) * Math.sign(p.speed));
      rotation.setFromEuler(euler.set(0, heading, 0));
      matrix.compose(position, rotation, scale.set(1, 1, BODY.length));
      bodies.current?.setMatrixAt(i, matrix);
      // 날개 둘: 등 위 좌우, 빠르게 파닥
      const flap = Math.sin(t * 38 + p.phase) * 0.6;
      for (const side of [-1, 1]) {
        wingOffset.compose(wingPosition.set(side * 0.08, 0.08, 0), wingRotation.setFromEuler(euler.set(0, 0, side * (0.5 + flap))), ONE);
        matrix.compose(position, rotation, ONE);
        wings.current?.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), wingMatrix.multiplyMatrices(matrix, wingOffset));
      }
    });
    for (const mesh of [bodies.current, wings.current]) if (mesh) mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* 몸: 앞뒤로 긴 노란 공 + 검은 줄 둘 (고리는 안쪽이 비어 있어 양면으로) */}
      <instancedMesh ref={bodies} args={[bodyShape, undefined, Math.max(1, count)]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.65} side={DoubleSide} />
      </instancedMesh>
      {/* 날개: 반투명 흰 판 */}
      <instancedMesh ref={wings} args={[undefined, undefined, Math.max(2, count * 2)]} frustumCulled={false}>
        <planeGeometry args={[0.12, 0.08]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.7} side={DoubleSide} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
