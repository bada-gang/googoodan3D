/**
 * 3D 월드가 매 프레임 읽고 쓰는 상태.
 *
 * React 상태로 두면 1초에 60번 다시 그려진다. 그래서 위치·입력처럼 자주 바뀌는 값은
 * 여기 평범한 객체로 두고, 각 부품이 useFrame 안에서 직접 읽는다.
 * 저장할 게임 진행도는 여기 두지 않는다 (그건 gameStore).
 */
import { Vector3 } from 'three';

export type Emote = 'happy' | 'interact';

export const player = {
  position: new Vector3(),
  /** 바라보는 방향 (y 축 회전, 라디안). 0 이면 화면 아래(카메라 쪽)를 본다 */
  facing: 0,
  /** 지금 걷는 빠르기 (m/s). 걷기 동작의 박자에 쓴다 */
  speed: 0,
  /** 짧은 몸짓. 시작 시각과 함께 둔다 */
  emote: null as { kind: Emote; startedAt: number } | null,
  /** 오래 이어지는 자세. 낚시 중에는 두 팔을 앞으로 내밀어 낚싯대를 쥔다 */
  pose: null as 'fishing' | null,
  /** 오른손 자리 (월드 좌표). 낚싯대를 쥐여 준다. 뼈대가 없는 임시 캐릭터면 handReady 가 false */
  hand: new Vector3(),
  handReady: false,
};

export const input = {
  /** 조이스틱. 화면 기준 x 오른쪽, y 위. 길이 0~1 */
  stick: { x: 0, y: 0 },
  /** 눌린 키 (KeyboardEvent.code) */
  keys: new Set<string>(),
  /** 땅을 톡 친 자리. 도착하거나 조이스틱을 쓰면 지운다 */
  tapTarget: null as { x: number; z: number } | null,
};

/**
 * 걸어서 지나갈 수 없는 곳. 캐릭터는 원기둥(반지름 PLAYER_RADIUS)으로 보고 밀어낸다.
 * circle: 나무·집처럼 둥근 것, box: 우리 울타리처럼 네모난 구역.
 */
export type Obstacle =
  | { kind: 'circle'; x: number; z: number; radius: number }
  | { kind: 'box'; minX: number; maxX: number; minZ: number; maxZ: number };

export const PLAYER_RADIUS = 0.35;

export const obstacles = new Map<string, Obstacle>();

/** 땅보다 높은 네모 (밭 흙). 캐릭터가 위에 서면 그 높이만큼 올라선다 (발이 흙에 묻혀 잘려 보이지 않게) */
export interface RaisedArea {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

export const raisedAreas = new Map<string, RaisedArea>();

/** 발 가장자리가 걸치기만 해도 올라선다 (가운데만 보면 반쯤 걸친 발이 묻힌다) */
const FOOT_MARGIN = 0.15;

/** 이 자리에서 캐릭터가 설 높이 */
export function groundHeight(x: number, z: number): number {
  let height = 0;
  for (const area of raisedAreas.values()) {
    if (
      x > area.minX - FOOT_MARGIN &&
      x < area.maxX + FOOT_MARGIN &&
      z > area.minZ - FOOT_MARGIN &&
      z < area.maxZ + FOOT_MARGIN
    ) {
      height = Math.max(height, area.height);
    }
  }
  return height;
}

/** 걸어 다닐 수 있는 네모 범위. 장면마다 정한다 */
export const walkBounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };

export function playEmote(kind: Emote): void {
  player.emote = { kind, startedAt: performance.now() };
}

/** 장면이 바뀔 때 입력을 비운다. 손을 뗀 이벤트를 놓치면 계속 걸어가는 일을 막는다 */
export function resetInput(): void {
  input.stick = { x: 0, y: 0 };
  input.keys.clear();
  input.tapTarget = null;
}
