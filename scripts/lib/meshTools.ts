/**
 * glTF 모양 다듬기: 면 수 세기, 부드러운 법선, 무광 재질, 크기 · 방향 · 원점 맞추기.
 * 변환 서버가 만든 모델을 게임에 넣기 전에 gen-model.ts 가 쓴다.
 */
import type { Document, Primitive } from '@gltf-transform/core';
import { getBounds } from '@gltf-transform/functions';
import type { ModelSpec } from '@/config/models';

export function triangleCount(document: Document): number {
  let count = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives() as Primitive[]) {
      const indices = primitive.getIndices();
      const position = primitive.getAttribute('POSITION');
      count += (indices ? indices.getCount() : (position?.getCount() ?? 0)) / 3;
    }
  }
  return Math.round(count);
}

/**
 * 부드러운 법선을 만든다.
 *
 * 변환 서버는 법선 없이 위치와 UV 만 보낸다. 법선이 없으면 three.js 가 면마다 따로 빛을 받게
 * 그려서(flat shading) 각진 다면체처럼 보인다.
 * 질감 이음선에서는 같은 자리의 점이 UV 만 다르게 둘로 나뉘어 있다. 점 번호로 평균을 내면
 * 이음선을 따라 빛이 끊긴 줄이 생기므로, 위치가 같은 점끼리 묶어서 평균을 낸다.
 */
export function smoothNormals(document: Document): void {
  for (const mesh of document.getRoot().listMeshes()) {
    for (const primitive of mesh.listPrimitives() as Primitive[]) {
      const position = primitive.getAttribute('POSITION');
      const indices = primitive.getIndices();
      if (!position || !indices) continue;

      const count = position.getCount();
      const positions = new Float32Array(count * 3);
      const v = [0, 0, 0];
      for (let i = 0; i < count; i++) {
        position.getElement(i, v);
        positions.set(v, i * 3);
      }

      // 같은 위치를 같은 키로. 모델 크기의 10만분의 1 안쪽이면 같은 점으로 본다.
      const min = position.getMin([0, 0, 0]);
      const max = position.getMax([0, 0, 0]);
      const step = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 100_000 || 1;
      const groupOf = new Uint32Array(count);
      const groups = new Map<string, number>();
      for (let i = 0; i < count; i++) {
        const key = `${Math.round(positions[i * 3] / step)},${Math.round(positions[i * 3 + 1] / step)},${Math.round(positions[i * 3 + 2] / step)}`;
        let group = groups.get(key);
        if (group === undefined) {
          group = groups.size;
          groups.set(key, group);
        }
        groupOf[i] = group;
      }

      // 면 법선을 면적 가중으로 모은다 (외적의 길이가 곧 면적의 두 배)
      const sums = new Float32Array(groups.size * 3);
      const index = indices.getArray()!;
      for (let f = 0; f < index.length; f += 3) {
        const a = index[f] * 3;
        const b = index[f + 1] * 3;
        const c = index[f + 2] * 3;
        const abx = positions[b] - positions[a], aby = positions[b + 1] - positions[a + 1], abz = positions[b + 2] - positions[a + 2];
        const acx = positions[c] - positions[a], acy = positions[c + 1] - positions[a + 1], acz = positions[c + 2] - positions[a + 2];
        const nx = aby * acz - abz * acy;
        const ny = abz * acx - abx * acz;
        const nz = abx * acy - aby * acx;
        for (const vertex of [index[f], index[f + 1], index[f + 2]]) {
          const g = groupOf[vertex] * 3;
          sums[g] += nx;
          sums[g + 1] += ny;
          sums[g + 2] += nz;
        }
      }

      const normals = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const g = groupOf[i] * 3;
        const length = Math.hypot(sums[g], sums[g + 1], sums[g + 2]) || 1;
        normals[i * 3] = sums[g] / length;
        normals[i * 3 + 1] = sums[g + 1] / length;
        normals[i * 3 + 2] = sums[g + 2] / length;
      }

      const accessor = document
        .createAccessor()
        .setType('VEC3')
        .setArray(normals)
        .setBuffer(position.getBuffer());
      primitive.setAttribute('NORMAL', accessor);
    }
  }
}

/**
 * 재질을 무광 점토로 맞춘다. (ART_DIRECTION 5: 거칠기 0.8 이상, 금속성 없음)
 *
 * 변환 서버는 금속성 값을 쓰지 않는데, glTF 는 값이 없으면 "완전한 금속"(1)으로 읽는다.
 * 금속은 비출 주변 풍경이 없으면 검게 보여서, 게임 안 캐릭터가 거무튀튀해진다.
 */
export function matteMaterials(document: Document): void {
  for (const material of document.getRoot().listMaterials()) {
    if (material.getMetallicRoughnessTexture()) continue;
    material.setMetallicFactor(0);
    material.setRoughnessFactor(0.8);
  }
}

/** 모델의 모든 꼭짓점을 월드 좌표로 (노드 변환 포함) */
function worldPositions(document: Document): number[][] {
  const points: number[][] = [];
  const v = [0, 0, 0];
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const primitive of mesh.listPrimitives() as Primitive[]) {
      const position = primitive.getAttribute('POSITION');
      if (!position) continue;
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, v);
        points.push([
          m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
          m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
          m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
        ]);
      }
    }
  }
  return points;
}

/**
 * 동물처럼 앞뒤로 긴 모델이 +z 를 보게 하는 y 축 회전각.
 *
 * 옆모습 그림을 3D 로 바꾸면 몸이 비스듬히 놓이는 일이 있어(닭·염소가 45° 틀어짐), 정해진 각도로는 못 맞춘다.
 *  1. 위에서 본 꼭짓점들이 가장 길게 퍼진 방향(몸통 방향)을 z 축에 맞춘다 (2° 씩 돌려 보며 z 분산이 가장 큰 각)
 *  2. 가장 높은 꼭짓점들(머리 · 볏 · 뿔)이 있는 쪽을 앞(+z)으로
 */
function facingYaw(points: number[][]): number {
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cz = points.reduce((s, p) => s + p[2], 0) / points.length;
  let best = 0;
  let bestSpread = -Infinity;
  for (let deg = 0; deg < 180; deg += 2) {
    const a = (deg * Math.PI) / 180;
    let spread = 0;
    for (const p of points) {
      const z = -(p[0] - cx) * Math.sin(a) + (p[2] - cz) * Math.cos(a);
      spread += z * z;
    }
    if (spread > bestSpread) {
      bestSpread = spread;
      best = a;
    }
  }
  // 위쪽 15% 꼭짓점이 몸 중심보다 앞(+z)에 있으면 그대로, 뒤에 있으면 반대로 돌린다
  const sorted = [...points].sort((p, q) => q[1] - p[1]);
  const top = sorted.slice(0, Math.max(1, Math.floor(points.length * 0.15)));
  const headZ = top.reduce((s, p) => s + (-(p[0] - cx) * Math.sin(best) + (p[2] - cz) * Math.cos(best)), 0) / top.length;
  return headZ >= 0 ? best : best + Math.PI;
}

/** 높이를 맞추고 바닥 중앙을 원점에 둔다. 게임은 모델을 땅 위 좌표에 그대로 놓기만 하면 된다. */
export function normalize(document: Document, spec: ModelSpec): void {
  const { height, yaw = 0, orient = false, width, depth } = spec;
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
  // 앞을 자동으로 찾는 모델은 고정 각도(yaw) 대신 모양을 보고 정한다
  const angle = orient ? facingYaw(worldPositions(document)) : yaw;
  const root = document.createNode('root');
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    root.addChild(child);
  }
  scene.addChild(root);
  // 먼저 돌리고 키를 맞춘 다음, 돌린 모양 기준으로 바닥 중앙을 원점에 둔다
  root.setRotation([0, Math.sin(angle / 2), 0, Math.cos(angle / 2)]);
  const raw = getBounds(scene);
  // 납작한 물건(카펫 · 돌길)은 높이가 거의 0 이라 높이로 맞추면 엉터리가 된다. 가로 폭으로 맞춘다
  const scale = width
    ? width / Math.max(raw.max[0] - raw.min[0], raw.max[2] - raw.min[2])
    : height / (raw.max[1] - raw.min[1]);
  // 벽 장식은 앞뒤로만 눌러 납작하게 한다 (돌리지 않는 모델이라 z 가 곧 앞뒤다)
  const rawDepth = (raw.max[2] - raw.min[2]) * scale;
  const depthScale = depth && rawDepth > depth ? (scale * depth) / rawDepth : scale;
  root.setScale([scale, scale, depthScale]);
  const { min, max } = getBounds(scene);
  root.setTranslation([-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2]);
}
