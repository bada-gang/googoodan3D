/**
 * 우리 안을 돌아다니는 동물 한 마리.
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
import { MODELS } from '@/config/models';
import { useGameStore } from '@/state/gameStore';
import type { AnimalInstance, AnimalSpeciesId } from '@/types/game';
import { GltfModel } from '../../../rendering/assets';
import { Marker } from '../../../effects/effects';
import { useInteractable } from '../../../systems/interaction';
import { obstacles, type Obstacle } from '../../../state/runtime';
import { ANIMAL_BODY } from './penLayout';
import { type AnimalMotion, animalPrompts, handleAnimalAction, motions, randomSpot, startSpot } from './animalActions';

/* ---------------------------------- 동물 ---------------------------------- */

export function Animal({ animal, index }: { animal: AnimalInstance; index: number }): React.ReactElement {
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
