/**
 * 동물 우리: 울타리(앞쪽에 문), 헛간, 여물통, 그리고 돌아다니는 동물들.
 * 동물을 돌보는 규칙은 2D 판 YardScene 과 같다 — 먹이 주기·생산물 받기마다 문제를 하나 푼다. (명세 78)
 *
 * 동물 모델에는 뼈대가 없어서 몸 전체를 장난감처럼 움직인다.
 *  - 걷기: 통통 튀며 좌우로 뒤뚱
 *  - 서 있기: 숨쉬기 + 가끔 고개(몸) 돌리기, 닭은 가끔 쪼기 (가만히 있어도 움직인다 — ART_DIRECTION 5)
 *  - 먹기: 앞으로 숙였다 들었다
 *  - 기쁨: 폴짝
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { PALETTE } from '@/config/artTokens';
import { ANIMAL_SPECIES } from '@/config/catalog';
import { YARD } from '@/config/layout';
import { MODELS } from '@/config/models';
import { SHOW_AREA_SIGNS } from '@/config/features';
import { AREA_NAME } from '@/config/strings';
import type { InteractionPrompt } from '@/bridge/events';
import { useGameStore } from '@/state/gameStore';
import type { AnimalInstance, AnimalSpeciesId } from '@/types/game';
import { audio } from '@/audio/sfx';
import { GltfModel } from '../../assets3d';
import { burstStars, floatText, Marker } from '../../core/effects';
import { askMath, awardExperience, toast } from '../../core/gameplay';
import { useInteractable } from '../../core/interaction';
import { obstacles, type Obstacle } from '../../core/runtime';
import { mergedBoxGeometry, type BoxSpec } from '../../props/mergedBoxes';
import { SignBoard } from '../../props/SignBoard';
import { StaticShadow } from '../../core/bakedShadows';

/* ---------------------------------- 배치 ---------------------------------- */

const pen = YARD.pen;
const PEN_MIN_X = pen.center.x - pen.width / 2;
const PEN_MAX_X = pen.center.x + pen.width / 2;
const PEN_MIN_Z = pen.center.z - pen.depth / 2;
const PEN_MAX_Z = pen.center.z + pen.depth / 2;
/** 앞쪽(카메라 쪽) 울타리 가운데의 문 너비 */
const GATE_WIDTH = 1.8;
/** 울타리 두께 (부딪힘) */
const FENCE_THICKNESS = 0.2;
/** 동물이 울타리에 붙지 않게 안쪽으로 띄우는 거리 */
const INNER_MARGIN = 0.8;
/** 여물통 자리 (우리 안 왼쪽 벽 앞, 세로로) */
const TROUGH = { x: PEN_MIN_X + 0.9, z: pen.center.z, length: 1.6 };
/** 헛간은 우리 뒤 울타리 바깥 */
const BARN = { x: pen.center.x + 1.5, z: PEN_MIN_Z - 2.3 };

/** 동물마다 크기 (부딪히는 반지름, 느낌표 높이, 걷는 빠르기) */
const ANIMAL_BODY: Record<AnimalSpeciesId, { radius: number; marker: number; speed: number; color: string }> = {
  chicken: { radius: 0.3, marker: 1.1, speed: 0.9, color: PALETTE.chicken },
  goat: { radius: 0.45, marker: 1.6, speed: 0.7, color: PALETTE.woodLight },
  sheep: { radius: 0.5, marker: 1.55, speed: 0.6, color: PALETTE.sheep },
  cow: { radius: 0.65, marker: 2.0, speed: 0.55, color: PALETTE.cow },
};

/* ------------------------------- 움직임 상태 ------------------------------- */

interface AnimalMotion {
  x: number;
  z: number;
  facing: number;
  target: { x: number; z: number } | null;
  /** 다음 걸음을 시작할 시각 (초) */
  restUntil: number;
  /** 몸짓 */
  emote: { kind: 'eat' | 'happy'; startedAt: number } | null;
  walkPhase: number;
  moving: boolean;
}

/** 동물 위치. 상호작용 거리 · 느낌표 · 서로 피하기에 쓴다 */
const motions = new Map<string, AnimalMotion>();

function randomSpot(): { x: number; z: number } {
  return {
    x: PEN_MIN_X + INNER_MARGIN + 0.8 + Math.random() * (pen.width - INNER_MARGIN * 2 - 0.8),
    z: PEN_MIN_Z + INNER_MARGIN + Math.random() * (pen.depth - INNER_MARGIN * 2),
  };
}

/** 처음 자리는 저장된 spot(0~1)으로 정한다. 다시 들어와도 비슷한 곳에 있다 */
function startSpot(animal: AnimalInstance, index: number): { x: number; z: number } {
  const t = (animal.spot + index * 0.37) % 1;
  return {
    x: PEN_MIN_X + INNER_MARGIN + 0.8 + t * (pen.width - INNER_MARGIN * 2 - 0.8),
    z: PEN_MIN_Z + INNER_MARGIN + ((index * 0.53 + 0.2) % 1) * (pen.depth - INNER_MARGIN * 2),
  };
}

/* ------------------------------- 행동 규칙 ------------------------------- */

function animalById(animalId: string): AnimalInstance | undefined {
  return useGameStore.getState().animals.find((a) => a.id === animalId);
}

function animalPrompts(animalId: string): InteractionPrompt[] {
  const animal = animalById(animalId);
  if (!animal) return [];
  const def = ANIMAL_SPECIES[animal.species];
  if (animal.produceReady) {
    return [
      {
        id: 'collect',
        label: `${def.produceName} 받기`,
        enabled: true,
        highlight: true,
        // 생산물 이름에 동물 이름을 또 붙이면 "양 양털 받기" 처럼 겹친다. 부제로 둔다.
        hint: def.name,
      },
    ];
  }
  const feed = useGameStore.getState().itemCount('feed');
  return [
    {
      id: 'feed',
      label: `${def.name} 먹이 주기`,
      enabled: feed > 0,
      hint: feed > 0 ? `돌봄 ${animal.care} / ${def.careGoal} · 먹이 ${feed}개` : '먹이가 없어요. 농장 가게에서 사 오세요',
    },
  ];
}

function emote(animalId: string, kind: 'eat' | 'happy'): void {
  const motion = motions.get(animalId);
  if (motion) motion.emote = { kind, startedAt: performance.now() };
}

function above(animalId: string, height: number): { x: number; y: number; z: number } {
  const motion = motions.get(animalId);
  return { x: motion?.x ?? pen.center.x, y: height, z: motion?.z ?? pen.center.z };
}

function handleAnimalAction(animalId: string, actionId: string): void {
  const animal = animalById(animalId);
  if (!animal) return;
  const def = ANIMAL_SPECIES[animal.species];
  const body = ANIMAL_BODY[animal.species];

  if (actionId === 'feed') {
    askMath('ANIMAL', `${def.name}에게 먹이를 줄까요?`, (math) => {
      if (!useGameStore.getState().feedAnimal(animalId)) return;
      audio.play('animal', animalById(animalId)?.species);
      emote(animalId, 'eat');
      burstStars(above(animalId, body.marker * 0.5), 6);
      floatText(above(animalId, body.marker), '냠냠', PALETTE.accentPink);
      if (animalById(animalId)?.produceReady) {
        toast(`${def.produceName}이(가) 준비됐어요!`, 'reward');
        burstStars(above(animalId, body.marker * 0.7), 9);
      }
      awardExperience('ANIMAL', math);
    });
    return;
  }

  if (actionId === 'collect') {
    askMath('ANIMAL', `${def.produceName}을(를) 받아 볼까요?`, (math) => {
      const result = useGameStore.getState().collectProduce(animalId, math.wrongAttempts);
      if (!result) return;
      // 다 틀려도 최소 1개는 받는다 (PRODUCE_BY_ATTEMPTS)
      audio.play('harvest');
      emote(animalId, 'happy');
      burstStars(above(animalId, body.marker * 0.7), 6 + result.count * 4);
      floatText(above(animalId, body.marker + 0.4), `${def.produceName} +${result.count}`, PALETTE.goldShade);
      toast(`${def.produceName} ${result.count}개를 얻었어요`, 'reward');
      awardExperience('ANIMAL', math);
    });
  }
}

/* -------------------------------- 우리 전체 -------------------------------- */

export function AnimalPen(): React.ReactElement {
  const animals = useGameStore((s) => s.animals);

  // 울타리는 네 변을 얇은 상자로 막고, 앞쪽 가운데만 문으로 비운다
  useEffect(() => {
    const t = FENCE_THICKNESS / 2;
    const gateMin = pen.center.x - GATE_WIDTH / 2;
    const gateMax = pen.center.x + GATE_WIDTH / 2;
    const walls: [string, Obstacle][] = [
      ['fence_back', { kind: 'box', minX: PEN_MIN_X, maxX: PEN_MAX_X, minZ: PEN_MIN_Z - t, maxZ: PEN_MIN_Z + t }],
      ['fence_left', { kind: 'box', minX: PEN_MIN_X - t, maxX: PEN_MIN_X + t, minZ: PEN_MIN_Z, maxZ: PEN_MAX_Z }],
      ['fence_right', { kind: 'box', minX: PEN_MAX_X - t, maxX: PEN_MAX_X + t, minZ: PEN_MIN_Z, maxZ: PEN_MAX_Z }],
      ['fence_front_l', { kind: 'box', minX: PEN_MIN_X, maxX: gateMin, minZ: PEN_MAX_Z - t, maxZ: PEN_MAX_Z + t }],
      ['fence_front_r', { kind: 'box', minX: gateMax, maxX: PEN_MAX_X, minZ: PEN_MAX_Z - t, maxZ: PEN_MAX_Z + t }],
      [
        'trough',
        {
          kind: 'box',
          minX: TROUGH.x - 0.35,
          maxX: TROUGH.x + 0.35,
          minZ: TROUGH.z - TROUGH.length / 2,
          maxZ: TROUGH.z + TROUGH.length / 2,
        },
      ],
      ['barn', { kind: 'circle', x: BARN.x, z: BARN.z, radius: 1.9 }],
    ];
    for (const [key, obstacle] of walls) obstacles.set(key, obstacle);
    return () => {
      for (const [key] of walls) obstacles.delete(key);
    };
  }, []);

  return (
    <group>
      {/* 울타리 · 헛간 · 여물통 · 표지판은 움직이지 않아 그림자를 미리 그려 둔다 (core/bakedShadows) */}
      <StaticShadow>
        <Fence />
        <group position={[BARN.x, 0, BARN.z]}>
          <GltfModel modelKey={MODELS.buildings.barn} fallback={<FallbackBarn />} />
        </group>
        <group position={[TROUGH.x, 0, TROUGH.z]} rotation-y={Math.PI / 2}>
          <GltfModel modelKey={MODELS.buildings.trough} fallback={<FallbackTrough />} />
        </group>
        {/* 표지판은 울타리와 겹치지 않게 앞쪽 왼쪽 모서리 바깥에 */}
        {SHOW_AREA_SIGNS.pen && (
          <group position={[PEN_MIN_X - 0.9, 0, PEN_MAX_Z + 0.9]} rotation-y={0.25}>
            <SignBoard text={AREA_NAME.pen} width={1.7} />
          </group>
        )}
      </StaticShadow>
      {animals.map((animal, index) => (
        <Animal key={animal.id} animal={animal} index={index} />
      ))}
    </group>
  );
}

/* ---------------------------------- 동물 ---------------------------------- */

function Animal({ animal, index }: { animal: AnimalInstance; index: number }): React.ReactElement {
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const size = ANIMAL_BODY[animal.species];
  const produceReady = useGameStore((s) => s.animals.find((a) => a.id === animal.id)?.produceReady ?? false);

  const motion = useMemo<AnimalMotion>(() => {
    const spot = startSpot(animal, index);
    return {
      ...spot,
      facing: Math.random() * Math.PI * 2,
      target: null,
      restUntil: performance.now() / 1000 + 1 + Math.random() * 3,
      emote: null,
      walkPhase: 0,
      moving: false,
    };
    // 처음 한 번만 정한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animal.id]);

  // 위치를 공유하고, 캐릭터가 동물을 뚫고 지나가지 않게 부딪힘을 단다
  const obstacle = useMemo<Obstacle & { kind: 'circle' }>(
    () => ({ kind: 'circle', x: motion.x, z: motion.z, radius: size.radius }),
    [motion, size.radius],
  );
  useEffect(() => {
    motions.set(animal.id, motion);
    obstacles.set(`animal_${animal.id}`, obstacle);
    return () => {
      motions.delete(animal.id);
      obstacles.delete(`animal_${animal.id}`);
    };
  }, [animal.id, motion, obstacle]);

  useInteractable({
    id: `animal_${animal.id}`,
    position: () => ({ x: motion.x, z: motion.z }),
    range: size.radius + 1.2,
    prompts: () => animalPrompts(animal.id),
    onAction: (actionId) => handleAnimalAction(animal.id, actionId),
  });

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 20);
    const now = performance.now() / 1000;
    const busy = motion.emote && performance.now() - motion.emote.startedAt < 1200;

    // 돌아다니기: 쉬다가 → 우리 안 아무 곳으로 걸어가기
    if (!motion.target && !busy && now > motion.restUntil) motion.target = randomSpot();
    motion.moving = false;
    if (motion.target && !busy) {
      const dx = motion.target.x - motion.x;
      const dz = motion.target.z - motion.z;
      const distance = Math.hypot(dx, dz);
      // 다른 동물과 너무 가까우면 멈추고 다른 곳을 고른다
      let crowded = false;
      for (const [id, other] of motions) {
        if (id === animal.id) continue;
        const ahead = Math.hypot(other.x - (motion.x + (dx / distance) * 0.4), other.z - (motion.z + (dz / distance) * 0.4));
        if (ahead < size.radius + 0.5) crowded = true;
      }
      if (distance < 0.1 || crowded) {
        motion.target = null;
        motion.restUntil = now + 1.6 + Math.random() * 3.4;
      } else {
        const step = Math.min(distance, size.speed * dt);
        motion.x += (dx / distance) * step;
        motion.z += (dz / distance) * step;
        let diff = Math.atan2(dx, dz) - motion.facing;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        motion.facing += diff * Math.min(1, dt * 5);
        motion.moving = true;
      }
    }
    obstacle.x = motion.x;
    obstacle.z = motion.z;

    if (!root.current || !body.current) return;
    root.current.position.set(motion.x, 0, motion.z);
    root.current.rotation.y = motion.facing;

    let bob = 0;
    let lean = 0;
    let tilt = 0;
    let turn = 0;
    let squash = 1;
    if (motion.moving) {
      motion.walkPhase += dt * 11;
      const step = Math.sin(motion.walkPhase);
      bob = Math.abs(step) * 0.05;
      tilt = step * 0.07;
    } else {
      // 숨쉬기 + 가끔 고개(몸) 돌리기. 동물마다 박자를 달리해 한꺼번에 움직이지 않게
      const t = now + index * 1.7;
      squash = 1 + Math.sin(t * 2.2) * 0.018;
      turn = Math.sin(t * 0.7) * 0.25 * Math.max(0, Math.sin(t * 0.31));
      if (animal.species === 'chicken') lean = Math.max(0, Math.sin(t * 1.3)) ** 6 * 0.6;
    }
    if (motion.emote) {
      const age = (performance.now() - motion.emote.startedAt) / 1000;
      if (motion.emote.kind === 'eat' && age < 1.2) {
        lean = Math.abs(Math.sin(age * Math.PI * 2.5)) * 0.45;
      } else if (motion.emote.kind === 'happy' && age < 0.6) {
        bob += Math.sin((age / 0.6) * Math.PI) * 0.35;
      } else {
        motion.emote = null;
      }
    }
    // 앞으로 숙일 때는 앞발 쪽을 축으로 (뒤가 들리지 않게 조금 내린다)
    body.current.position.y = bob - lean * 0.05;
    body.current.rotation.set(lean, turn, tilt);
    body.current.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
  });

  return (
    <>
      <group ref={root}>
        <group ref={body}>
          <GltfModel
            modelKey={MODELS.animals[animal.species]}
            fallback={<FallbackAnimal species={animal.species} />}
          />
        </group>
      </group>
      {produceReady && <Marker follow={() => motion} height={size.marker} />}
    </>
  );
}

/* --------------------------------- 울타리 --------------------------------- */

/** 울타리: 기둥과 가로대를 색마다 모양 하나로 합쳐 그린다 (상자 40개 → 그리기 2번) */
function Fence(): React.ReactElement {
  const { posts, rails } = useMemo(() => {
    const gateMin = pen.center.x - GATE_WIDTH / 2;
    const gateMax = pen.center.x + GATE_WIDTH / 2;
    const sides: [number, number, number, number][] = [
      [PEN_MIN_X, PEN_MIN_Z, PEN_MAX_X, PEN_MIN_Z],
      [PEN_MAX_X, PEN_MIN_Z, PEN_MAX_X, PEN_MAX_Z],
      [PEN_MAX_X, PEN_MAX_Z, gateMax, PEN_MAX_Z],
      [gateMin, PEN_MAX_Z, PEN_MIN_X, PEN_MAX_Z],
      [PEN_MIN_X, PEN_MAX_Z, PEN_MIN_X, PEN_MIN_Z],
    ];
    const postBoxes: BoxSpec[] = [];
    const railBoxes: BoxSpec[] = [];
    for (const [ax, az, bx, bz] of sides) {
      const length = Math.hypot(bx - ax, bz - az);
      const count = Math.max(1, Math.round(length / 1.2));
      const angle = Math.atan2(bx - ax, bz - az);
      for (let i = 0; i <= count; i += 1) {
        const t = i / count;
        postBoxes.push({ x: ax + (bx - ax) * t, y: 0.5, z: az + (bz - az) * t, w: 0.16, h: 1, d: 0.16 });
      }
      for (const y of [0.45, 0.8]) {
        railBoxes.push({ x: (ax + bx) / 2, y, z: (az + bz) / 2, w: 0.08, h: 0.12, d: length, rotationY: angle });
      }
    }
    return { posts: mergedBoxGeometry(postBoxes), rails: mergedBoxGeometry(railBoxes) };
  }, []);
  useEffect(
    () => () => {
      posts.dispose();
      rails.dispose();
    },
    [posts, rails],
  );

  return (
    <group>
      <mesh geometry={posts} castShadow>
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.9} />
      </mesh>
      <mesh geometry={rails} castShadow>
        <meshStandardMaterial color={PALETTE.wood} roughness={0.9} />
      </mesh>
    </group>
  );
}

/* ------------------------- 모델이 아직 없을 때의 임시 모양 ------------------------- */

function FallbackAnimal({ species }: { species: AnimalSpeciesId }): React.ReactElement {
  const { radius, color } = ANIMAL_BODY[species];
  return (
    <group>
      <mesh position-y={radius * 1.1} scale={[0.8, 0.75, 1.15]} castShadow>
        <sphereGeometry args={[radius, 18, 12]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <mesh position={[0, radius * 1.6, radius * 1.05]} castShadow>
        <sphereGeometry args={[radius * 0.5, 16, 12]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    </group>
  );
}

function FallbackBarn(): React.ReactElement {
  return (
    <group>
      <mesh position-y={1.2} castShadow receiveShadow>
        <boxGeometry args={[3.4, 2.4, 2.8]} />
        <meshStandardMaterial color="#d65f4f" roughness={0.9} />
      </mesh>
      <mesh position-y={3} rotation-z={Math.PI / 4} scale={[1.3, 1.3, 1]} castShadow>
        <boxGeometry args={[1.8, 1.8, 3]} />
        <meshStandardMaterial color={PALETTE.woodDark} roughness={0.9} />
      </mesh>
    </group>
  );
}

function FallbackTrough(): React.ReactElement {
  return (
    <mesh position-y={0.25} castShadow>
      <boxGeometry args={[TROUGH.length, 0.4, 0.55]} />
      <meshStandardMaterial color={PALETTE.wood} roughness={0.9} />
    </mesh>
  );
}
