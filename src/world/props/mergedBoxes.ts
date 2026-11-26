/**
 * 움직이지 않는 상자 여러 개를 모양 하나로 합친다. 울타리 기둥 · 가로대, 밭 테두리처럼
 * 같은 색 상자가 수십 개면 각각 그리는 것(상자마다 그리기 호출 1번, 그림자까지 2번)보다 훨씬 가볍다.
 * 태블릿에서는 그리기 호출 수가 프레임을 가장 많이 잡아먹는다.
 */
import { BoxGeometry, type BufferGeometry, Matrix4, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface BoxSpec {
  /** 상자 가운데 */
  x: number;
  y: number;
  z: number;
  /** 너비(x) · 높이(y) · 깊이(z) */
  w: number;
  h: number;
  d: number;
  /** y 축 회전 (라디안) */
  rotationY?: number;
  /** x 축 회전 (라디안). y 축 회전보다 먼저 돈다 (문짝의 X 무늬처럼 비스듬한 막대) */
  rotationX?: number;
  /**
   * 질감 반복 (가로, 세로). 크기가 다른 벽 여러 장을 합쳐도 판자 질감이 같은 크기로 깔리게 uv 를 늘린다.
   * 이걸 쓰면 질감 쪽 repeat 은 [1, 1] 로 둔다.
   */
  uvRepeat?: [number, number];
}

const UP = new Vector3(0, 1, 0);
const SIDE = new Vector3(1, 0, 0);

export function mergedBoxGeometry(boxes: BoxSpec[]): BufferGeometry {
  const parts = boxes.map(({ x, y, z, w, h, d, rotationY = 0, rotationX = 0, uvRepeat }) => {
    const box = new BoxGeometry(w, h, d);
    if (uvRepeat) {
      const uv = box.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvRepeat[0], uv.getY(i) * uvRepeat[1]);
    }
    const rotation = new Quaternion().setFromAxisAngle(UP, rotationY).multiply(new Quaternion().setFromAxisAngle(SIDE, rotationX));
    box.applyMatrix4(new Matrix4().compose(new Vector3(x, y, z), rotation, new Vector3(1, 1, 1)));
    return box;
  });
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  return merged;
}
