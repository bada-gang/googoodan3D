/**
 * 색이 다른 막대 · 상자 여러 개를 모양 하나로 합친다. 색은 꼭짓점 색(vertexColors)으로 넣는다.
 * 재질 하나로 그려서, 부품이 몇 개든 그리기 호출 1번이다 (태블릿은 그리기 호출 수가 프레임을 가장 많이 잡아먹는다).
 * 질감(무늬 그림)이 필요 없는 단색 부품에 쓴다: 정글짐 · 그네(props/CodeFurniture), 집 안 창틀 · 문 · 굽도리(scenes/home).
 * 같은 색 상자만 합칠 때는 props/mergedBoxes (질감 반복까지 된다).
 */
import { BoxGeometry, type BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** 막대: from 에서 to 까지 (m). 면 8개짜리 원기둥 */
export interface Bar {
  from: [number, number, number];
  to: [number, number, number];
  radius: number;
  color: string;
}

/** 상자: 가운데 · 크기 (m). 축에 나란하다 */
export interface Block {
  at: [number, number, number];
  size: [number, number, number];
  color: string;
}

export type Part = Bar | Block;

const UP = new Vector3(0, 1, 0);

function partGeometry(part: Part): BufferGeometry {
  let geometry: BufferGeometry;
  if ('from' in part) {
    const from = new Vector3(...part.from);
    const to = new Vector3(...part.to);
    const length = from.distanceTo(to);
    // 막대는 면 8개면 둥글어 보인다 (태블릿용으로 적게)
    geometry = new CylinderGeometry(part.radius, part.radius, length, 8, 1, false);
    const rotation = new Quaternion().setFromUnitVectors(UP, to.clone().sub(from).normalize());
    geometry.applyMatrix4(new Matrix4().compose(from.clone().add(to).multiplyScalar(0.5), rotation, new Vector3(1, 1, 1)));
  } else {
    geometry = new BoxGeometry(...part.size);
    geometry.translate(...part.at);
  }
  // 합치려면 속성이 같아야 한다: 꼭짓점 색을 넣고 uv 는 뺀다
  geometry.deleteAttribute('uv');
  const color = new Color(part.color);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([color.r, color.g, color.b], i * 3);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry.index ? geometry.toNonIndexed() : geometry;
}

/** 부품들을 모양 하나로. 재질에 vertexColors 를 켜고 color 는 흰색으로 둔다 */
export function coloredPartsGeometry(parts: Part[]): BufferGeometry {
  const pieces = parts.map(partGeometry);
  const merged = mergeGeometries(pieces, false);
  for (const piece of pieces) piece.dispose();
  return merged;
}
