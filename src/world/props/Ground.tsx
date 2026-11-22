/**
 * 마당 바닥: 잔디, 흙길. (둘러싼 숲은 ForestWall)
 */
import { useEffect, useMemo } from 'react';
import { Shape, ShapeGeometry, Vector2, type Material, type Texture } from 'three';
import { ASSETS } from '@/config/assets';
import { PALETTE } from '@/config/artTokens';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ArtTexture } from '../rendering/assets';
import { applyGroundShadow } from '../rendering/groundShadow';
import { TEST_FLAGS } from '../debug/testFlags';

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
        {(map) => <GroundMaterial map={map} fallbackColor={PALETTE.grass} />}
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
export interface PathSegment {
  from: { x: number; z: number };
  to: { x: number; z: number };
  /** 길 폭 (m). 기본 1.6 */
  width?: number;
}

/** 길 한 토막의 모양 (끝이 둥근 띠). 무늬 좌표 = 땅 좌표 */
function pathSegmentGeometry({ from, to, width = 1.6 }: PathSegment): ShapeGeometry {
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
}

/**
 * 장면의 길 전체. 토막들을 모양 하나로 합쳐 한 번에 그린다 (토막마다 그리면 그리기 호출이 토막 수만큼 든다).
 * 토막이 겹치는 곳은 무늬가 땅 좌표에 붙어 있어 똑같이 보인다.
 */
export function PathNetwork({ segments }: { segments: PathSegment[] }): React.ReactElement {
  const key = JSON.stringify(segments);
  const geometry = useMemo(() => {
    const parts = segments.map(pathSegmentGeometry);
    const merged = mergeGeometries(parts, false);
    for (const part of parts) part.dispose();
    return merged;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
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
      {(map) => <GroundMaterial map={map} fallbackColor={PALETTE.path} raised />}
    </ArtTexture>
  );
}

/**
 * 땅 · 길 재질. 화면의 대부분을 차지해서 픽셀마다 하는 계산이 프레임을 좌우한다.
 * 땅은 원래 반사가 없는 무광이라 반사광 계산(PBR)을 뺀 가벼운 재질(Lambert)로 그린다.
 * 화면 밝기를 재 보니 예전 재질과 거의 같았다 (풀 186→184, 길 216→216, 그림자 속 풀 128→132).
 * 미리 그린 그림자도 여기서 같이 칠한다 (rendering/groundShadow).
 * 사물(모델)은 원래 재질 그대로다. ?pbrground 로 예전 재질과 비교할 수 있다.
 */
function GroundMaterial({ map, fallbackColor, raised = false }: { map: Texture | null; fallbackColor: string; raised?: boolean }): React.ReactElement {
  const offset = raised ? { polygonOffset: true, polygonOffsetFactor: -1 } : {};
  const attach = (material: Material | null) => {
    if (material) applyGroundShadow(material);
  };
  if (TEST_FLAGS.pbrGround) {
    return <meshStandardMaterial ref={attach} map={map} color={map ? '#ffffff' : fallbackColor} roughness={1} {...offset} />;
  }
  return (
    <meshLambertMaterial ref={attach} map={map} color={map ? '#ffffff' : fallbackColor} {...offset} />
  );
}
