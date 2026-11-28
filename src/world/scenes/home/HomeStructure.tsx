/**
 * 집 안 방 모양: 바닥 · 벽 · 창문 · 문 · 굽도리.
 *
 * 태블릿 그리기 호출을 줄이려고 합쳐 그린다 (2026-11 점검: 집 안 54번 → 약 35번):
 *  - 벽 세 장은 모양 하나 (벽지 질감은 벽마다 같은 크기로 깔리게 uv 를 늘린다, props/mergedBoxes)
 *  - 나무 부품(창틀 6 · 문 · 문틀 · 손잡이 · 굽도리 3)은 꼭짓점 색으로 모양 하나 (props/coloredParts)
 *  - 나무 부품은 그림자를 드리우지 않는다 (문 그림자는 필요 없다, 창틀 그림자는 벽에 져서 안 보였다)
 * 벽지 · 바닥은 흰 바탕 무늬 질감에 고른 색을 곱해 칠한다 (상점 미리보기와 같은 계산 — icons.ts surfaceStyle).
 */
import { useEffect, useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import type { Material } from 'three';
import { PALETTE } from '@/config/artTokens';
import { ASSETS } from '@/config/assets';
import { ArtTexture } from '../../rendering/assets';
import { applyGroundShadow } from '../../rendering/groundShadow';
import { mergedBoxGeometry } from '../../props/mergedBoxes';
import { coloredPartsGeometry, type Part } from '../../props/coloredParts';
import { WindowView } from '../../props/WindowView';
import {
  BACK_Z,
  DOOR,
  FRONT_EXTENSION,
  HALF_W,
  ROOM,
  VISIBLE_WALL_HEIGHT,
  WALL_THICKNESS,
  WINDOW,
} from './homeLayout';

/** 흰 바탕 무늬 질감 × 고른 색 */
function SurfaceMaterial({
  textureKey,
  color,
  repeat,
  bakedShadow = false,
}: {
  textureKey: string;
  color: string;
  repeat: [number, number];
  /** 바닥: 미리 그린 가구 그림자를 칠한다 (rendering/groundShadow) */
  bakedShadow?: boolean;
}): React.ReactElement {
  return (
    <ArtTexture assetKey={textureKey} repeat={repeat}>
      {(map) => (
        <meshStandardMaterial
          ref={bakedShadow ? (material: Material | null) => material && applyGroundShadow(material) : undefined}
          map={map}
          color={color}
          roughness={0.95}
        />
      )}
    </ArtTexture>
  );
}

export function Floor({
  textureKey,
  color,
  onClick,
  onPointerMove,
}: {
  textureKey: string;
  color: string;
  onClick: (event: ThreeEvent<MouseEvent>) => void;
  onPointerMove: (event: ThreeEvent<PointerEvent>) => void;
}): React.ReactElement {
  return (
    <mesh position-z={FRONT_EXTENSION / 2} rotation-x={-Math.PI / 2} receiveShadow onClick={onClick} onPointerMove={onPointerMove}>
      <planeGeometry args={[ROOM.width, ROOM.depth + FRONT_EXTENSION]} />
      <SurfaceMaterial
        textureKey={textureKey}
        color={color}
        repeat={[ROOM.width / 2, (ROOM.depth + FRONT_EXTENSION) / 2]}
        bakedShadow
      />
    </mesh>
  );
}

/**
 * 벽 세 장(뒤 · 왼쪽 · 오른쪽)을 모양 하나로. 벽은 그림자를 드리우지 않는다
 * (해가 왼쪽 위에 있어 왼쪽 벽 그림자가 바닥을 반이나 덮는다).
 * 뒷벽을 누르면 onBackWall* 로 넘긴다 (시계 · 액자를 누른 가로 자리에 건다). 옆벽은 누르는 일이 없다.
 */
export function Walls({
  textureKey,
  color,
  onBackWallClick,
  onBackWallMove,
}: {
  textureKey: string;
  color: string;
  onBackWallClick: (event: ThreeEvent<MouseEvent>) => void;
  onBackWallMove: (event: ThreeEvent<PointerEvent>) => void;
}): React.ReactElement {
  const geometry = useMemo(() => {
    const backLength = ROOM.width + WALL_THICKNESS;
    const sideLength = ROOM.depth + FRONT_EXTENSION;
    const y = VISIBLE_WALL_HEIGHT / 2;
    const uv = (length: number): [number, number] => [length / 2, VISIBLE_WALL_HEIGHT / 2];
    return mergedBoxGeometry([
      { x: 0, y, z: BACK_Z, w: backLength, h: VISIBLE_WALL_HEIGHT, d: WALL_THICKNESS, uvRepeat: uv(backLength) },
      { x: -HALF_W, y, z: FRONT_EXTENSION / 2, w: sideLength, h: VISIBLE_WALL_HEIGHT, d: WALL_THICKNESS, rotationY: Math.PI / 2, uvRepeat: uv(sideLength) },
      { x: HALF_W, y, z: FRONT_EXTENSION / 2, w: sideLength, h: VISIBLE_WALL_HEIGHT, d: WALL_THICKNESS, rotationY: -Math.PI / 2, uvRepeat: uv(sideLength) },
    ]);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const onBackWall = (z: number) => z < BACK_Z + WALL_THICKNESS;
  return (
    <mesh
      geometry={geometry}
      receiveShadow
      onClick={(event) => onBackWall(event.point.z) && onBackWallClick(event)}
      onPointerMove={(event) => onBackWall(event.point.z) && onBackWallMove(event)}
    >
      {/* 질감 반복은 uv 로 넣었으니 [1, 1] */}
      <SurfaceMaterial textureKey={textureKey} color={color} repeat={[1, 1]} />
    </mesh>
  );
}

/** 나무 부품: 창틀 · 문 · 문틀 · 손잡이 · 굽도리 (모양 하나, 꼭짓점 색) */
function woodworkParts(): Part[] {
  const parts: Part[] = [];
  // 창틀 (뒷벽 앞)
  const wz = BACK_Z + WALL_THICKNESS / 2 + 0.01 + 0.05;
  for (const [x, y, w, h] of [
    [0, WINDOW.height / 2, WINDOW.width + 0.16, 0.12],
    [0, -WINDOW.height / 2, WINDOW.width + 0.16, 0.12],
    [-WINDOW.width / 2, 0, 0.12, WINDOW.height],
    [WINDOW.width / 2, 0, 0.12, WINDOW.height],
    [0, 0, 0.08, WINDOW.height],
    [0, 0, WINDOW.width, 0.08],
  ]) {
    parts.push({ at: [WINDOW.x + x, WINDOW.y + y, wz], size: [w, h, 0.08], color: PALETTE.wood });
  }
  // 문 (왼쪽 벽 안쪽, 방 쪽을 본다): 문짝 · 문틀 · 손잡이
  const dx = -HALF_W + WALL_THICKNESS / 2 + 0.02;
  const dy = DOOR.height / 2;
  parts.push({ at: [dx, dy, DOOR.z], size: [0.06, DOOR.height, DOOR.width], color: PALETTE.woodDark });
  parts.push({ at: [dx - 0.02, dy, DOOR.z], size: [0.04, DOOR.height + 0.12, DOOR.width + 0.2], color: PALETTE.wood });
  parts.push({ from: [dx + 0.02, dy, DOOR.z - DOOR.width * 0.32], to: [dx + 0.1, dy, DOOR.z - DOOR.width * 0.32], radius: 0.06, color: PALETTE.gold });
  // 굽도리 (벽 아래)
  parts.push({ at: [0, 0.08, BACK_Z + WALL_THICKNESS / 2 + 0.02], size: [ROOM.width, 0.16, 0.04], color: PALETTE.woodDark });
  parts.push({ at: [-HALF_W + WALL_THICKNESS / 2 + 0.02, 0.08, FRONT_EXTENSION / 2], size: [0.04, 0.16, ROOM.depth + FRONT_EXTENSION], color: PALETTE.woodDark });
  parts.push({ at: [HALF_W - WALL_THICKNESS / 2 - 0.02, 0.08, FRONT_EXTENSION / 2], size: [0.04, 0.16, ROOM.depth + FRONT_EXTENSION], color: PALETTE.woodDark });
  return parts;
}

/**
 * 나무 부품 한 덩어리. 그림자는 드리우지 않는다 (사용자 요청: 문 그림자는 필요 없다).
 * 창틀 그림자는 원래 뒷벽 위에 져서 바닥에는 문 그림자만 보였다.
 */
export function Woodwork(): React.ReactElement {
  const geometry = useMemo(() => coloredPartsGeometry(woodworkParts()), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={0.85} />
    </mesh>
  );
}

/** 창밖 풍경: 집 뒤 잔디와 우거진 나무 그림 (props/WindowView, 시간에 따라 어두워진다) */
export function WindowGlass(): React.ReactElement {
  return (
    <WindowView
      assetKey={ASSETS.environment.homeWindow}
      width={WINDOW.width}
      height={WINDOW.height}
      position={[WINDOW.x, WINDOW.y, BACK_Z + WALL_THICKNESS / 2 + 0.03]}
      fallbackColor={PALETTE.windowLight}
    />
  );
}
