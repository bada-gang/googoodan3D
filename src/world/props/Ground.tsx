/**
 * 마당 바닥: 잔디, 흙길, 멀리 둘러싼 언덕.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, Matrix4, Shape, ShapeGeometry, Vector2, type InstancedMesh } from 'three';
import { ASSETS } from '@/config/assets';
import { PALETTE } from '@/config/artTokens';
import { ArtTexture } from '../assets3d';

/** 잔디 질감 한 장이 덮는 크기 (m). 작으면 무늬가 반복되는 게 보이고, 크면 흐릿하다 */
const GRASS_TILE = 4;
const PATH_TILE = 2;
/** 땅 좌표 1m 당 무늬 반복 (모든 길이 같아야 겹친 곳이 똑같이 보인다) */
const PATH_REPEAT: [number, number] = [1 / PATH_TILE, 1 / PATH_TILE];
/** 길 끝 반원을 나누는 조각 수 */
const PATH_END_SEGMENTS = 14;

export function GrassGround({ width, depth }: { width: number; depth: number }): React.ReactElement {
  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <ArtTexture assetKey={ASSETS.textures.grass} repeat={[width / GRASS_TILE, depth / GRASS_TILE]}>
        {(map) => <meshStandardMaterial map={map} color={map ? '#ffffff' : PALETTE.grass} roughness={1} />}
      </ArtTexture>
    </mesh>
  );
}

/**
 * 흙길 한 토막: 양 끝이 둥근 띠. 잔디 위에 살짝 띄워 깐다 (z-fighting 방지).
 *
 * 무늬는 길마다가 아니라 땅 좌표에 붙인다. 길이 겹치는 곳은 같은 높이의 면 두 장이 겹치는데,
 * 무늬가 서로 다르면 카메라가 움직일 때 두 무늬가 번갈아 보인다. 땅 좌표로 맞추면 두 장이 똑같이 보인다.
 */
export function PathStrip({
  from,
  to,
  width = 1.6,
}: {
  from: { x: number; z: number };
  to: { x: number; z: number };
  width?: number;
}): React.ReactElement {
  const geometry = useMemo(() => {
    const length = Math.hypot(to.x - from.x, to.z - from.z) || 1e-4;
    const forward = { x: (to.x - from.x) / length, z: (to.z - from.z) / length };
    const side = { x: -forward.z, z: forward.x };
    const radius = width / 2;
    const points: Vector2[] = [];
    // 끝 → 반원 → 시작 → 반원. 눕힐 때 (x, y) → (x, 0, -y) 가 되므로 y 에는 -z 를 넣는다
    const arc = (center: { x: number; z: number }, startAngle: number) => {
      for (let i = 0; i <= PATH_END_SEGMENTS; i += 1) {
        const a = startAngle - (Math.PI * i) / PATH_END_SEGMENTS;
        const x = center.x + radius * (Math.cos(a) * forward.x + Math.sin(a) * side.x);
        const z = center.z + radius * (Math.cos(a) * forward.z + Math.sin(a) * side.z);
        points.push(new Vector2(x, -z));
      }
    };
    arc(to, Math.PI / 2);
    arc(from, -Math.PI / 2);
    // ShapeGeometry 의 uv 는 모양 좌표 그대로 = 땅 좌표
    return new ShapeGeometry(new Shape(points));
  }, [from.x, from.z, to.x, to.z, width]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} rotation-x={-Math.PI / 2} position-y={0.012} receiveShadow>
      <PathMaterial repeat={PATH_REPEAT} />
    </mesh>
  );
}

function PathMaterial({ repeat }: { repeat: [number, number] }): React.ReactElement {
  return (
    <ArtTexture assetKey={ASSETS.textures.path} repeat={repeat}>
      {(map) => (
        <meshStandardMaterial
          map={map}
          color={map ? '#ffffff' : PALETTE.path}
          roughness={1}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      )}
    </ArtTexture>
  );
}

/**
 * 걸어 다니는 범위 밖을 둘러싼 언덕과 덤불. 세상의 끝이 허공으로 보이지 않게 한다.
 * 위치는 고정된 씨앗으로 만들어 매번 같은 풍경이 된다.
 */
export function Surroundings({
  bounds,
}: {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}): React.ReactElement {
  const items = useMemo(() => {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const list: { x: number; z: number; r: number; color: string; kind: 'hill' | 'bush' }[] = [];
    // 뒤쪽(북쪽)과 양옆에 언덕. 카메라 쪽(남쪽)은 비워 둔다 — 화면을 가린다
    for (let i = 0; i < 14; i += 1) {
      const t = i / 13;
      list.push({
        x: bounds.minX - 6 + t * (bounds.maxX - bounds.minX + 12),
        z: bounds.minZ - 5 - random() * 4,
        r: 4 + random() * 3,
        color: random() > 0.5 ? PALETTE.farHill : PALETTE.midHill,
        kind: 'hill',
      });
    }
    for (const side of [bounds.minX - 4, bounds.maxX + 4]) {
      for (let i = 0; i < 5; i += 1) {
        list.push({
          x: side + (random() - 0.5) * 3,
          z: bounds.minZ + (i / 4) * (bounds.maxZ - bounds.minZ),
          r: 3 + random() * 2,
          color: PALETTE.midHill,
          kind: 'hill',
        });
      }
    }
    // 경계선을 따라 덤불
    for (let i = 0; i < 22; i += 1) {
      const t = random();
      const onBack = i % 2 === 0;
      list.push({
        x: onBack ? bounds.minX + t * (bounds.maxX - bounds.minX) : random() > 0.5 ? bounds.minX - 0.8 : bounds.maxX + 0.8,
        z: onBack ? bounds.minZ - 0.8 : bounds.minZ + t * (bounds.maxZ - bounds.minZ),
        r: 0.5 + random() * 0.5,
        color: random() > 0.5 ? PALETTE.leaf : PALETTE.leafShade,
        kind: 'bush',
      });
    }
    return list;
  }, [bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ]);

  // 언덕 · 덤불은 각각 한 번에 그린다 (인스턴싱). 따로 그리면 46번이라 태블릿에 무겁다
  const hills = useMemo(() => items.filter((item) => item.kind === 'hill'), [items]);
  const bushes = useMemo(() => items.filter((item) => item.kind === 'bush'), [items]);
  const hillMesh = useRef<InstancedMesh>(null);
  const bushMesh = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const matrix = new Matrix4();
    const color = new Color();
    const place = (mesh: InstancedMesh | null, list: typeof items, hill: boolean) => {
      if (!mesh) return;
      list.forEach((item, i) => {
        // 모양은 반지름 1 짜리 하나를 크기만 바꿔 쓴다
        const y = hill ? -item.r * 0.55 : item.r * 0.55;
        matrix.makeScale(item.r, item.r * (hill ? 0.75 : 1), item.r).setPosition(item.x, y, item.z);
        mesh.setMatrixAt(i, matrix);
        mesh.setColorAt(i, color.set(item.color));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    place(hillMesh.current, hills, true);
    place(bushMesh.current, bushes, false);
  }, [hills, bushes]);

  return (
    <group>
      <instancedMesh ref={hillMesh} args={[undefined, undefined, hills.length]} receiveShadow>
        <sphereGeometry args={[1, 20, 12]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
      <instancedMesh ref={bushMesh} args={[undefined, undefined, bushes.length]} castShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </instancedMesh>
    </group>
  );
}
