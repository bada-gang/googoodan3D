/** 동물 우리: 울타리(앞쪽에 문, 뒤쪽은 헛간 문 앞만 트임), 헛간, 여물통 · 물통, 표지판, 그리고 그 안의 동물들(Animal.tsx). */
import { useEffect, useMemo } from 'react';
import { PALETTE } from '@/config/artTokens';
import { MODELS } from '@/config/models';
import { SHOW_AREA_SIGNS } from '@/config/features';
import { AREA_NAME } from '@/config/strings';
import { useGameStore } from '@/state/gameStore';
import { GltfModel } from '../../../rendering/assets';
import { obstacles, type Obstacle } from '../../../state/runtime';
import { mergedBoxGeometry, type BoxSpec } from '../../../props/mergedBoxes';
import { SignBoard } from '../../../props/SignBoard';
import { StaticShadow } from '../../../rendering/bakedShadows';
import { BARN, BARN_OPENING, FENCE_THICKNESS, GATE_WIDTH, PEN_MAX_X, PEN_MAX_Z, PEN_MIN_X, PEN_MIN_Z, TROUGH, WATER_TROUGH, pen } from './penLayout';
import { Animal } from './Animal';
import { useInteractable } from '../../../systems/interaction';
import { goToScene } from '../../../state/scenes';

/**
 * 헛간 가운데에서 문 앞(들어가기 버튼이 뜨는 자리)까지, 그리고 버튼이 뜨는 거리.
 * 문에 바짝 다가가야 뜨게 한다 (헛간에 막혀 캐릭터는 가운데에서 2.25m 까지 다가간다)
 */
const BARN_DOOR_FRONT = 2.2;
const BARN_DOOR_RANGE = 0.75;

/* -------------------------------- 우리 전체 -------------------------------- */

export function AnimalPen(): React.ReactElement {
  const animals = useGameStore((s) => s.animals);

  // 헛간(마굿간) 문 앞에 서면 들어갈 수 있다 (scenes/barn)
  useInteractable({
    id: 'barn_door',
    // 문 소리만 (버튼 딸깍과 겹치지 않게)
    silentTap: true,
    position: () => ({ x: BARN.x, z: BARN.z + BARN_DOOR_FRONT }),
    range: BARN_DOOR_RANGE,
    prompts: () => [{ id: 'enter_barn', label: '마굿간 들어가기', enabled: true }],
    onAction: () => goToScene('BarnScene'),
  });

  // 울타리는 네 변을 얇은 상자로 막고, 앞쪽 가운데는 문으로, 뒤쪽은 헛간 문 앞을 비운다 (헛간이 막는다)
  useEffect(() => {
    const t = FENCE_THICKNESS / 2;
    const gateMin = pen.center.x - GATE_WIDTH / 2;
    const gateMax = pen.center.x + GATE_WIDTH / 2;
    const barnMin = BARN.x - BARN_OPENING / 2;
    const barnMax = BARN.x + BARN_OPENING / 2;
    const walls: [string, Obstacle][] = [
      ['fence_back_l', { kind: 'box', minX: PEN_MIN_X, maxX: barnMin, minZ: PEN_MIN_Z - t, maxZ: PEN_MIN_Z + t }],
      ['fence_back_r', { kind: 'box', minX: barnMax, maxX: PEN_MAX_X, minZ: PEN_MIN_Z - t, maxZ: PEN_MIN_Z + t }],
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
      [
        'water_trough',
        {
          kind: 'box',
          minX: WATER_TROUGH.x - 0.35,
          maxX: WATER_TROUGH.x + 0.35,
          minZ: WATER_TROUGH.z - WATER_TROUGH.length / 2,
          maxZ: WATER_TROUGH.z + WATER_TROUGH.length / 2,
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
      {/* 울타리 · 헛간 · 여물통 · 표지판은 움직이지 않아 그림자를 미리 그려 둔다 (rendering/bakedShadows) */}
      <StaticShadow>
        <Fence />
        <group position={[BARN.x, 0, BARN.z]}>
          <GltfModel modelKey={MODELS.buildings.barn} fallback={<FallbackBarn />} />
        </group>
        <group position={[TROUGH.x, 0, TROUGH.z]} rotation-y={TROUGH.rot}>
          <GltfModel modelKey={MODELS.buildings.trough} fallback={<FallbackTrough />} />
        </group>
        <group position={[WATER_TROUGH.x, 0, WATER_TROUGH.z]} rotation-y={WATER_TROUGH.rot}>
          <GltfModel modelKey={MODELS.buildings.waterTrough} fallback={<FallbackWaterTrough />} />
        </group>
        {/* 표지판은 울타리와 겹치지 않게 앞쪽 왼쪽 모서리 바깥에 */}
        {SHOW_AREA_SIGNS.pen && (
          <group position={[PEN_MIN_X - 0.9, 0, PEN_MAX_Z + 0.9]} rotation-y={0.25}>
            <SignBoard text={AREA_NAME.pen} width={1.7} />
          </group>
        )}
      </StaticShadow>
      {/* 꿀벌은 우리가 아니라 양봉장에 산다 (yard/apiary) */}
      {animals.filter((animal) => animal.species !== 'bee').map((animal, index) => (
        <Animal key={animal.id} animal={animal} index={index} />
      ))}
    </group>
  );
}

/* --------------------------------- 울타리 --------------------------------- */

/** 울타리: 기둥과 가로대를 색마다 모양 하나로 합쳐 그린다 (상자 40개 → 그리기 2번) */
function Fence(): React.ReactElement {
  const { posts, rails } = useMemo(() => {
    const gateMin = pen.center.x - GATE_WIDTH / 2;
    const gateMax = pen.center.x + GATE_WIDTH / 2;
    const barnMin = BARN.x - BARN_OPENING / 2;
    const barnMax = BARN.x + BARN_OPENING / 2;
    const sides: [number, number, number, number][] = [
      [PEN_MIN_X, PEN_MIN_Z, barnMin, PEN_MIN_Z],
      [barnMax, PEN_MIN_Z, PEN_MAX_X, PEN_MIN_Z],
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

/** 물통 모델이 아직 없을 때: 나무 통에 물 */
function FallbackWaterTrough(): React.ReactElement {
  return (
    <group>
      <mesh position-y={0.25} castShadow>
        <boxGeometry args={[WATER_TROUGH.length, 0.4, 0.55]} />
        <meshStandardMaterial color={PALETTE.wood} roughness={0.9} />
      </mesh>
      <mesh position-y={0.46} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[WATER_TROUGH.length - 0.16, 0.4]} />
        <meshStandardMaterial color="#7cc6e8" roughness={0.3} />
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
