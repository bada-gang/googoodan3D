/**
 * 해의 방향. 해는 늘 같은 방향(화면 왼쪽 위 뒤쪽)에서 비춘다 — 시간에 따라 바뀌는 것은 색과 밝기뿐이다.
 * 방향이 고정이라 움직이지 않는 물체의 그림자를 미리 그려 둘 수 있다 (core/bakedShadows).
 */
import { Vector3 } from 'three';

/** 그림자 중심에서 해까지 (m). 실시간 그림자의 해 위치와 미리 그리는 그림자의 방향에 같이 쓴다 */
export const SUN_OFFSET = new Vector3(-8, 14, 6);

/**
 * 그림자 전용 사본(면 수를 줄인 모양)만 두는 레이어. 화면 카메라는 0번만 봐서 이 사본은 화면에 안 그려지고,
 * 해의 그림자 카메라만 이 레이어도 본다 (assets3d 의 shadowProxy).
 */
export const SHADOW_PROXY_LAYER = 1;
