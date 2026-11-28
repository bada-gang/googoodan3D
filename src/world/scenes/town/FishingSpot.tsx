/**
 * 시장 낚시터: 가구 가게 맞은편의 연못과 나무 데크, 낚싯대 · 찌 연출.
 *
 * 데크 위에서만 "낚시하기" 버튼이 뜬다 (연못 둘레는 물에 들어갈 수 없고 낚시도 못 한다).
 * 버튼 → 곱셈 문제를 맞히면 찌를 달아 던진다 → 입질 → React 낚시 창(막대 멈추기)이 잡을지 정한다.
 * 진행 단계는 state/fishingStore 에 있고, 여기는 그 단계에 맞춰 낚싯대 · 찌를 움직인다.
 * 물은 움직이지 않는다 (찌 둘레 물결만 잠깐 퍼진다). 물 무늬는 분수대 물 같은 그림(tex_water).
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  type Group,
  type InstancedMesh,
  Line,
  LineBasicMaterial,
  Matrix4,
  type Mesh,
  type MeshBasicMaterial,
  Quaternion,
  Euler,
  Shape,
  ShapeGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ASSETS } from '@/config/assets';
import { FISHING } from '@/config/fishing';
import { rodLook } from '@/config/rods';
import { TOWN } from '@/config/layout';
import { useFishing } from '@/state/fishingStore';
import { useGameStore } from '@/state/gameStore';
import { applyGroundShadow } from '../../rendering/groundShadow';
import { StaticShadow } from '../../rendering/bakedShadows';
import { ArtTexture } from '../../rendering/assets';
import { useInteractable } from '../../systems/interaction';
import { groundHeight, obstacles, player, playEmote, raisedAreas } from '../../state/runtime';
import { SignBoard } from '../../props/SignBoard';
import { askMath, awardExperience } from '../../gameplay/gameplay';
import { burstStars } from '../../effects/effects';
import { spawnParticles } from '../../effects/particles';

const POND = TOWN.pond;
const DECK = POND.deck;

/** 물 높이 (땅 위로 살짝). 데크 바닥보다 낮다 */
const WATER_Y = 0.03;
/** 낚시할 때 서는 자리: 데크 앞쪽 끝에서 이만큼 안쪽 */
const STAND_BACK = 0.32;
/** 낚시할 때 바라보는 방향: 카메라 쪽(+z)에서 오른쪽으로 조금 돌아, 낚싯대가 옆모습으로 보이게 */
const FISHING_FACING = 0.8;
/** 낚싯대는 몸 앞을 가로지르지 않게 오른손 바깥쪽(캐릭터의 오른쪽 = −각)으로 조금 돌려 내민다 */
const ROD_YAW = -0.3;
/** 찌를 던지는 방향 = 캐릭터가 보는 쪽 + 낚싯대를 돌린 만큼 */
const CAST_ANGLE = FISHING_FACING + ROD_YAW;
/** 찌가 떨어지는 거리 (캐릭터에서) */
const CAST_DISTANCE = 1.6;

const COLORS = {
  shore: '#d9c18f',
  water: '#7fcfdc',
  /** 깊은 가운데에 곱하는 색 (물 무늬가 짙은 청록이 된다) */
  deepTint: '#7fb4cc',
  stones: ['#b9b3a6', '#a7a196', '#c8c1b1', '#9d978b'],
  reed: ['#6fae57', '#5f9e4c', '#7dbb62'],
  cattail: '#8a5a36',
  lily: '#79bd57',
  flower: '#f5a7c0',
};

/** 고정 씨앗 난수 (매번 같은 자리에 돌 · 풀) */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** 모서리가 둥근 네모 (연못 모양). 가운데 기준, 바닥(xz)에 눕힌다 */
function roundedRect(halfX: number, halfZ: number, radius: number): ShapeGeometry {
  const r = Math.min(radius, halfX, halfZ);
  const shape = new Shape();
  shape.moveTo(-halfX + r, -halfZ);
  shape.lineTo(halfX - r, -halfZ);
  shape.quadraticCurveTo(halfX, -halfZ, halfX, -halfZ + r);
  shape.lineTo(halfX, halfZ - r);
  shape.quadraticCurveTo(halfX, halfZ, halfX - r, halfZ);
  shape.lineTo(-halfX + r, halfZ);
  shape.quadraticCurveTo(-halfX, halfZ, -halfX, halfZ - r);
  shape.lineTo(-halfX, -halfZ + r);
  shape.quadraticCurveTo(-halfX, -halfZ, -halfX + r, -halfZ);
  const geometry = new ShapeGeometry(shape, 12);
  // 모양은 xy 평면에 생긴다. x 축으로 -90° 돌려 바닥에 눕힌다 (윗면이 하늘을 본다)
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/* -------------------------------- 낚시터 -------------------------------- */

export function FishingSpot(): React.ReactElement {
  useEffect(() => {
    const { center, half } = POND;
    const water = {
      minX: center.x - half.x,
      maxX: center.x + half.x,
      minZ: center.z - half.z,
      maxZ: center.z + half.z,
    };
    // 물에는 못 들어간다. 데크 자리만 비운 세 토막 (왼쪽 · 오른쪽 · 데크 앞)
    const blocks = {
      pond_left: { kind: 'box' as const, minX: water.minX, maxX: DECK.minX, minZ: water.minZ, maxZ: water.maxZ },
      pond_right: { kind: 'box' as const, minX: DECK.maxX, maxX: water.maxX, minZ: water.minZ, maxZ: water.maxZ },
      pond_front: { kind: 'box' as const, minX: DECK.minX, maxX: DECK.maxX, minZ: DECK.maxZ, maxZ: water.maxZ },
    };
    for (const [key, block] of Object.entries(blocks)) obstacles.set(key, block);
    raisedAreas.set('fishing_deck', { ...DECK, height: POND.deckHeight });
    return () => {
      for (const key of Object.keys(blocks)) obstacles.delete(key);
      raisedAreas.delete('fishing_deck');
      // 낚시 도중 장면이 바뀌면 그만둔다
      useFishing.getState().cancel();
      player.pose = null;
    };
  }, []);

  useInteractable({
    id: 'fishing_deck',
    position: () => ({ x: (DECK.minX + DECK.maxX) / 2, z: DECK.maxZ }),
    // 데크 위에 올라서야 버튼이 뜬다 (큰길에 걸친 데크 입구는 빼고)
    area: { minX: DECK.minX, maxX: DECK.maxX, minZ: DECK.minZ + 0.3, maxZ: DECK.maxZ },
    prompts: () => {
      if (useFishing.getState().phase !== 'idle') return [];
      const left = useGameStore.getState().fishingCastsLeft();
      return [
        {
          id: 'fish',
          label: '낚시하기',
          enabled: left > 0,
          highlight: left > 0,
          hint: left > 0 ? `오늘 ${left}번 남았어요` : '오늘 낚시는 다 했어요. 내일 또 와요',
        },
      ];
    },
    onAction: () => startFishing(),
  });

  return (
    <group>
      <StaticShadow>
        <Pond />
        <Stones />
        <Reeds />
        <LilyPads />
        <group position={[DECK.minX - 0.55, 0, DECK.minZ + 0.1]} rotation-y={0.25}>
          <SignBoard text="낚시터" width={1.3} />
        </group>
      </StaticShadow>
      {/* 캐릭터 그림자가 데크 위에 지도록 데크만 실시간 그림자를 받는다 */}
      <StaticShadow receive>
        <Deck />
      </StaticShadow>
      <FishingGear />
    </group>
  );
}

/** 낚시하기: 문제를 맞히면 데크 앞쪽에 서서 찌를 던진다 */
function startFishing(): void {
  askMath('FISH', '찌를 달아 낚싯대를 던져 볼까요?', (math) => {
    const store = useGameStore.getState();
    if (!store.spendFishingCast()) return;
    awardExperience('FISH', math);
    // 정답 만세(한 바퀴 돌기) 대신 바로 낚시 자세로
    player.emote = null;
    const x = Math.min(DECK.maxX - 0.5, Math.max(DECK.minX + 0.5, player.position.x));
    const z = DECK.maxZ - STAND_BACK;
    player.position.set(x, player.position.y, z);
    player.facing = FISHING_FACING;
    const { center, half } = POND;
    const target = {
      x: Math.min(center.x + half.x - 0.5, Math.max(center.x - half.x + 0.5, x + Math.sin(CAST_ANGLE) * CAST_DISTANCE)),
      z: Math.min(center.z + half.z - 0.3, z + Math.cos(CAST_ANGLE) * CAST_DISTANCE),
    };
    useFishing.getState().start(target);
  });
}

/* --------------------------------- 연못 --------------------------------- */

function Pond(): React.ReactElement {
  const { center, half, corner } = POND;
  const shore = useMemo(() => roundedRect(half.x + 0.38, half.z + 0.38, corner + 0.38), [half.x, half.z, corner]);
  const water = useMemo(() => waterGeometry(), []);
  useEffect(
    () => () => {
      shore.dispose();
      water.dispose();
    },
    [shore, water],
  );
  return (
    <group position={[center.x, 0, center.z]}>
      {/* 물가 모래. 길(0.012)보다 낮게 */}
      <mesh geometry={shore} position-y={0.008}>
        <meshLambertMaterial ref={(m) => void (m && applyGroundShadow(m))} color={COLORS.shore} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
      {/* 물: 분수대 물과 같은 물결 무늬 그림. 가장자리는 밝고 가운데로 갈수록 깊은 색 (꼭짓점 색). 살짝 반짝이게 */}
      <mesh geometry={water} position-y={WATER_Y}>
        <ArtTexture assetKey={ASSETS.textures.water} repeat={[1 / WATER_TILE, 1 / WATER_TILE]}>
          {(map) => (
            <meshStandardMaterial
              ref={(m) => void (m && applyGroundShadow(m))}
              map={map}
              color={map ? '#ffffff' : COLORS.water}
              vertexColors
              roughness={0.18}
              metalness={0.05}
            />
          )}
        </ArtTexture>
      </mesh>
    </group>
  );
}

/** 물 무늬 한 장이 덮는 크기 (m) */
const WATER_TILE = 2.2;
/** 깊은 가운데가 가장자리에서 들어가는 거리 (m) */
const DEEP_INSET = 0.75;

/**
 * 물 모양: 바깥 둘레 → 안쪽 둘레 고리 + 안쪽 판. 바깥 둘레는 흰색(무늬 그대로), 안쪽은 깊은 색을 곱해
 * 가장자리는 얕고 밝게, 가운데는 깊게 부드럽게 이어진다. 무늬 좌표는 m 단위 (WATER_TILE 로 반복).
 */
function waterGeometry(): BufferGeometry {
  const { half, corner } = POND;
  const outlineOf = (hx: number, hz: number, r: number): Vector3[] => {
    const rr = Math.min(r, hx, hz);
    const path = new Shape();
    path.moveTo(-hx + rr, -hz);
    path.lineTo(hx - rr, -hz);
    path.quadraticCurveTo(hx, -hz, hx, -hz + rr);
    path.lineTo(hx, hz - rr);
    path.quadraticCurveTo(hx, hz, hx - rr, hz);
    path.lineTo(-hx + rr, hz);
    path.quadraticCurveTo(-hx, hz, -hx, hz - rr);
    path.lineTo(-hx, -hz + rr);
    path.quadraticCurveTo(-hx, -hz, -hx + rr, -hz);
    // 둘레를 같은 수로 나눈 점들. 바닥(xz)에 놓는다 (모양의 y → z)
    return path.getSpacedPoints(96).slice(0, 96).map((p) => new Vector3(p.x, 0, p.y));
  };
  const outer = outlineOf(half.x, half.z, corner);
  const inner = outlineOf(half.x - DEEP_INSET, half.z - DEEP_INSET * 0.7, corner - DEEP_INSET * 0.6);
  const deep = new Color(COLORS.deepTint);
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const put = (p: Vector3, c: Color) => {
    positions.push(p.x, 0, p.z);
    colors.push(c.r, c.g, c.b);
    uvs.push(p.x, -p.z);
  };
  const white = new Color(1, 1, 1);
  for (const p of outer) put(p, white);
  for (const p of inner) put(p, deep);
  const n = outer.length;
  const index: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = i;
    const b = (i + 1) % n;
    // 위에서 봤을 때 반시계로 감아 윗면이 하늘을 보게
    index.push(a, n + a, b, b, n + a, n + b);
  }
  // 안쪽 판: 안쪽 둘레의 가운데로 부채꼴
  const centerIndex = positions.length / 3;
  put(new Vector3(0, 0, 0), deep);
  for (let i = 0; i < n; i += 1) index.push(centerIndex, n + ((i + 1) % n), n + i);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  // 감는 방향이 뒤집혔으면 법선이 아래를 본다 — 그때는 삼각형을 뒤집는다
  const normal = geometry.getAttribute('normal');
  if (normal.getY(0) < 0) {
    for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
    geometry.setIndex(index);
    geometry.computeVertexNormals();
  }
  return geometry;
}

/** 물가 둘레의 둥근 돌. 데크가 놓인 자리는 비운다 */
function Stones(): React.ReactElement {
  const mesh = useRef<InstancedMesh>(null);
  const stones = useMemo(() => {
    const random = seeded(11);
    const { center, half, corner } = POND;
    const list: { x: number; z: number; sx: number; sy: number; sz: number; turn: number; color: string }[] = [];
    // 둥근 네모 둘레를 따라 걷는다
    const hx = half.x + 0.3;
    const hz = half.z + 0.3;
    const r = corner + 0.3;
    const straightX = (hx - r) * 2;
    const straightZ = (hz - r) * 2;
    const arc = (Math.PI / 2) * r;
    const perimeter = 2 * straightX + 2 * straightZ + 4 * arc;
    const count = 30;
    const at = (d: number): { x: number; z: number } => {
      // 북쪽 변(왼→오) → 동북 모서리 → 동쪽 변 → ... 시계 방향
      const segments: [number, (t: number) => { x: number; z: number }][] = [
        [straightX, (t) => ({ x: -hx + r + t, z: -hz })],
        [arc, (t) => { const a = -Math.PI / 2 + t / r; return { x: hx - r + Math.cos(a) * r, z: -hz + r + Math.sin(a) * r }; }],
        [straightZ, (t) => ({ x: hx, z: -hz + r + t })],
        [arc, (t) => { const a = t / r; return { x: hx - r + Math.cos(a) * r, z: hz - r + Math.sin(a) * r }; }],
        [straightX, (t) => ({ x: hx - r - t, z: hz })],
        [arc, (t) => { const a = Math.PI / 2 + t / r; return { x: -hx + r + Math.cos(a) * r, z: hz - r + Math.sin(a) * r }; }],
        [straightZ, (t) => ({ x: -hx, z: hz - r - t })],
        [arc, (t) => { const a = Math.PI + t / r; return { x: -hx + r + Math.cos(a) * r, z: -hz + r + Math.sin(a) * r }; }],
      ];
      let left = d;
      for (const [length, point] of segments) {
        if (left <= length) return point(left);
        left -= length;
      }
      return segments[0][1](0);
    };
    for (let i = 0; i < count; i += 1) {
      const p = at(((i + random() * 0.5) / count) * perimeter);
      const x = center.x + p.x;
      const z = center.z + p.z;
      // 데크 자리 (북쪽 가운데)
      if (x > DECK.minX - 0.25 && x < DECK.maxX + 0.25 && z < center.z) continue;
      const size = 0.16 + random() * 0.16;
      list.push({
        x,
        z,
        sx: size * (1 + random() * 0.4),
        sy: size * (0.55 + random() * 0.25),
        sz: size * (0.9 + random() * 0.3),
        turn: random() * Math.PI,
        color: COLORS.stones[Math.floor(random() * COLORS.stones.length)],
      });
    }
    return list;
  }, []);

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const matrix = new Matrix4();
    const color = new Color();
    stones.forEach((s, i) => {
      matrix.compose(
        new Vector3(s.x, s.sy * 0.35, s.z),
        new Quaternion().setFromEuler(new Euler(0, s.turn, 0)),
        new Vector3(s.sx, s.sy, s.sz),
      );
      m.setMatrixAt(i, matrix);
      m.setColorAt(i, color.set(s.color));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [stones]);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, stones.length]} castShadow>
      <dodecahedronGeometry args={[1, 1]} />
      <meshStandardMaterial roughness={0.9} flatShading />
    </instancedMesh>
  );
}

/** 물가 갈대 덤불 (연못 양 끝). 잎은 가는 원뿔, 몇 개는 부들 이삭을 단다 */
const REED_CLUMPS: { x: number; z: number; count: number }[] = [
  { x: POND.center.x - POND.half.x - 0.05, z: POND.center.z - 0.1, count: 11 },
  { x: POND.center.x + POND.half.x + 0.05, z: POND.center.z + 0.35, count: 10 },
  { x: POND.center.x - POND.half.x + 1.0, z: POND.center.z + POND.half.z + 0.1, count: 7 },
];

function Reeds(): React.ReactElement {
  const blades = useRef<InstancedMesh>(null);
  const heads = useRef<InstancedMesh>(null);
  const { bladeList, headList } = useMemo(() => {
    const random = seeded(23);
    const bladeList: { x: number; z: number; h: number; tiltX: number; tiltZ: number; color: string }[] = [];
    const headList: { x: number; y: number; z: number }[] = [];
    for (const clump of REED_CLUMPS) {
      for (let i = 0; i < clump.count; i += 1) {
        const a = random() * Math.PI * 2;
        const d = Math.sqrt(random()) * 0.38;
        const x = clump.x + Math.cos(a) * d;
        const z = clump.z + Math.sin(a) * d * 0.8;
        const h = 0.55 + random() * 0.5;
        const tiltX = (random() - 0.5) * 0.35;
        const tiltZ = (random() - 0.5) * 0.35;
        bladeList.push({ x, z, h, tiltX, tiltZ, color: COLORS.reed[Math.floor(random() * COLORS.reed.length)] });
        if (random() < 0.3) headList.push({ x: x - tiltZ * h * 0.9, y: h * 0.92, z: z + tiltX * h * 0.9 });
      }
    }
    return { bladeList, headList };
  }, []);

  useEffect(() => {
    const matrix = new Matrix4();
    const color = new Color();
    const b = blades.current;
    if (b) {
      bladeList.forEach((blade, i) => {
        matrix.compose(
          new Vector3(blade.x, blade.h / 2, blade.z),
          new Quaternion().setFromEuler(new Euler(blade.tiltX, 0, blade.tiltZ)),
          new Vector3(1, blade.h, 1),
        );
        b.setMatrixAt(i, matrix);
        b.setColorAt(i, color.set(blade.color));
      });
      b.instanceMatrix.needsUpdate = true;
      if (b.instanceColor) b.instanceColor.needsUpdate = true;
      b.computeBoundingSphere();
    }
    const h = heads.current;
    if (h) {
      headList.forEach((head, i) => {
        matrix.makeTranslation(head.x, head.y, head.z);
        h.setMatrixAt(i, matrix);
      });
      h.instanceMatrix.needsUpdate = true;
      h.computeBoundingSphere();
    }
  }, [bladeList, headList]);

  return (
    <group>
      <instancedMesh ref={blades} args={[undefined, undefined, bladeList.length]} castShadow>
        <coneGeometry args={[0.035, 1, 5]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, headList.length]} castShadow>
        <capsuleGeometry args={[0.035, 0.12, 4, 8]} />
        <meshStandardMaterial color={COLORS.cattail} roughness={0.9} />
      </instancedMesh>
    </group>
  );
}

/** 연잎 몇 장. 찌가 떨어지는 앞쪽 가운데는 비운다 */
const LILY_PADS: { x: number; z: number; r: number; turn: number; flower?: boolean }[] = [
  { x: POND.center.x - 2.4, z: POND.center.z + 0.5, r: 0.26, turn: 0.4, flower: true },
  { x: POND.center.x - 1.9, z: POND.center.z - 0.35, r: 0.2, turn: 2.1 },
  { x: POND.center.x + 2.5, z: POND.center.z - 0.45, r: 0.24, turn: 4.0 },
  { x: POND.center.x + 2.0, z: POND.center.z + 0.65, r: 0.18, turn: 5.2, flower: true },
];

/** 잎 · 꽃을 각각 모양 하나로 합쳐 그린다 (잎마다 따로 그리면 그리기 횟수만 는다) */
function LilyPads(): React.ReactElement {
  const { leaves, flowers } = useMemo(() => {
    const leafParts: BufferGeometry[] = [];
    const flowerParts: BufferGeometry[] = [];
    for (const pad of LILY_PADS) {
      // 한쪽이 갈라진 둥근 잎
      const leaf = new CircleGeometry(pad.r, 20, 0.35, Math.PI * 2 - 0.35);
      leaf.rotateX(-Math.PI / 2);
      leaf.rotateY(pad.turn);
      leaf.translate(pad.x, WATER_Y + 0.012, pad.z);
      leafParts.push(leaf);
      if (pad.flower) {
        const flower = new ConeGeometry(0.08, 0.1, 6);
        flower.translate(pad.r * 0.25, 0.05, 0);
        flower.rotateY(pad.turn);
        flower.translate(pad.x, WATER_Y + 0.012, pad.z);
        flowerParts.push(flower);
      }
    }
    const merged = { leaves: mergeGeometries(leafParts), flowers: mergeGeometries(flowerParts) };
    for (const part of [...leafParts, ...flowerParts]) part.dispose();
    return merged;
  }, []);
  useEffect(
    () => () => {
      leaves.dispose();
      flowers.dispose();
    },
    [leaves, flowers],
  );
  return (
    <group>
      <mesh geometry={leaves}>
        <meshStandardMaterial color={COLORS.lily} roughness={0.7} side={DoubleSide} />
      </mesh>
      <mesh geometry={flowers} castShadow>
        <meshStandardMaterial color={COLORS.flower} roughness={0.7} />
      </mesh>
    </group>
  );
}

/* --------------------------------- 데크 --------------------------------- */

/** 데크 널빤지 수 · 널빤지 사이 틈 (m) */
const DECK_BOARDS = 8;
const BOARD_GAP = 0.022;
/** 나뭇결 그림(실내 바닥 그림을 같이 쓴다) 한 장이 결 방향으로 덮는 길이 (m) */
const GRAIN_TILE = 1.6;
/** 나뭇결 그림이 어둡게 만드는 만큼 되밝히는 배율 (그림 평균 밝기 ≈ 0.8, 선형) */
const DECK_TEXTURE_LIFT = new Color(1.22, 1.22, 1.22);

type Axis = 'x' | 'y' | 'z';

/**
 * 나무 조각 하나를 마무리한다: 꼭짓점 색(윗면은 밝게, 옆면 · 아랫면은 어둡게 — 두께가 보이게)과
 * 나뭇결 좌표(결이 grain 축을 따라 흐르고, 널빤지 한 장 = 그림의 널빤지 한 줄).
 * wetBelow 보다 낮은 곳은 물에 젖은 것처럼 어둡게 칠한다.
 */
function woodPart(geometry: BufferGeometry, hex: string, grain: Axis, wetBelow?: number): BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  if (g !== geometry) geometry.dispose();
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const base = new Color(hex);
  const colors = new Float32Array(pos.count * 3);
  const uvs = new Float32Array(pos.count * 2);
  const rowHeight = (DECK.maxZ - DECK.minZ) / DECK_BOARDS;
  for (let i = 0; i < pos.count; i += 1) {
    const c = { x: pos.getX(i), y: pos.getY(i), z: pos.getZ(i) };
    const n = { x: Math.abs(nor.getX(i)), y: Math.abs(nor.getY(i)), z: Math.abs(nor.getZ(i)) };
    const normalAxis: Axis = n.y >= n.x && n.y >= n.z ? 'y' : n.x >= n.z ? 'x' : 'z';
    let shade = normalAxis === 'y' ? (nor.getY(i) > 0 ? 1 : 0.55) : 0.78;
    if (wetBelow !== undefined && c.y < wetBelow) shade *= 0.6;
    colors[i * 3] = base.r * shade;
    colors[i * 3 + 1] = base.g * shade;
    colors[i * 3 + 2] = base.b * shade;
    const face = (['x', 'y', 'z'] as Axis[]).filter((a) => a !== normalAxis);
    const u = face.includes(grain) ? grain : face[0];
    const v = face.find((a) => a !== u) as Axis;
    uvs[i * 2] = c[u] / GRAIN_TILE;
    // 그림의 널빤지 한 줄(그림 높이의 1/8)이 데크 널빤지 한 장에 맞게
    uvs[i * 2 + 1] = (c[v] - (v === 'z' ? DECK.minZ : 0)) / (rowHeight * 8);
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  return g;
}

function box(x: number, y: number, z: number, w: number, h: number, d: number): BufferGeometry {
  return new BoxGeometry(w, h, d).translate(x, y, z);
}

/**
 * 나무 데크: 색이 조금씩 다른 가로 널빤지(틈 · 못 자국), 앞쪽 테두리 판, 물에 박힌 둥근 기둥(밧줄 감김),
 * 양옆 난간(기둥 머리 덮개), 테를 두른 양동이. 모두 한 덩어리로 합쳐 그리기 호출은 1번이다.
 */
function Deck(): React.ReactElement {
  const geometry = useMemo(() => {
    const top = POND.deckHeight;
    const width = DECK.maxX - DECK.minX;
    const cx = (DECK.minX + DECK.maxX) / 2;
    const pitch = (DECK.maxZ - DECK.minZ) / DECK_BOARDS;
    const rand = seeded(91);
    const parts: BufferGeometry[] = [];

    // 널빤지: 색 · 길이 · 높이를 조금씩 달리해 손으로 만든 느낌
    const plankColors = ['#e6b67c', '#dca96f', '#edc28b', '#d6a26a', '#e2b176'];
    for (let i = 0; i < DECK_BOARDS; i += 1) {
      const z = DECK.minZ + pitch * (i + 0.5);
      const jag = rand() * 0.08;
      const shift = (rand() - 0.5) * 0.06;
      const lift = (rand() - 0.5) * 0.008;
      parts.push(woodPart(box(cx + shift, top - 0.035 + lift, z, width - jag, 0.07, pitch - BOARD_GAP), plankColors[i % plankColors.length], 'x'));
      // 못 자국: 받침이 지나가는 양끝에 둘씩
      for (const x of [DECK.minX + 0.12, DECK.maxX - 0.12]) {
        for (const dz of [-pitch * 0.22, pitch * 0.22]) {
          parts.push(woodPart(box(x, top + 0.001 + lift, z + dz, 0.03, 0.01, 0.03), '#5b4331', 'x'));
        }
      }
    }

    const frame = '#a0714a';
    // 널빤지 아래 받침 (양옆) · 앞쪽 테두리 판
    for (const x of [DECK.minX + 0.12, DECK.maxX - 0.12]) {
      parts.push(woodPart(box(x, (top - 0.07) / 2, (DECK.minZ + DECK.maxZ) / 2, 0.14, top - 0.07, DECK.maxZ - DECK.minZ), frame, 'z'));
    }
    parts.push(woodPart(box(cx, top - 0.06, DECK.maxZ + 0.005, width + 0.04, 0.11, 0.05), '#b9865a', 'x'));

    // 물에 박힌 둥근 기둥: 앞 두 모서리는 데크 위로 조금 솟고 밧줄을 감는다, 가운데는 데크 밑까지
    const wet = WATER_Y + 0.05;
    for (const [x, tall] of [
      [DECK.minX + 0.08, true],
      [cx, false],
      [DECK.maxX - 0.08, true],
    ] as const) {
      const h = tall ? top + 0.2 : top;
      parts.push(woodPart(new CylinderGeometry(0.075, 0.085, h + 0.12, 10).translate(x, (h - 0.12) / 2, DECK.maxZ + 0.02), '#916443', 'y', wet));
      if (tall) {
        parts.push(woodPart(new TorusGeometry(0.085, 0.018, 5, 12).rotateX(Math.PI / 2).translate(x, top + 0.09, DECK.maxZ + 0.02), '#e2cb94', 'x'));
        parts.push(woodPart(new TorusGeometry(0.085, 0.018, 5, 12).rotateX(Math.PI / 2).translate(x, top + 0.13, DECK.maxZ + 0.02), '#d8bf86', 'x'));
      }
    }

    // 양옆 난간: 기둥 셋(머리 덮개) + 가로대 둘. 앞쪽은 낚시하게 터 둔다
    const railFrom = DECK.minZ + 0.5;
    const railTo = DECK.maxZ - 0.2;
    for (const x of [DECK.minX + 0.08, DECK.maxX - 0.08]) {
      for (const z of [railFrom, (railFrom + railTo) / 2, railTo]) {
        parts.push(woodPart(box(x, top + 0.32, z, 0.1, 0.64, 0.1), frame, 'y'));
        parts.push(woodPart(box(x, top + 0.655, z, 0.13, 0.03, 0.13), '#b9865a', 'x'));
      }
      parts.push(woodPart(box(x, top + 0.6, (railFrom + railTo) / 2, 0.08, 0.07, railTo - railFrom + 0.1), '#b9865a', 'z'));
      parts.push(woodPart(box(x, top + 0.32, (railFrom + railTo) / 2, 0.06, 0.05, railTo - railFrom), frame, 'z'));
    }

    // 물고기 담는 나무 양동이 (데크 뒤쪽 구석): 몸통 + 쇠테 둘 + 손잡이
    const bx = DECK.minX + 0.38;
    const bz = DECK.minZ + 0.55;
    parts.push(woodPart(new CylinderGeometry(0.16, 0.13, 0.28, 14).translate(bx, top + 0.14, bz), '#a8764a', 'y'));
    for (const [y, r] of [
      [top + 0.06, 0.142],
      [top + 0.22, 0.158],
    ] as const) {
      parts.push(woodPart(new CylinderGeometry(r + 0.008, r + 0.008, 0.03, 14).translate(bx, y, bz), '#6c6a66', 'x'));
    }
    parts.push(woodPart(new TorusGeometry(0.15, 0.01, 4, 12, Math.PI).translate(bx, top + 0.28, bz), '#6c6a66', 'x'));

    const merged = mergeGeometries(parts, false);
    for (const part of parts) part.dispose();
    return merged;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <ArtTexture assetKey={ASSETS.textures.floor} repeat={[1, 1]}>
        {/* 바닥 그림은 살짝 회색이라 곱하면 어두워진다 — 그만큼 밝혀 원래 나무색을 지킨다 */}
        {(map) => <meshStandardMaterial map={map} color={map ? DECK_TEXTURE_LIFT : '#ffffff'} vertexColors roughness={0.85} />}
      </ArtTexture>
    </mesh>
  );
}

/* ------------------------------ 낚싯대 · 찌 ------------------------------ */

/**
 * 낚싯대는 캐릭터 오른손(player.hand — Player 가 오른팔 뼈에서 잰다)에 쥔다.
 * 뼈대가 없는 임시 캐릭터일 때만 이 자리(캐릭터 기준 오른쪽 앞, 오른쪽이 −x)를 쓴다
 */
const FALLBACK_GRIP = new Vector3(-0.2, 0.6, 0.25);
const ROD_LENGTH = 1.45;
/** 낚싯대 기울기: 세운 것(0)에서 앞으로 숙인 각도 */
const ROD_REST = 0.8;
const ROD_BACK = -0.55;

function FishingGear(): React.ReactElement {
  // 쓰는 낚싯대에 따라 색이 다르다 (config/rods)
  const look = rodLook(useGameStore((s) => s.equippedRod));
  const rig = useRef<Group>(null);
  const rod = useRef<Group>(null);
  const bobber = useRef<Group>(null);
  const ripples = useRef<(Mesh | null)[]>([]);
  const lastPhase = useRef(useFishing.getState().phase);
  const rippleAt = useRef<number[]>([-10, -10, -10]);
  const rippleSlot = useRef(0);

  const line = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(3 * 8), 3));
    return new Line(geometry, new LineBasicMaterial({ color: '#f4f1ea', transparent: true, opacity: 0.85 }));
  }, []);
  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as LineBasicMaterial).dispose();
    },
    [line],
  );

  useFrame(() => {
    const { phase, phaseAt, target } = useFishing.getState();
    const now = performance.now();
    const age = (now - phaseAt) / 1000;
    const t = now / 1000;

    // 단계가 바뀔 때 한 번 하는 연출
    if (phase !== lastPhase.current) {
      const before = lastPhase.current;
      lastPhase.current = phase;
      if (phase === 'waiting') startRipple(now);
      if (phase === 'reeling') spawnParticles('water', { x: target.x, y: WATER_Y + 0.05, z: target.z }, 10);
      if (phase === 'caught') {
        playEmote('happy');
        burstStars({ x: player.position.x, y: 1.6, z: player.position.z }, 12);
      }
      if (before === 'bite' && phase === 'escaped') startRipple(now);
    }

    const active = phase === 'casting' || phase === 'waiting' || phase === 'bite' || phase === 'reeling';
    player.pose = active ? 'fishing' : null;
    if (!rig.current || !rod.current || !bobber.current) return;
    rig.current.visible = active || phase === 'escaped';
    line.visible = active;
    if (!rig.current.visible) {
      bobber.current.visible = false;
      return;
    }

    // 오른손에서 나와 손을 따라 움직인다. 방향은 캐릭터가 보는 쪽
    if (player.handReady) {
      rig.current.position.copy(player.hand);
      rod.current.position.set(0, 0, 0);
    } else {
      rig.current.position.set(player.position.x, groundHeight(player.position.x, player.position.z), player.position.z);
      rod.current.position.copy(FALLBACK_GRIP);
    }
    rig.current.rotation.y = player.facing;

    // 낚싯대 기울기
    let pitch = ROD_REST;
    if (phase === 'casting') {
      // 뒤로 젖혔다가 (0~0.3초) 앞으로 휘두른다
      const k = age / FISHING.castSeconds;
      pitch = k < 0.35 ? ROD_REST + (ROD_BACK - ROD_REST) * Math.sin((k / 0.35) * Math.PI * 0.5) : ROD_BACK + (ROD_REST + 0.2 - ROD_BACK) * Math.min(1, (k - 0.35) / 0.3);
    } else if (phase === 'bite') {
      pitch = ROD_REST + 0.12 + Math.sin(t * 22) * 0.06;
    } else if (phase === 'reeling') {
      pitch = ROD_REST - Math.min(1, age / 0.35) * 0.8;
    } else if (phase === 'escaped') {
      pitch = ROD_REST - 0.4;
    }
    // 먼저 바깥쪽으로 돌리고(y) 그 방향으로 숙인다(x)
    rod.current.rotation.set(pitch, ROD_YAW, 0, 'YXZ');
    rig.current.updateMatrixWorld();

    // 낚싯대 끝 (월드 좌표)
    const tip = new Vector3(0, ROD_LENGTH, 0).applyEuler(rod.current.rotation).add(rod.current.position);
    rig.current.localToWorld(tip);

    // 찌 자리
    const water = new Vector3(target.x, WATER_Y + 0.02, target.z);
    const b = bobber.current;
    b.visible = phase !== 'escaped';
    if (phase === 'casting') {
      const k = Math.min(1, Math.max(0, (age / FISHING.castSeconds - 0.45) / 0.55));
      b.position.lerpVectors(tip, water, k);
      b.position.y += Math.sin(k * Math.PI) * 0.7;
      if (k <= 0) b.position.copy(tip);
    } else if (phase === 'waiting') {
      b.position.copy(water);
      b.position.y += Math.sin(t * 2.2) * 0.012;
    } else if (phase === 'bite') {
      // 쿡쿡 잠긴다
      b.position.copy(water);
      b.position.y -= Math.abs(Math.sin(t * 13)) * 0.07;
      if (now - rippleAt.current[(rippleSlot.current + 2) % 3] > 450) startRipple(now);
    } else if (phase === 'reeling') {
      const k = Math.min(1, age / (FISHING.reelSeconds * 0.8));
      b.position.lerpVectors(water, tip, k);
      b.position.y += Math.sin(k * Math.PI) * 0.4;
    }

    // 낚싯줄: 끝에서 찌까지 살짝 처지게
    const positions = line.geometry.getAttribute('position') as Float32BufferAttribute;
    const sag = phase === 'waiting' ? 0.12 : 0.03;
    for (let i = 0; i < 8; i += 1) {
      const k = i / 7;
      positions.setXYZ(
        i,
        tip.x + (b.position.x - tip.x) * k,
        tip.y + (b.position.y + 0.06 - tip.y) * k - Math.sin(k * Math.PI) * sag,
        tip.z + (b.position.z - tip.z) * k,
      );
    }
    positions.needsUpdate = true;
    line.geometry.computeBoundingSphere();

    // 물결 고리: 퍼지면서 옅어진다
    ripples.current.forEach((ring, i) => {
      if (!ring) return;
      const k = (now - rippleAt.current[i]) / 900;
      ring.visible = k >= 0 && k < 1;
      if (!ring.visible) return;
      ring.position.set(water.x, WATER_Y + 0.006, water.z);
      ring.scale.setScalar(0.12 + k * 0.45);
      (ring.material as MeshBasicMaterial).opacity = (1 - k) * 0.7;
    });
  });

  function startRipple(now: number): void {
    rippleAt.current[rippleSlot.current] = now;
    rippleSlot.current = (rippleSlot.current + 1) % 3;
  }

  return (
    <group>
      <group ref={rig} visible={false}>
        {/* 낚싯대: 쥔 자리에서 위(+y)로 뻗은 것을 앞으로 숙인다 */}
        <group ref={rod}>
          <mesh position-y={ROD_LENGTH / 2} castShadow>
            <cylinderGeometry args={[0.012, 0.024, ROD_LENGTH, 6]} />
            <meshStandardMaterial color={look.pole} roughness={0.7} />
          </mesh>
          {look.tip && (
            <mesh position-y={ROD_LENGTH}>
              <sphereGeometry args={[0.035, 8, 6]} />
              <meshStandardMaterial color={look.tip} emissive={look.tip} emissiveIntensity={0.35} roughness={0.4} />
            </mesh>
          )}
          {/* 손잡이 (손이 가운데를 쥔다) · 릴 */}
          <mesh position-y={0.01}>
            <cylinderGeometry args={[0.032, 0.032, 0.22, 8]} />
            <meshStandardMaterial color={look.grip} roughness={0.6} />
          </mesh>
          <mesh position={[0.05, 0.17, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.045, 0.045, 0.04, 12]} />
            <meshStandardMaterial color={look.reel} roughness={0.5} />
          </mesh>
        </group>
      </group>
      <primitive object={line} />
      {/* 찌: 위는 빨강, 아래는 흰색 */}
      <group ref={bobber} visible={false}>
        <mesh position-y={0.03}>
          <sphereGeometry args={[0.075, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#e8524a" roughness={0.5} />
        </mesh>
        <mesh position-y={0.03} rotation-x={Math.PI}>
          <sphereGeometry args={[0.075, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#fbf7ef" roughness={0.5} />
        </mesh>
        <mesh position-y={0.13}>
          <cylinderGeometry args={[0.01, 0.01, 0.1, 5]} />
          <meshStandardMaterial color="#e8524a" roughness={0.5} />
        </mesh>
      </group>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            ripples.current[i] = m;
          }}
          rotation-x={-Math.PI / 2}
          visible={false}
        >
          <ringGeometry args={[0.85, 1, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
