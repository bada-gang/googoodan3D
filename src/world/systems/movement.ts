/**
 * 캐릭터 이동 계산. 그리기와 떨어뜨려 두어 규칙만 따로 읽을 수 있게 한다.
 *
 * 입력 우선순위: 조이스틱 > 키보드 > 땅 톡 치기.
 * 카메라는 늘 같은 방향(남쪽 위)에서 보므로 화면 위 = 월드 -z 다.
 */
import { useUiStore } from '@/state/uiStore';
import { PLAYER_RADIUS, input, obstacles, player, walkBounds } from '../state/runtime';

/** 최고 속도 (m/s). 2학년이 조작하기에 너무 빠르지 않게 */
export const WALK_SPEED = 4;
/** 속도가 목표에 다가가는 정도. 클수록 바로 서고 바로 출발한다 */
const ACCELERATION = 12;
/** 땅 톡 치기로 이 거리 안에 오면 도착 */
const ARRIVE_DISTANCE = 0.2;

const velocity = { x: 0, z: 0 };

/** 문제 창이나 가게 창이 열려 있으면 걷지 않는다 (꾸미기 중에는 걸을 수 있다) */
function movementBlocked(): boolean {
  const ui = useUiStore.getState();
  return ui.math !== null || (ui.overlay !== null && ui.overlay !== 'decorate') || ui.levelUpTo !== null;
}

/** 이번 프레임에 가고 싶은 방향과 세기 (월드 x, z, 길이 0~1) */
function desiredDirection(): { x: number; z: number } {
  const { stick, keys, tapTarget } = input;
  if (stick.x !== 0 || stick.y !== 0) {
    input.tapTarget = null;
    return { x: stick.x, z: -stick.y };
  }

  let kx = 0;
  let kz = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) kx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) kx += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) kz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) kz += 1;
  if (kx !== 0 || kz !== 0) {
    input.tapTarget = null;
    const length = Math.hypot(kx, kz);
    return { x: kx / length, z: kz / length };
  }

  if (tapTarget) {
    const dx = tapTarget.x - player.position.x;
    const dz = tapTarget.z - player.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < ARRIVE_DISTANCE) {
      input.tapTarget = null;
      return { x: 0, z: 0 };
    }
    // 도착 직전에는 천천히
    const strength = Math.min(1, distance / 0.8);
    return { x: (dx / distance) * strength, z: (dz / distance) * strength };
  }
  return { x: 0, z: 0 };
}

/** 장애물과 겹치면 밖으로 밀어낸다 */
function resolveCollisions(): void {
  const p = player.position;
  for (const obstacle of obstacles.values()) {
    if (obstacle.kind === 'circle') {
      const dx = p.x - obstacle.x;
      const dz = p.z - obstacle.z;
      const min = obstacle.radius + PLAYER_RADIUS;
      const distance = Math.hypot(dx, dz);
      if (distance < min && distance > 1e-6) {
        p.x = obstacle.x + (dx / distance) * min;
        p.z = obstacle.z + (dz / distance) * min;
      }
    } else {
      const minX = obstacle.minX - PLAYER_RADIUS;
      const maxX = obstacle.maxX + PLAYER_RADIUS;
      const minZ = obstacle.minZ - PLAYER_RADIUS;
      const maxZ = obstacle.maxZ + PLAYER_RADIUS;
      if (p.x > minX && p.x < maxX && p.z > minZ && p.z < maxZ) {
        // 가장 가까운 변으로 밀어낸다
        const pushes = [p.x - minX, maxX - p.x, p.z - minZ, maxZ - p.z];
        const smallest = Math.min(...pushes);
        if (smallest === pushes[0]) p.x = minX;
        else if (smallest === pushes[1]) p.x = maxX;
        else if (smallest === pushes[2]) p.z = minZ;
        else p.z = maxZ;
      }
    }
  }
  p.x = Math.min(walkBounds.maxX, Math.max(walkBounds.minX, p.x));
  p.z = Math.min(walkBounds.maxZ, Math.max(walkBounds.minZ, p.z));
}

/** 한 프레임 이동. 걸었는지 돌려준다 (발소리·걷기 동작에 쓴다) */
export function stepMovement(dt: number): boolean {
  const desired = movementBlocked() ? { x: 0, z: 0 } : desiredDirection();
  const blend = 1 - Math.exp(-ACCELERATION * dt);
  velocity.x += (desired.x * WALK_SPEED - velocity.x) * blend;
  velocity.z += (desired.z * WALK_SPEED - velocity.z) * blend;

  const speed = Math.hypot(velocity.x, velocity.z);
  if (speed < 0.05) {
    velocity.x = 0;
    velocity.z = 0;
    player.speed = 0;
    return false;
  }

  player.position.x += velocity.x * dt;
  player.position.z += velocity.z * dt;
  resolveCollisions();
  player.speed = speed;

  // 가는 쪽으로 몸을 돌린다. 모델의 앞은 +z (glTF 기준)
  const target = Math.atan2(velocity.x, velocity.z);
  let diff = target - player.facing;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  player.facing += diff * Math.min(1, dt * 12);
  return true;
}

/** 장면이 바뀌거나 처음 놓일 때 */
export function placePlayer(x: number, z: number, facing = 0): void {
  player.position.set(x, 0, z);
  player.facing = facing;
  player.speed = 0;
  velocity.x = 0;
  velocity.z = 0;
}
