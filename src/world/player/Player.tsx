/**
 * 내 캐릭터.
 *
 * 몸 전체는 장난감 피규어처럼 통통 튀고, 팔다리는 자동으로 단 뼈대(scripts/lib/autorig.ts)로 흔든다.
 *  - 걷기: 통통 튀며 좌우로 살짝 기우뚱, 팔다리를 엇갈려 흔든다. 다리를 앞으로 내딛을 때 무릎을 굽힌다
 *  - 서 있기: 숨쉬듯 아주 조금 커졌다 작아졌다, 팔도 살랑 (가만히 있어도 움직인다 — ART_DIRECTION 5)
 *  - 기쁨(정답): 두 팔을 번쩍 들고 폴짝 + 한 바퀴
 *  - 행동(문제 요청): 앞으로 까딱하며 두 팔을 앞으로
 *
 * 뼈 방향: 모델은 +z 를 본다. 팔다리 뼈를 x 축으로 음수만큼 돌리면 앞으로 나간다,
 * 팔을 z 축으로 돌리면 옆으로 들린다 (arm_L 은 +, arm_R 은 −).
 */
import { useCallback, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Bone, Group } from 'three';
import { MODELS } from '@/config/models';
import { useGameStore } from '@/state/gameStore';
import { characterOf, type CharacterId } from '@/types/game';
import { audio } from '@/audio/sfx';
import { GltfModel } from '../rendering/assets';
import { stepMovement } from '../systems/movement';
import { groundHeight, player } from '../state/runtime';
import { useWorldScene } from '../state/sceneStore';

/** 발소리 간격 (초) */
const STEP_INTERVAL = 0.32;
const HAPPY_SECONDS = 0.7;
/** 낚시할 때 팔을 앞으로 드는 정도 (라디안) */
const FISHING_ARMS = 0.95;
const INTERACT_SECONDS = 0.35;
/**
 * 걸을 때 허벅지를 흔드는 크기 (라디안). 앞으로 내딛는 쪽을 크게 해야 성큼성큼 걷는 것처럼 보인다.
 * 뒤로 차는 쪽까지 크게 하면 다리가 몸 뒤로 너무 빠진다.
 */
const LEG_FORWARD = 1.2;
const LEG_BACK = 0.75;
const ARM_SWING = 0.6;
/** 다리를 앞으로 가져올 때 무릎을 굽히는 크기. 없으면 막대처럼 뻣뻣해 보인다 */
const KNEE_BEND = 1.35;
/** 뒤로 찬 다리도 발끝이 땅을 밀며 무릎이 조금 굽는다 */
const KNEE_PUSH = 0.35;
/**
 * 뼈가 목표 자세로 다가가는 빠르기. 걷다 멈출 때 팔다리가 툭 끊기지 않게.
 * 걷는 중에는 빠르게 따라가야 목표 각도까지 다리가 벌어진다 (14 로는 70~80% 만 벌어져 걸음이 작아 보였다)
 */
const LIMB_FOLLOW = 14;
const LIMB_FOLLOW_WALK = 26;

interface Limbs {
  legL?: Bone;
  legR?: Bone;
  shinL?: Bone;
  shinR?: Bone;
  armL?: Bone;
  armR?: Bone;
}

/** 뼈 하나를 목표 각도로 부드럽게 */
function ease(bone: Bone | undefined, x: number, z: number, k: number): void {
  if (!bone) return;
  bone.rotation.x += (x - bone.rotation.x) * k;
  bone.rotation.z += (z - bone.rotation.z) * k;
}

export function Player(): React.ReactElement {
  const characterId = useGameStore((s) => characterOf(s.profile));
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const walkPhase = useRef(0);
  const stepTimer = useRef(0);
  const limbs = useRef<Limbs>({});
  const onBones = useCallback((bones: Record<string, Bone> | null) => {
    limbs.current = bones
      ? {
          legL: bones.leg_L,
          legR: bones.leg_R,
          shinL: bones.shin_L,
          shinR: bones.shin_R,
          armL: bones.arm_L,
          armR: bones.arm_R,
        }
      : {};
  }, []);

  useFrame((_, rawDelta) => {
    // 탭이 백그라운드에서 돌아오면 delta 가 커서 순간이동한다. 한 프레임 길이를 묶는다.
    const dt = Math.min(rawDelta, 1 / 20);
    const walking = stepMovement(dt);
    if (!root.current || !body.current) return;

    // 밭처럼 높은 곳에 오르내릴 때는 톡 튀지 않게 빨리 따라간다
    const groundY = groundHeight(player.position.x, player.position.z);
    const y = root.current.position.y + (groundY - root.current.position.y) * Math.min(1, dt * 18);
    root.current.position.set(player.position.x, y, player.position.z);
    root.current.rotation.y = player.facing;

    const t = performance.now() / 1000;
    let bob = 0;
    let tilt = 0;
    let lean = 0;
    let squash = 1;
    // 팔다리 목표 각도. legs/arms 는 앞뒤(x 축), raise 는 팔을 옆으로 드는 정도(z 축)
    let legSwing = 0;
    let kneeL = 0;
    let kneeR = 0;
    let armSwing = 0;
    let armForward = 0;
    let raise = 0.08;

    if (walking) {
      // 걸음 박자는 빠르기에 맞춘다 (느리면 느리게 튄다)
      walkPhase.current += dt * (6 + player.speed * 1.8);
      const step = Math.sin(walkPhase.current);
      // 팔다리가 움직이니 몸통 기우뚱은 조금만
      bob = Math.abs(step) * 0.07;
      tilt = step * 0.05;
      lean = 0.06;
      const strength = Math.min(1, player.speed / 3);
      legSwing = step * strength;
      armSwing = step * ARM_SWING * strength;
      // 다리가 앞으로 나오는 동안(허벅지가 앞으로 움직이는 동안) 무릎을 굽힌다. 왼쪽과 오른쪽은 반 박자 차이.
      // 왼 허벅지 각도는 -sin(박자) 라서, 각도가 줄어드는(앞으로 가는) 때는 cos(박자) > 0 이다
      const forwardL = Math.cos(walkPhase.current);
      kneeL = (Math.max(0, forwardL) * KNEE_BEND + Math.max(0, -forwardL) * KNEE_PUSH) * strength;
      kneeR = (Math.max(0, -forwardL) * KNEE_BEND + Math.max(0, forwardL) * KNEE_PUSH) * strength;
      stepTimer.current += dt;
      if (stepTimer.current > STEP_INTERVAL) {
        stepTimer.current = 0;
        // 집 안은 나무 바닥, 밖은 풀밭 발소리
        audio.play('step', useWorldScene.getState().scene === 'HomeScene' ? 'wood' : 'grass');
      }
    } else {
      walkPhase.current = 0;
      stepTimer.current = STEP_INTERVAL * 0.6;
      squash = 1 + Math.sin(t * 2.4) * 0.015;
      armSwing = Math.sin(t * 1.6) * 0.04;
    }

    let spin = 0;
    const emote = player.emote;
    if (emote) {
      const age = (performance.now() - emote.startedAt) / 1000;
      if (emote.kind === 'happy' && age < HAPPY_SECONDS) {
        const k = age / HAPPY_SECONDS;
        bob += Math.sin(k * Math.PI) * 0.45;
        spin = k * Math.PI * 2;
        squash *= k < 0.15 ? 1 - (0.15 - k) * 0.8 : 1;
        // 만세: 두 팔을 옆으로 번쩍
        raise = 2.5 * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5);
        legSwing = 0;
        armSwing = 0;
      } else if (emote.kind === 'interact' && age < INTERACT_SECONDS) {
        const k = Math.sin((age / INTERACT_SECONDS) * Math.PI);
        lean += k * 0.25;
        armForward = k * 1.1;
      } else {
        player.emote = null;
      }
    }

    // 낚시 자세: 두 팔을 앞으로 내밀어 낚싯대를 쥔다 (낚싯대는 연못 쪽 FishingGear 가 그린다)
    if (player.pose === 'fishing' && !walking) {
      armForward = Math.max(armForward, FISHING_ARMS);
      armSwing = 0;
      raise = 0.02;
    }

    body.current.position.y = bob;
    body.current.rotation.set(lean, spin, tilt);
    body.current.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));

    // 팔다리. 같은 쪽 팔다리는 반대로 (왼다리가 앞이면 왼팔은 뒤)
    const k = 1 - Math.exp(-(walking ? LIMB_FOLLOW_WALK : LIMB_FOLLOW) * dt);
    const { legL, legR, shinL, shinR, armL, armR } = limbs.current;
    // legSwing > 0 이면 왼다리가 앞(각도 −), 오른다리가 뒤
    ease(legL, legSwing > 0 ? -legSwing * LEG_FORWARD : -legSwing * LEG_BACK, 0, k);
    ease(legR, legSwing > 0 ? legSwing * LEG_BACK : legSwing * LEG_FORWARD, 0, k);
    // 무릎은 뒤로만 굽는다 (정강이를 +x 로 돌리면 발이 뒤로 간다)
    ease(shinL, kneeL, 0, k);
    ease(shinR, kneeR, 0, k);
    ease(armL, armSwing - armForward, raise, k);
    ease(armR, -armSwing - armForward, -raise, k);
  });

  return (
    <group ref={root}>
      <group ref={body}>
        <GltfModel
          modelKey={MODELS.characters[characterId]}
          fallback={<ToyKid characterId={characterId} />}
          onBones={onBones}
        />
      </group>
    </group>
  );
}

/** 모델이 아직 없을 때의 임시 캐릭터. 캐릭터마다 옷 색만 다르다 */
const LOOK: Record<CharacterId, { body: string; head: string }> = {
  boy: { body: '#f3c74f', head: '#6b4632' },
  girl: { body: '#f6a8bd', head: '#835a41' },
  farmer: { body: '#8fd8c4', head: '#e3cfa4' },
  dino: { body: '#8ed486', head: '#6fbf6a' },
  bunny: { body: '#fdfaf2', head: '#fdfaf2' },
  astro: { body: '#e8e8f0', head: '#b8a0e0' },
};

function ToyKid({ characterId }: { characterId: CharacterId }): React.ReactElement {
  const look = LOOK[characterId];
  return (
    <group>
      <mesh position-y={0.42} castShadow>
        <capsuleGeometry args={[0.24, 0.32, 6, 16]} />
        <meshStandardMaterial color={look.body} roughness={0.85} />
      </mesh>
      <mesh position-y={0.92} castShadow>
        <sphereGeometry args={[0.27, 24, 16]} />
        <meshStandardMaterial color="#f6d3ae" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.02, -0.03]} castShadow>
        <sphereGeometry args={[0.285, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={look.head} roughness={0.85} />
      </mesh>
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, 0.93, 0.25]}>
          <sphereGeometry args={[0.035, 12, 8]} />
          <meshStandardMaterial color="#4a3a2f" />
        </mesh>
      ))}
    </group>
  );
}
