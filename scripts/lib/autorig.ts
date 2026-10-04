/**
 * 생성 캐릭터에 걷기용 뼈대를 자동으로 단다.
 *
 * 생성 모델은 통짜 덩어리라 팔다리가 따로 움직이지 않는다. 캐릭터는 원본 그림에서
 * "정면을 보고 팔이 몸에서 살짝 떨어진 차렷 자세"로 만들었으므로, 모양만 보고 팔다리를 찾을 수 있다.
 *
 *  1. 다리: 바닥에서 위로 가로 단면을 올리며, 두 다리 사이(x ≈ 0)가 처음 막히는 높이 = 가랑이
 *     (꼬리처럼 뒤쪽에 있는 것은 빼고 앞쪽 절반만 본다)
 *  2. 팔: 가로 단면의 점들을 x 로 나누어 [팔 | 몸통 | 팔] 세 덩어리로 갈라지는 구간 = 팔.
 *     갈라짐이 끝나는 가장 높은 곳 = 겨드랑이, 그 조금 위 = 어깨 관절
 *  3. 무게: 부위별로 1/0 을 정한 뒤 이웃한 점끼리 몇 번 평균을 내어 관절 근처를 부드럽게 섞는다
 *
 * 뼈는 일곱 개: root(몸통) · leg_L · leg_R(허벅지) · arm_L · arm_R · shin_L · shin_R(정강이, 무릎 아래).
 * 이름은 게임(Player.tsx)이 찾는다. 정강이는 허벅지의 자식이라 허벅지를 따라가며 무릎에서 굽는다.
 * L/R 은 모델의 +x/-x 쪽이다 (모델은 +z 를 본다).
 */
import { Document, type Mesh, type Node, type Primitive } from '@gltf-transform/core';
import { clearNodeParent, clearNodeTransform } from '@gltf-transform/functions';

export const BONE_NAMES = ['root', 'leg_L', 'leg_R', 'arm_L', 'arm_R', 'shin_L', 'shin_R'] as const;
type Bone = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const ROOT = 0, LEG_L = 1, LEG_R = 2, ARM_L = 3, ARM_R = 4, SHIN_L = 5, SHIN_R = 6;
/** 뼈 개수와 부모 (root 는 부모 없음, 정강이는 허벅지 아래) */
const BONES = BONE_NAMES.length;
const PARENT: number[] = [-1, ROOT, ROOT, ROOT, ROOT, LEG_L, LEG_R];
/** 무릎 높이: 바닥 ~ 가랑이의 이 비율 */
const KNEE_RATIO = 0.48;

export interface RigReport {
  height: number;
  crotchY: number;
  armpitY: number;
  shoulderY: number;
  armBottomY: number;
  /** 부위별 점 수 (무게 0.5 넘는 것) */
  vertices: Record<(typeof BONE_NAMES)[number], number>;
  warnings: string[];
}

interface Geometry {
  positions: Float32Array;
  index: Uint32Array;
  count: number;
}

function readGeometry(primitive: Primitive): Geometry {
  const position = primitive.getAttribute('POSITION')!;
  const count = position.getCount();
  const positions = new Float32Array(count * 3);
  const v = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    position.getElement(i, v);
    positions.set(v, i * 3);
  }
  const raw = primitive.getIndices()!.getArray()!;
  return { positions, index: Uint32Array.from(raw), count };
}

interface Interval {
  min: number;
  max: number;
  /** 단면 조각의 앞뒤 위치 (가운데) */
  z: number;
}

/**
 * 높이 y 의 가로 단면. 면(삼각형)을 수평면으로 잘라 나온 조각들의 x 범위를 돌려준다.
 *
 * 꼭짓점만 모아 보면, 줄인 모델은 점이 듬성듬성해서 몸통 한가운데에도 빈틈이 생긴다
 * (몸통이 팔 두 개로 잘못 나뉜다). 면을 자르면 점 수와 상관없이 실제 단면이 나온다.
 */
function crossSection(geometry: Geometry, y: number): Interval[] {
  const { positions, index } = geometry;
  const out: Interval[] = [];
  const xs: number[] = [];
  const zs: number[] = [];
  for (let f = 0; f < index.length; f += 3) {
    xs.length = 0;
    zs.length = 0;
    for (let e = 0; e < 3; e++) {
      const a = index[f + e] * 3;
      const b = index[f + ((e + 1) % 3)] * 3;
      const ya = positions[a + 1];
      const yb = positions[b + 1];
      if ((ya - y) * (yb - y) > 0 || ya === yb) continue;
      const t = (y - ya) / (yb - ya);
      xs.push(positions[a] + (positions[b] - positions[a]) * t);
      zs.push(positions[a + 2] + (positions[b + 2] - positions[a + 2]) * t);
    }
    if (xs.length < 2) continue;
    out.push({ min: Math.min(...xs), max: Math.max(...xs), z: zs.reduce((s, v) => s + v, 0) / zs.length });
  }
  return out;
}

/** 단면 조각들을 x 로 합쳐 덩어리로 만든다. gap 보다 가까우면 한 덩어리 */
function mergeIntervals(intervals: Interval[], gap: number): { min: number; max: number }[] {
  const sorted = [...intervals].sort((a, b) => a.min - b.min);
  const clusters: { min: number; max: number }[] = [];
  for (const interval of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && interval.min <= last.max + gap) last.max = Math.max(last.max, interval.max);
    else clusters.push({ min: interval.min, max: interval.max });
  }
  return clusters;
}

/** 가운데 덩어리 = 몸통 (x=0 을 품거나 가장 가까운 것) */
function torsoOf(clusters: { min: number; max: number }[]): { min: number; max: number } | null {
  if (!clusters.length) return null;
  const containing = clusters.find((c) => c.min <= 0 && c.max >= 0);
  if (containing) return containing;
  return clusters.reduce((best, c) => (Math.abs((c.min + c.max) / 2) < Math.abs((best.min + best.max) / 2) ? c : best));
}

/**
 * 모델 전체를 한 덩어리 메쉬로 보고 뼈대를 단다. 모델은 바닥 중앙이 원점, +z 를 보고 있어야 한다.
 */
export function autoRig(document: Document): RigReport {
  const root = document.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const warnings: string[] = [];

  // 노드 변환(크기·위치 맞춘 것)을 꼭짓점에 구워 넣는다. 뼈 위치를 모델 좌표 그대로 쓰기 위해서다.
  const meshNodes = root.listNodes().filter((node) => node.getMesh());
  for (const node of meshNodes) {
    clearNodeParent(node);
    clearNodeTransform(node);
  }
  for (const node of root.listNodes()) {
    if (!node.getMesh() && node.listChildren().length === 0) node.dispose();
  }
  if (meshNodes.length !== 1 || meshNodes[0].getMesh()!.listPrimitives().length !== 1) {
    throw new Error(`뼈대는 메쉬 1개·면 묶음 1개짜리 모델에만 달 수 있다 (노드 ${meshNodes.length}개)`);
  }
  const meshNode = meshNodes[0];
  const mesh: Mesh = meshNode.getMesh()!;
  const primitive = mesh.listPrimitives()[0];
  const { positions, index, count } = readGeometry(primitive);

  let minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    minY = Math.min(minY, positions[i * 3 + 1]);
    maxY = Math.max(maxY, positions[i * 3 + 1]);
    minZ = Math.min(minZ, positions[i * 3 + 2]);
    maxZ = Math.max(maxZ, positions[i * 3 + 2]);
  }
  const height = maxY - minY;
  const step = height * 0.01;
  const gap = height * 0.012;
  /** 팔과 몸통 사이 틈. 어깨 쪽에서는 팔이 몸에 거의 붙어 있어 아주 작은 틈까지 본다 (면을 잘라 보므로 가능하다) */
  const armGap = height * 0.0035;

  const geometry = { positions, index, count };

  /* ---- 1. 가랑이 높이 ---- */
  // 뒤쪽(꼬리)은 빼고 앞쪽만 본다. 꼬리가 길면 상자 가운데가 뒤로 밀리므로, 하반신 점들의 깊이 중앙값을 기준으로 한다
  const lowerZ: number[] = [];
  for (let i = 0; i < count; i++) {
    if (positions[i * 3 + 1] < minY + height * 0.45) lowerZ.push(positions[i * 3 + 2]);
  }
  lowerZ.sort((a, b) => a - b);
  const frontZ = (lowerZ[Math.floor(lowerZ.length / 2)] ?? (minZ + maxZ) / 2) - height * 0.02;
  let crotchY = minY + height * 0.38;
  let found = false;
  for (let y = minY + height * 0.08; y < minY + height * 0.55; y += step) {
    const front = crossSection(geometry, y).filter((piece) => piece.z >= frontZ);
    const centerFilled = mergeIntervals(front, gap * 0.5).some((c) => c.min <= gap * 0.5 && c.max >= -gap * 0.5);
    if (centerFilled) {
      crotchY = y;
      found = true;
      break;
    }
  }
  if (!found) warnings.push('가랑이를 찾지 못해 키의 38% 로 잡았다');

  /* ---- 2. 팔: [팔 | 몸통 | 팔] 로 갈라지는 높이 구간 ---- */
  // 머리 옆(머리카락 · 귀)도 세 덩어리로 갈라지므로 목 아래(키의 62%)까지만 본다.
  // 그 안에서도 끊기지 않고 가장 길게 이어진 구간만 팔로 친다.
  const searchTopY = minY + height * 0.62;
  const sliceStep = height * 0.005;
  /** 단면 결과를 높이 칸마다 한 번만 계산해 둔다 (점마다 다시 자르지 않게) */
  const sliceCache = new Map<number, { clusters: { min: number; max: number }[]; torso: { min: number; max: number } | null }>();
  const sliceAt = (y: number) => {
    const key = Math.round(y / sliceStep);
    let slice = sliceCache.get(key);
    if (!slice) {
      const clusters = mergeIntervals(crossSection(geometry, key * sliceStep), armGap);
      slice = { clusters, torso: torsoOf(clusters) };
      sliceCache.set(key, slice);
    }
    return slice;
  };
  const split = (y: number) => {
    const { clusters, torso } = sliceAt(y);
    if (!torso) return false;
    return clusters.some((c) => c.max < torso.min) && clusters.some((c) => c.min > torso.max);
  };

  const runs: number[][] = [];
  let run: number[] = [];
  for (let y = crotchY - height * 0.15; y < searchTopY; y += sliceStep) {
    if (split(y)) {
      run.push(y);
      continue;
    }
    if (run.length) runs.push(run);
    run = [];
  }
  if (run.length) runs.push(run);
  const armRun = runs.reduce((best, r) => (r.length > best.length ? r : best), [] as number[]);
  const gapFound = armRun.length * sliceStep >= height * 0.05;

  /** 단면 전체 폭 (가장 왼쪽 ~ 가장 오른쪽) */
  const widthAt = (y: number) => {
    const { clusters } = sliceAt(y);
    return clusters.length ? clusters[clusters.length - 1].max - clusters[0].min : 0;
  };

  // 목: 몸통 위 ~ 머리 사이에서 단면이 가장 좁은 높이. 머리가 크니 목에서 확 좁아진다
  let neckY = minY + height * 0.62;
  let narrowest = Infinity;
  for (let y = minY + height * 0.5; y < minY + height * 0.8; y += sliceStep) {
    const w = widthAt(y);
    if (w > 0 && w < narrowest) {
      narrowest = w;
      neckY = y;
    }
  }

  // 몸통 가장자리. 팔과 몸 사이 틈이 보이는 곳이 있으면 그 맨 위(겨드랑이 바로 밑)의 몸통 폭,
  // 없으면(후드 속에 팔이 붙은 경우) 엉덩이 높이의 폭을 쓴다.
  let torsoLeft: number;
  let torsoRight: number;
  let armBottomY: number;
  let armpitY: number;
  if (gapFound) {
    const top = armRun.slice(Math.floor(armRun.length * 0.8));
    torsoLeft = Math.min(...top.map((y) => sliceAt(y).torso!.max));
    torsoRight = Math.max(...top.map((y) => sliceAt(y).torso!.min));
    armBottomY = armRun[0];
    armpitY = armRun[armRun.length - 1] + sliceStep;
  } else {
    warnings.push('팔과 몸 사이 틈이 없어 엉덩이 폭을 몸통 가장자리로 잡았다');
    const hip = sliceAt(crotchY + height * 0.06).clusters;
    torsoLeft = hip.length ? hip[hip.length - 1].max : height * 0.15;
    torsoRight = hip.length ? hip[0].min : -height * 0.15;
    armBottomY = crotchY;
    armpitY = crotchY;
  }
  // 어깨 관절: 목보다 조금 아래. 팔은 그 높이까지 붙어 있다
  const shoulderY = neckY - height * 0.06;

  const kneeY = minY + (crotchY - minY) * KNEE_RATIO;

  /* ---- 3. 부위 정하기 (1차: 딱 잘라서) ---- */
  const part = new Uint8Array(count) as Uint8Array & { [i: number]: Bone };
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    part[i] = ROOT;
    if (y >= armBottomY - sliceStep && y < shoulderY) {
      if (gapFound && y < armpitY) {
        // 틈이 보이는 구간: 자기 높이 단면에서 몸통보다 바깥 덩어리면 팔
        const { torso } = sliceAt(y);
        if (torso && x > torso.max + armGap * 0.5) part[i] = ARM_L;
        else if (torso && x < torso.min - armGap * 0.5) part[i] = ARM_R;
      } else {
        // 팔이 몸에 붙은 구간(겨드랑이 ~ 어깨): 몸통 가장자리보다 바깥이면 팔
        if (x > torsoLeft + armGap) part[i] = ARM_L;
        else if (x < torsoRight - armGap) part[i] = ARM_R;
      }
    }
    // 다리 높이라도 뒤로 튀어나온 것(공룡 꼬리)은 다리가 아니다
    const behind = positions[i * 3 + 2] < frontZ - height * 0.06;
    if (part[i] === ROOT && y < crotchY && !behind) {
      const below = y < kneeY;
      if (x >= 0) part[i] = below ? SHIN_L : LEG_L;
      else part[i] = below ? SHIN_R : LEG_R;
    }
  }

  /* ---- 4. 무게를 부드럽게: 같은 자리 점을 묶고, 이웃끼리 평균 ---- */
  const bbox = height || 1;
  const keyStep = bbox / 100_000;
  const groups = new Map<string, number>();
  const groupOf = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    const key = `${Math.round(positions[i * 3] / keyStep)},${Math.round(positions[i * 3 + 1] / keyStep)},${Math.round(positions[i * 3 + 2] / keyStep)}`;
    let g = groups.get(key);
    if (g === undefined) {
      g = groups.size;
      groups.set(key, g);
    }
    groupOf[i] = g;
  }
  const groupCount = groups.size;
  const neighbors: Set<number>[] = Array.from({ length: groupCount }, () => new Set());
  for (let f = 0; f < index.length; f += 3) {
    const a = groupOf[index[f]], b = groupOf[index[f + 1]], c = groupOf[index[f + 2]];
    neighbors[a].add(b).add(c);
    neighbors[b].add(a).add(c);
    neighbors[c].add(a).add(b);
  }
  // 무게 (그룹 × 뼈)
  let weights = new Float32Array(groupCount * BONES);
  const groupPart = new Uint8Array(groupCount);
  for (let i = 0; i < count; i++) groupPart[groupOf[i]] = part[i];
  for (let g = 0; g < groupCount; g++) weights[g * BONES + groupPart[g]] = 1;

  // 관절 근처만 섞이도록 몇 번만 평균낸다 (많이 하면 팔 전체가 몸통에 끌려간다)
  for (let iteration = 0; iteration < 4; iteration++) {
    const next = new Float32Array(weights.length);
    for (let g = 0; g < groupCount; g++) {
      const list = neighbors[g];
      for (let b = 0; b < BONES; b++) {
        let sum = weights[g * BONES + b] * 2;
        for (const n of list) sum += weights[n * BONES + b];
        next[g * BONES + b] = sum / (list.size + 2);
      }
    }
    weights = next;
  }

  /* ---- 5. 뼈 위치 (관절) ---- */
  const centroid = (bone: Bone, yMin: number, yMax: number) => {
    let sx = 0, sz = 0, n = 0;
    for (let i = 0; i < count; i++) {
      const y = positions[i * 3 + 1];
      if (part[i] !== bone || y < yMin || y > yMax) continue;
      sx += positions[i * 3];
      sz += positions[i * 3 + 2];
      n += 1;
    }
    return n ? { x: sx / n, z: sz / n } : { x: 0, z: 0 };
  };
  const hipBand = height * 0.06;
  const legL = centroid(LEG_L, crotchY - hipBand, crotchY);
  const legR = centroid(LEG_R, crotchY - hipBand, crotchY);
  const armL = centroid(ARM_L, armpitY - hipBand, armpitY);
  const armR = centroid(ARM_R, armpitY - hipBand, armpitY);
  const kneeBand = height * 0.03;
  const kneeL = centroid(SHIN_L, kneeY - kneeBand, kneeY);
  const kneeR = centroid(SHIN_R, kneeY - kneeBand, kneeY);
  /** 관절 위치 (모델 좌표). 뼈 번호 순서 */
  const pivots: [number, number, number][] = [
    [0, crotchY, (legL.z + legR.z) / 2],
    [legL.x, crotchY, legL.z],
    [legR.x, crotchY, legR.z],
    // 어깨 관절은 몸통 쪽으로 조금 당겨서 잡는다 (팔이 몸에서 떨어져 나가지 않게)
    [armL.x * 0.75, shoulderY, armL.z],
    [armR.x * 0.75, shoulderY, armR.z],
    [kneeL.x || legL.x, kneeY, kneeL.z || legL.z],
    [kneeR.x || legR.x, kneeY, kneeR.z || legR.z],
  ];

  /* ---- 6. glTF 뼈대 만들기 ---- */
  const skeletonRoot = document.createNode('rig');
  scene.addChild(skeletonRoot);
  // 뼈 위치는 부모 관절에서의 상대 위치로 적는다
  const joints: Node[] = BONE_NAMES.map((name, b) => {
    const parent = PARENT[b];
    const base = parent < 0 ? [0, 0, 0] : pivots[parent];
    return document
      .createNode(name)
      .setTranslation([pivots[b][0] - base[0], pivots[b][1] - base[1], pivots[b][2] - base[2]]);
  });
  skeletonRoot.addChild(joints[ROOT]);
  for (let b = 1; b < BONES; b++) joints[PARENT[b]].addChild(joints[b]);

  const buffer = primitive.getAttribute('POSITION')!.getBuffer();
  const inverseBind = new Float32Array(16 * BONES);
  for (let b = 0; b < BONES; b++) {
    const [px, py, pz] = pivots[b];
    // 뼈는 회전 없이 위치만 있으므로 역행렬 = 반대 방향으로 옮기기
    inverseBind.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -px, -py, -pz, 1], b * 16);
  }
  const skin = document
    .createSkin('rig')
    .setSkeleton(joints[ROOT])
    .setInverseBindMatrices(document.createAccessor().setType('MAT4').setArray(inverseBind).setBuffer(buffer));
  for (const joint of joints) skin.addJoint(joint);

  // 점마다 영향이 큰 뼈 두 개만 남긴다 (태블릿에서 가볍게)
  const jointArray = new Uint8Array(count * 4);
  const weightArray = new Float32Array(count * 4);
  const tally = new Array<number>(BONES).fill(0);
  const boneOrder = Array.from({ length: BONES }, (_, b) => b);
  for (let i = 0; i < count; i++) {
    const g = groupOf[i];
    const ranked = [...boneOrder].sort((a, b) => weights[g * BONES + b] - weights[g * BONES + a]);
    const w0 = weights[g * BONES + ranked[0]];
    const w1 = weights[g * BONES + ranked[1]];
    const sum = w0 + w1 || 1;
    jointArray.set([ranked[0], ranked[1], 0, 0], i * 4);
    weightArray.set([w0 / sum, w1 / sum, 0, 0], i * 4);
    if (w0 / sum > 0.5) tally[ranked[0]] += 1;
  }
  primitive.setAttribute('JOINTS_0', document.createAccessor().setType('VEC4').setArray(jointArray).setBuffer(buffer));
  primitive.setAttribute('WEIGHTS_0', document.createAccessor().setType('VEC4').setArray(weightArray).setBuffer(buffer));
  meshNode.setSkin(skin);

  return {
    height,
    crotchY,
    armpitY,
    shoulderY,
    armBottomY,
    vertices: Object.fromEntries(BONE_NAMES.map((name, b) => [name, tally[b]])) as RigReport['vertices'],
    warnings,
  };
}
