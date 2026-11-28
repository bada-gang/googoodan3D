/**
 * 양봉장: 산 꿀벌(통)마다 동물 우리 안 구석의 정해진 자리에 양봉 통을 놓고, 둘레에 꿀벌이 날아다닌다.
 *
 * 꿀벌은 다른 가축과 같은 동물 상태(돌봄 · 벌꿀 준비)와 같은 규칙(pen/animalActions)을 쓴다.
 * 다른 점은 걷지 않는 것뿐이라, 통 자리를 동물 위치(motions)로 올려 두면 느낌표 · 별 · 글자가 그 자리에 뜬다.
 * 자리 · 크기는 apiaryLayout.ts, 꿀벌 모양 · 움직임은 BeeSwarm.tsx.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { MODELS } from '@/config/models';
import { useGameStore } from '@/state/gameStore';
import type { AnimalInstance } from '@/types/game';
import { GltfModel } from '../../../rendering/assets';
import { StaticShadow } from '../../../rendering/bakedShadows';
import { Marker } from '../../../effects/effects';
import { useInteractable } from '../../../systems/interaction';
import { obstacles } from '../../../state/runtime';
import { animalPrompts, handleAnimalAction } from '../pen/animalActions';
import { type AnimalMotion, motions } from '../pen/animalWander';
import { ANIMAL_BODY } from '../pen/penLayout';
import { useAnimalResting } from '../pen/animalRest';
import { HIVE_RADIUS, HIVE_RANGE, HIVE_SLOTS } from './apiaryLayout';
import { BeeSwarm } from './BeeSwarm';

export function Apiary(): React.ReactElement | null {
  const animals = useGameStore((s) => s.animals);
  const bees = useMemo(() => animals.filter((a) => a.species === 'bee').slice(0, HIVE_SLOTS.length), [animals]);
  if (bees.length === 0) return null;
  return (
    <group>
      {bees.map((bee, index) => (
        <Hive key={bee.id} bee={bee} slot={index} />
      ))}
      <BeeSwarm hives={bees.map((_, index) => HIVE_SLOTS[index])} />
    </group>
  );
}

function Hive({ bee, slot }: { bee: AnimalInstance; slot: number }): React.ReactElement {
  const at = HIVE_SLOTS[slot];
  const body = useRef<Group>(null);
  const produceReady = useGameStore((s) => s.animals.find((a) => a.id === bee.id)?.produceReady ?? false);
  // 벌꿀을 여러 번 받으면 잠시 쉰다 (zzz)
  const resting = useAnimalResting(bee.id);

  // 통 자리를 동물 위치로 올린다 (돌보기 · 받기 연출이 이 자리에 뜬다). 걷지 않으니 처음 한 번만
  const motion = useMemo<AnimalMotion>(
    () => ({ x: at.x, z: at.z, facing: at.rot, target: null, restUntil: 0, emote: null, walkPhase: 0, moving: false, visit: null, faceTo: null }),
    [at],
  );
  useEffect(() => {
    motions.set(bee.id, motion);
    obstacles.set(`animal_${bee.id}`, { kind: 'circle', x: at.x, z: at.z, radius: HIVE_RADIUS });
    return () => {
      motions.delete(bee.id);
      obstacles.delete(`animal_${bee.id}`);
    };
  }, [bee.id, motion, at]);

  useInteractable({
    id: `animal_${bee.id}`,
    position: () => at,
    range: HIVE_RANGE,
    prompts: () => animalPrompts(bee.id),
    onAction: (actionId) => handleAnimalAction(bee.id, actionId),
  });

  // 돌보면 통이 살짝 들썩, 벌꿀을 받으면 폴짝 (다른 가축의 '먹기' · '기쁨'과 같은 때)
  useFrame(() => {
    if (!body.current) return;
    let squash = 1;
    let hop = 0;
    if (motion.emote) {
      const age = (performance.now() - motion.emote.startedAt) / 1000;
      if (motion.emote.kind === 'eat' && age < 1) squash = 1 + Math.sin(age * Math.PI * 4) * 0.05 * (1 - age);
      else if (motion.emote.kind === 'happy' && age < 0.6) hop = Math.sin((age / 0.6) * Math.PI) * 0.15;
      else motion.emote = null;
    }
    body.current.position.y = hop;
    body.current.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
  });

  return (
    <>
      <group position={[at.x, 0, at.z]} rotation-y={at.rot}>
        <group ref={body}>
          {/* 통은 움직이는 것이 연출뿐이라 그림자는 한 번만 그려 땅에 굽는다 */}
          <StaticShadow>
            <GltfModel modelKey={MODELS.buildings.beehive} fallback={<FallbackHive />} />
          </StaticShadow>
        </group>
      </group>
      {produceReady && <Marker follow={() => motion} height={ANIMAL_BODY.bee.marker} />}
      {!produceReady && resting && <Marker follow={() => motion} height={ANIMAL_BODY.bee.marker} kind="sleep" />}
    </>
  );
}

/** 통 모델이 아직 없을 때: 노란 상자 두 칸 + 흰 지붕 */
function FallbackHive(): React.ReactElement {
  return (
    <group>
      <mesh position-y={0.35} castShadow>
        <boxGeometry args={[0.7, 0.7, 0.6]} />
        <meshStandardMaterial color="#f2c14e" roughness={0.85} />
      </mesh>
      <mesh position-y={0.78} castShadow>
        <boxGeometry args={[0.82, 0.12, 0.72]} />
        <meshStandardMaterial color="#fbf7ef" roughness={0.85} />
      </mesh>
    </group>
  );
}
