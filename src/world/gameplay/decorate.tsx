/**
 * 3D 꾸미기: 가구 · 장식을 바닥에 놓고, 옮기고, 돌리고, 치운다. (명세 29)
 * 배치에는 문제를 내지 않는다 — 창작 활동을 끊지 않기 위해서다. (명세 78)
 *
 * React 의 꾸미기 패널(DecorateOverlay)과는 bridge 이벤트로만 이야기한다.
 *  - decorate:mode  꾸미기를 켜고 끔
 *  - decorate:pick  가방에서 물건을 골랐다 → 반투명 미리보기를 들고, 바닥을 누르면 놓는다
 *  - decorate:tool  옮기기 · 돌리기 · 치우기
 *  - decorate:holding / decorate:placed  들고 있는지, 놓았는지 패널에 알린다
 *
 * 장면(마당 · 집)은 DecorateSystem 에 놓을 수 있는 범위를 알려 주고,
 * 바닥을 누르면 decorateFloorTap 을 먼저 불러 본다 (꾸미기 중이면 걷지 않고 놓는다).
 */
import { useCallback, useEffect, useMemo } from 'react';
import { Color, type Material, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { create } from 'zustand';
import { FURNITURE_BY_ID } from '@/config/catalog';
import { FURNITURE_3D } from '@/config/furniture3d';
import { furnitureModelKey } from '@/config/models';
import { PALETTE } from '@/config/artTokens';
import { gameEvents } from '@/bridge/eventBus';
import type { DecorateTool } from '@/bridge/events';
import { useGameStore } from '@/state/gameStore';
import type { PlacedItem, PlacementArea } from '@/types/game';
import { audio } from '@/audio/sfx';
import { GltfModel } from '../rendering/assets';
import { DRAWN_RUGS, DrawnRug } from '../props/DrawnRug';
import { NightGlow } from '../rendering/dayNight';
import { burstStars } from '../effects/effects';
import { toast } from './gameplay';
import { obstacles, player } from '../state/runtime';

/** 놓는 자리를 이 간격에 맞춘다 (m). 줄 맞춰 놓기 쉽게 */
const GRID = 0.25;

/** 장면이 알려 주는 놓기 규칙 */
export interface DecorateRules {
  area: PlacementArea;
  /** 바닥에 놓을 수 있는 범위 */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** 벽에 거는 물건을 붙일 벽 (집 안 뒷벽). 없으면 벽에 거는 물건은 못 놓는다 */
  wall?: { z: number; y: number; minX: number; maxX: number };
  /** 장면만의 금지 구역 (마당의 밭 등) */
  blocked?: (x: number, z: number, radius: number) => boolean;
}

interface DecorateState {
  on: boolean;
  tool: DecorateTool;
  /** 가방에서 골라 들고 있는 물건 */
  pendingItemId: string | null;
  /** 옮기려고 집어 든 놓인 물건 */
  movingId: string | null;
  /** 미리보기 위치 */
  ghost: { x: number; z: number } | null;
  /** 미리보기 자리에 놓을 수 있는지 */
  valid: boolean;
}

export const useDecorate = create<DecorateState>(() => ({
  on: false,
  tool: 'move',
  pendingItemId: null,
  movingId: null,
  ghost: null,
  valid: true,
}));

let rules: DecorateRules | null = null;

/**
 * 패널이 마지막으로 보낸 꾸미기 켜기/끄기 · 도구.
 * 장면이 모델을 불러오는 중에 꾸미기 창을 열면 DecorateSystem 이 아직 없어 신호를 놓친다.
 * 장면이 늦게 붙어도 이것을 보고 이어서 켠다.
 */
const requested: { on: boolean; area: PlacementArea | null; tool: DecorateTool } = { on: false, area: null, tool: 'move' };
gameEvents.on('decorate:mode', ({ on, area }) => Object.assign(requested, { on, area }));
gameEvents.on('decorate:tool', ({ tool }) => {
  requested.tool = tool;
});

function placedList(area: PlacementArea): PlacedItem[] {
  const state = useGameStore.getState();
  return area === 'home' ? state.home.placed : state.yard.placed;
}

/** 들고 있는 물건의 가구 id */
function heldItemId(): string | null {
  const { pendingItemId, movingId } = useDecorate.getState();
  if (pendingItemId) return pendingItemId;
  if (movingId && rules) return placedList(rules.area).find((p) => p.instanceId === movingId)?.itemId ?? null;
  return null;
}

function snap(value: number): number {
  return Math.round(value / GRID) * GRID;
}

/** 이 자리에 이 물건을 놓을 수 있는지 */
function canPlace(itemId: string, x: number, z: number, ignoreId: string | null): boolean {
  if (!rules) return false;
  const size = FURNITURE_3D[itemId];
  if (size.wall) {
    const wall = rules.wall;
    if (!wall || x - size.radius < wall.minX || x + size.radius > wall.maxX) return false;
    // 벽에 건 물건끼리만 겹치지 않으면 된다
    return !placedList(rules.area).some(
      (p) =>
        p.instanceId !== ignoreId &&
        FURNITURE_3D[p.itemId]?.wall &&
        Math.abs(p.x - x) < FURNITURE_3D[p.itemId].radius + size.radius,
    );
  }
  const { bounds } = rules;
  const r = size.radius;
  if (x - r < bounds.minX || x + r > bounds.maxX || z - r < bounds.minZ || z + r > bounds.maxZ) return false;
  if (rules.blocked?.(x, z, r)) return false;

  // 카펫 · 돌길 같은 납작한 것은 다른 물건과 겹쳐도 된다 (카펫 위에 탁자)
  if (!size.walkable) {
    for (const p of placedList(rules.area)) {
      if (p.instanceId === ignoreId) continue;
      const other = FURNITURE_3D[p.itemId];
      if (!other || other.wall || other.walkable) continue;
      if (Math.hypot(p.x - x, p.z - z) < r + other.radius - 0.1) return false;
    }
    // 장면의 물건(집 · 나무 · 동물 …)과 캐릭터 자리
    for (const [key, obstacle] of obstacles) {
      if (key.startsWith('placed_')) continue;
      if (obstacle.kind === 'circle') {
        if (Math.hypot(obstacle.x - x, obstacle.z - z) < obstacle.radius + r) return false;
      } else if (
        x + r > obstacle.minX &&
        x - r < obstacle.maxX &&
        z + r > obstacle.minZ &&
        z - r < obstacle.maxZ
      ) {
        return false;
      }
    }
    if (Math.hypot(player.position.x - x, player.position.z - z) < r + 0.3) return false;
  }
  return true;
}

function setHolding(holding: boolean): void {
  gameEvents.emit('decorate:holding', { holding });
}

function cancelHold(): void {
  const { pendingItemId, movingId } = useDecorate.getState();
  if (!pendingItemId && !movingId) return;
  useDecorate.setState({ pendingItemId: null, movingId: null, ghost: null });
  setHolding(false);
}

/** 미리보기를 이 자리로 (바닥 위를 손가락 · 마우스가 지날 때) */
export function decorateFloorHover(x: number, z: number): void {
  const itemId = heldItemId();
  if (!itemId || !rules) return;
  const r = FURNITURE_3D[itemId].radius;
  const wall = FURNITURE_3D[itemId].wall ? rules.wall : undefined;
  // 끝 쪽을 누르면 거절하지 않고 물건이 다 들어가게 안쪽으로 밀어 놓는다.
  // (침대 · 소파는 반지름이 1m 라, 방 끝 1m 안을 누르면 늘 놓을 수 없었다)
  const { bounds } = rules;
  const at = wall
    ? { x: snap(clampInside(x, wall.minX + r, wall.maxX - r)), z: wall.z }
    : {
        x: snap(clampInside(x, bounds.minX + r, bounds.maxX - r)),
        z: snap(clampInside(z, bounds.minZ + r, bounds.maxZ - r)),
      };
  useDecorate.setState({ ghost: at, valid: canPlace(itemId, at.x, at.z, useDecorate.getState().movingId) });
}

/** min ~ max 안으로. 칸 맞추기(snap)로 다시 밖으로 나가지 않게 칸 크기만큼 더 안쪽으로 */
function clampInside(value: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2;
  return Math.min(max - GRID / 2, Math.max(min + GRID / 2, value));
}

/**
 * 바닥을 눌렀다. 꾸미기 중이면 들고 있는 물건을 놓고 true 를 돌려준다 (그러면 캐릭터는 걷지 않는다).
 */
export function decorateFloorTap(x: number, z: number): boolean {
  const state = useDecorate.getState();
  if (!state.on || !rules) return false;
  const itemId = heldItemId();
  if (!itemId) return true; // 꾸미기 중에는 바닥을 눌러도 걷지 않는다 (물건을 누르려다 걷는 일을 막는다)

  decorateFloorHover(x, z);
  const { ghost, valid } = useDecorate.getState();
  if (!ghost) return true;
  if (!valid) {
    toast('여기에는 놓을 수 없어요', 'warn');
    return true;
  }

  const store = useGameStore.getState();
  if (state.pendingItemId) {
    const placed = store.placeItem(rules.area, state.pendingItemId, ghost.x, ghost.z);
    if (placed) gameEvents.emit('decorate:placed', { instanceId: placed.instanceId });
  } else if (state.movingId) {
    store.moveItem(rules.area, state.movingId, ghost.x, ghost.z);
  }
  audio.play('place');
  burstStars({ x: ghost.x, y: 0.6, z: ghost.z }, 6);
  useDecorate.setState({ pendingItemId: null, movingId: null, ghost: null });
  setHolding(false);
  return true;
}

/** 놓인 물건을 눌렀다. 꾸미기 중이면 도구대로 하고 true */
function tapPlaced(item: PlacedItem): boolean {
  const state = useDecorate.getState();
  if (!state.on || !rules) return false;
  const store = useGameStore.getState();

  // 다른 물건을 들고 있을 때 누르면, 그 자리에 놓으려던 것으로 본다
  if (state.pendingItemId || (state.movingId && state.movingId !== item.instanceId)) {
    decorateFloorTap(item.x, item.z);
    return true;
  }
  if (state.tool === 'remove') {
    store.retrieveItem(rules.area, item.instanceId);
    audio.play('place');
    burstStars({ x: item.x, y: 0.5, z: item.z }, 5);
    toast('가방에 넣었어요', 'info');
    return true;
  }
  if (state.tool === 'flip') {
    store.rotateItem(rules.area, item.instanceId);
    audio.play('tap');
    return true;
  }
  // 옮기기: 한 번 눌러 들고, 바닥을 눌러 놓는다 (끌지 않아도 된다 — 명세 7)
  if (state.movingId === item.instanceId) {
    cancelHold();
    return true;
  }
  useDecorate.setState({ movingId: item.instanceId, pendingItemId: null, ghost: { x: item.x, z: item.z }, valid: true });
  setHolding(true);
  return true;
}

/* ------------------------------- 장면에 다는 것 ------------------------------- */

/** 꾸미기 이벤트를 받는다. 장면마다 하나, 놓기 규칙과 함께 */
export function DecorateSystem({ rules: sceneRules }: { rules: DecorateRules }): null {
  useEffect(() => {
    rules = sceneRules;
    useDecorate.setState({
      on: requested.on && requested.area === sceneRules.area,
      tool: requested.tool,
      pendingItemId: null,
      movingId: null,
      ghost: null,
    });
    const offs = [
      gameEvents.on('decorate:mode', ({ on, area }) => {
        if (area !== sceneRules.area) return;
        if (!on) cancelHold();
        useDecorate.setState({ on });
      }),
      gameEvents.on('decorate:pick', ({ itemId, area }) => {
        if (area !== sceneRules.area) return;
        // 캐릭터 앞에서 시작한다
        const startX = player.position.x;
        const startZ = player.position.z + 1.6;
        useDecorate.setState({ pendingItemId: itemId, movingId: null, ghost: null });
        decorateFloorHover(startX, startZ);
        setHolding(true);
      }),
      gameEvents.on('decorate:tool', ({ tool }) => {
        cancelHold();
        useDecorate.setState({ tool });
      }),
    ];
    return () => {
      for (const off of offs) off();
      if (rules === sceneRules) rules = null;
      useDecorate.setState({ on: false, pendingItemId: null, movingId: null, ghost: null });
    };
  }, [sceneRules]);
  return null;
}

/**
 * 이 장면에 놓인 물건들과 들고 있는 물건의 미리보기.
 * 규칙(벽에 거는 높이)은 장면이 직접 넘긴다. 모듈의 rules 는 DecorateSystem 이 그린 뒤(useEffect)에야 바뀌어서,
 * 장면에 들어오는 첫 그림에서는 아직 없거나 앞 장면 것이다 — 그걸 읽었더니 다시 들어오면 시계 · 액자가 바닥에 붙어 있었다.
 */
export function PlacedFurnitureLayer({ rules: sceneRules }: { rules: DecorateRules }): React.ReactElement {
  const area = sceneRules.area;
  const placed = useGameStore((s) => (area === 'home' ? s.home.placed : s.yard.placed));
  const movingId = useDecorate((s) => s.movingId);
  return (
    <group>
      {placed.map((item) =>
        item.instanceId === movingId ? null : <PlacedFurniture key={item.instanceId} item={item} wallY={sceneRules.wall?.y} />,
      )}
      <Ghost wallY={sceneRules.wall?.y} />
    </group>
  );
}

/** 벽에 거는 물건은 바닥이 아니라 벽 높이에 (wallY: 장면의 벽 높이, 벽이 없는 장면이면 undefined) */
function heightOf(itemId: string, wallY: number | undefined): number {
  return FURNITURE_3D[itemId]?.wall && wallY !== undefined ? wallY : 0;
}

function PlacedFurniture({ item, wallY }: { item: PlacedItem; wallY: number | undefined }): React.ReactElement {
  const size = FURNITURE_3D[item.itemId];

  // 캐릭터가 부딪힌다 (카펫 · 돌길 · 벽에 건 것 빼고)
  useEffect(() => {
    if (!size || size.walkable || size.wall) return;
    const key = `placed_${item.instanceId}`;
    obstacles.set(key, { kind: 'circle', x: item.x, z: item.z, radius: size.radius * 0.8 });
    return () => {
      obstacles.delete(key);
    };
  }, [item.instanceId, item.x, item.z, size]);

  return (
    <group
      position={[item.x, heightOf(item.itemId, wallY), item.z]}
      rotation-y={(item.rotation ?? 0) * (Math.PI / 2)}
      onClick={(event) => {
        if (tapPlaced(item)) event.stopPropagation();
      }}
    >
      {/* 카펫은 3D 모델 대신 코드로 그린다 (무늬가 뭉개져서, props/DrawnRug) */}
      {DRAWN_RUGS[item.itemId] ? (
        <DrawnRug itemId={item.itemId} />
      ) : (
        <GltfModel
          modelKey={furnitureModelKey(item.itemId)}
          fallback={<FallbackFurniture itemId={item.itemId} />}
          castShadow={!size?.walkable}
        />
      )}
      {size?.glow && <NightGlow y={size.glow.y} size={size.glow.size} />}
    </group>
  );
}

/** 들고 있는 물건의 반투명 미리보기. 놓을 수 없는 자리면 빨갛게 */
function Ghost({ wallY }: { wallY: number | undefined }): React.ReactElement | null {
  const ghost = useDecorate((s) => s.ghost);
  const valid = useDecorate((s) => s.valid);
  const pendingItemId = useDecorate((s) => s.pendingItemId);
  const movingId = useDecorate((s) => s.movingId);
  const itemId = pendingItemId ?? (movingId ? heldItemId() : null);
  const rotation = useMemo(() => {
    if (!movingId || !rules) return 0;
    return placedList(rules.area).find((p) => p.instanceId === movingId)?.rotation ?? 0;
  }, [movingId]);

  // 미리보기용으로 재질을 복제해서 반투명하게 (원본 모델의 재질을 건드리지 않는다)
  const tint = valid ? '#ffffff' : '#ff8a80';
  const onLoaded = useCallback(
    (object: Object3D | null) => {
      object?.traverse((node) => {
        const mesh = node as Mesh;
        if (!mesh.isMesh) return;
        // 그림자 사본은 미리보기에 필요 없다 (그림자도 안 만든다)
        if (mesh.userData.shadowProxy) {
          mesh.castShadow = false;
          return;
        }
        const material = (mesh.userData.ghostMaterial as MeshStandardMaterial | undefined) ??
          ((mesh.material as Material).clone() as MeshStandardMaterial);
        material.transparent = true;
        material.opacity = 0.55;
        material.depthWrite = false;
        material.color = new Color(tint);
        mesh.userData.ghostMaterial = material;
        mesh.material = material;
        mesh.castShadow = false;
      });
    },
    [tint],
  );

  if (!ghost || !itemId) return null;
  return (
    <group position={[ghost.x, heightOf(itemId, wallY), ghost.z]} rotation-y={rotation * (Math.PI / 2)}>
      {DRAWN_RUGS[itemId] ? (
        <DrawnRug itemId={itemId} ghost tint={tint} />
      ) : (
        <GltfModel
          key={itemId}
          modelKey={furnitureModelKey(itemId)}
          castShadow={false}
          onLoaded={onLoaded}
          fallback={<FallbackFurniture itemId={itemId} ghost tint={tint} />}
        />
      )}
      {/* 놓일 자리 표시 */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.04}>
        <ringGeometry args={[FURNITURE_3D[itemId].radius * 0.85, FURNITURE_3D[itemId].radius, 32]} />
        <meshBasicMaterial color={valid ? PALETTE.leaf : '#e8524a'} transparent opacity={0.7} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** 모델이 아직 없을 때의 임시 가구: 가구 색 상자 */
function FallbackFurniture({ itemId, ghost, tint }: { itemId: string; ghost?: boolean; tint?: string }): React.ReactElement {
  const size = FURNITURE_3D[itemId];
  const def = FURNITURE_BY_ID[itemId];
  const width = size.width ?? size.radius * 1.6;
  const height = size.height ?? 0.06;
  return (
    <mesh position-y={height / 2} castShadow={!ghost}>
      <boxGeometry args={[width, height, size.wall ? 0.08 : size.radius * 1.2]} />
      <meshStandardMaterial
        color={ghost ? tint : def?.tint}
        transparent={ghost}
        opacity={ghost ? 0.55 : 1}
        roughness={0.85}
      />
    </mesh>
  );
}
