/**
 * 양봉장(꿀벌) 배치: 동물 우리 안 왼쪽 울타리에 붙여 세로로 양봉 통 자리 두 개 (예전 건초통 자리).
 * 꿀벌은 우리 안을 걷지 않고, 산 순서대로 이 자리에 통이 놓인다. 숫자는 이 파일만 고친다.
 * 우리 동물들은 이 구석을 피해 다닌다 (pen/animalActions 의 APIARY_AREA).
 */
import { PEN_MIN_X, pen } from '../pen/penLayout';

/** 통 자리 (산 순서대로). 꿀벌은 최대 2통 (catalog ANIMAL_SPECIES.bee.maxCount) */
export const HIVE_SLOTS = [
  { x: PEN_MIN_X + 0.7, z: pen.center.z - 0.8, rot: Math.PI / 2 },
  { x: PEN_MIN_X + 0.7, z: pen.center.z + 0.8, rot: Math.PI / 2 },
];

/** 통 부딪힘 반지름, 버튼이 뜨는 거리 */
export const HIVE_RADIUS = 0.5;
export const HIVE_RANGE = 1.5;

/** 통이 놓이는 구석 (우리 동물이 들어오지 않고, 마당 꾸미기로 물건을 놓지 못한다) */
export const APIARY_AREA = {
  minX: PEN_MIN_X,
  maxX: PEN_MIN_X + 1.5,
  minZ: pen.center.z - 1.7,
  maxZ: pen.center.z + 1.7,
};

/** 통마다 날아다니는 꿀벌 수 (첫 통 3, 둘째 통 2) */
export const BEES_PER_HIVE = [3, 2];
/** 꿀벌이 통 둘레를 도는 반지름 (m) — 우리 울타리를 크게 넘지 않게 */
export const BEE_ORBIT = { min: 0.35, max: 0.75 };
