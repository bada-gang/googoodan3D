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
}

const UP = new Vector3(0, 1, 0);

export function mergedBoxGeometry(boxes: BoxSpec[]): BufferGeometry {
  const parts = boxes.map(({ x, y, z, w, h, d, rotationY = 0 }) => {
    const box = new BoxGeometry(w, h, d);
    box.applyMatrix4(
      new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(UP, rotationY), new Vector3(1, 1, 1)),
    );
    return box;
  });
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  return merged;
}
