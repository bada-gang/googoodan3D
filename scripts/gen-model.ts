/**
 * 3D 모델 생성기. MODEL_MANIFEST 의 모델을 만든다.
 *
 *   npm run model -- --dry                무엇을 만들지만 본다
 *   npm run model                         없는 모델을 모두 만든다
 *   npm run model -- --only a,b --force   지정한 모델을 다시 만든다 (3D 변환부터)
 *   npm run model -- --reoptimize         변환 원본(art-src/models/)으로 경량화만 다시 한다
 *
 * 한 모델이 거치는 단계:
 *
 *   1. 원본 그림   이미 만든 이미지(fromArt) 또는 Codex 로 새로 생성 (무료)
 *   2. 3D 변환     Hunyuan3D 2.1 API 서버 (F:\ai\hunyuan21\run-googoo-api.bat 로 먼저 켠다)
 *   3. 경량화      면 수 줄이기 → 질감 축소(WebP) → 메쉬 압축(meshopt)
 *   4. 정리        높이를 맞추고 바닥 중앙을 원점으로, model-manifest.json 갱신
 *
 * 중간 결과는 art-src/models/ 에 남는다. 원본 그림과 변환 원본이 있으면 그 단계는 건너뛴다.
 */
import http from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { Document, NodeIO, type Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, getBounds, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { ASSET_MANIFEST, ASSET_SPEC_BY_KEY } from '@/config/assets';
import { MODEL_BUDGET, MODEL_MANIFEST, type ModelSpec } from '@/config/models';
import { MODEL_CONCEPT_STYLE, MODEL_PROMPTS } from './model-prompts';
import { autoRig } from './lib/autorig';
import { findCodex, generateImageWithCodex } from './lib/codex';
import { processSprite } from './lib/sprite';

const ROOT = process.cwd();
const PUBLIC_ASSETS = path.join(ROOT, 'public', 'assets');
const ART_SOURCE_DIR = path.join(ROOT, 'art-src');
const MODEL_SOURCE_DIR = path.join(ART_SOURCE_DIR, 'models');
const LOG_FILE = path.join(MODEL_SOURCE_DIR, 'log.jsonl');
const READY_FILE = path.join(PUBLIC_ASSETS, 'model-manifest.json');

/* --------------------------------- 인자 --------------------------------- */

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};

const DRY = flag('dry');
const FORCE = flag('force');
const REOPTIMIZE = flag('reoptimize');
/** 원본 그림으로 아이콘만 다시 만든다 (3D 변환 · 경량화 없이) */
const THUMBNAILS = flag('thumbnails');
const ONLY = option('only')?.split(',').map((s) => s.trim()).filter(Boolean);
const SERVER = option('server') ?? 'http://127.0.0.1:7960';

/* --------------------------------- 경로 --------------------------------- */

function conceptPath(spec: ModelSpec): string {
  return spec.fromArt
    ? path.join(ART_SOURCE_DIR, `${spec.fromArt}.png`)
    : path.join(MODEL_SOURCE_DIR, `${spec.key}.concept.png`);
}

function rawPath(spec: ModelSpec): string {
  return path.join(MODEL_SOURCE_DIR, `${spec.key}.raw.glb`);
}

function outputPath(spec: ModelSpec): string {
  return path.join(PUBLIC_ASSETS, spec.path);
}

function log(spec: ModelSpec, step: string, extra: Record<string, unknown>): void {
  appendFileSync(LOG_FILE, JSON.stringify({ key: spec.key, step, at: new Date().toISOString(), ...extra }) + '\n');
}

/* ------------------------------- 목록 검사 ------------------------------- */

function checkManifest(): void {
  const keys = new Set(MODEL_MANIFEST.map((m) => m.key));
  const problems: string[] = [];
  for (const spec of MODEL_MANIFEST) {
    if (!spec.fromArt && !MODEL_PROMPTS[spec.key]) problems.push(`원본 그림도 프롬프트도 없는 모델: ${spec.key}`);
  }
  for (const key of Object.keys(MODEL_PROMPTS)) {
    if (!keys.has(key)) problems.push(`매니페스트에 없는 프롬프트 키: ${key}`);
  }
  for (const key of ONLY ?? []) {
    if (!keys.has(key)) problems.push(`없는 키: ${key}`);
  }
  if (problems.length) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
}

/* ---------------------------- 1. 원본 그림 ---------------------------- */

async function ensureConcept(spec: ModelSpec, codexBin: string): Promise<void> {
  const target = conceptPath(spec);
  if (existsSync(target)) return;
  if (spec.fromArt) {
    throw new Error(`원본 그림 ${spec.fromArt} 이 없습니다. 먼저 npm run art -- --only ${spec.fromArt}`);
  }
  const result = await generateImageWithCodex(
    codexBin,
    { description: `${MODEL_CONCEPT_STYLE} ${MODEL_PROMPTS[spec.key]}`, aspect: 'square', transparent: false },
    path.join(ART_SOURCE_DIR, '.codex-work'),
  );
  writeFileSync(target, result.image);
  log(spec, 'concept', { prompt: result.prompt, thread: result.threadId });
}

/* ------------------------- 1-2. 원본 그림 → 아이콘 ------------------------- */

/**
 * 원본 그림으로 아이콘을 만든다. 흰 배경을 지우고 여백을 다듬어 256px 로.
 * 아이콘은 이미지 매니페스트(assets.ts)의 thumbnail 이라, 만든 뒤 art-manifest.json 도 갱신한다.
 */
async function writeThumbnail(spec: ModelSpec): Promise<boolean> {
  if (!spec.thumbnail) return false;
  const asset = ASSET_SPEC_BY_KEY[spec.thumbnail];
  if (!asset) throw new Error(`아이콘 키 ${spec.thumbnail} 이 assets.ts 에 없습니다`);
  const target = path.join(PUBLIC_ASSETS, asset.path);
  if (existsSync(target) && !FORCE && !THUMBNAILS) return false;
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, await processSprite(readFileSync(conceptPath(spec)), 256));
  return true;
}

function updateArtManifest(): void {
  const ready = ASSET_MANIFEST.filter((asset) => existsSync(path.join(PUBLIC_ASSETS, asset.path))).map((a) => a.key);
  writeFileSync(path.join(PUBLIC_ASSETS, 'art-manifest.json'), JSON.stringify({ ready }, null, 2) + '\n');
}

/* ----------------------------- 2. 3D 변환 ----------------------------- */

/**
 * fetch 대신 http 모듈을 쓴다. 변환은 수 분이 걸리는데 Node 의 fetch 는
 * 응답 머리를 5분까지만 기다린다. 서버는 다 만들 때까지 연결을 붙잡고 있다.
 */
function request(method: 'GET' | 'POST', url: string, body?: string): Promise<{ status: number; data: Buffer }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method,
        headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {},
        timeout: 0,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, data: Buffer.concat(chunks) }));
        res.on('error', reject);
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function checkServer(): Promise<void> {
  try {
    const { status } = await request('GET', `${SERVER}/ping`);
    if (status === 200) return;
  } catch {
    // 아래에서 안내한다
  }
  console.error(`3D 변환 서버(${SERVER})에 연결하지 못했습니다.`);
  console.error('먼저 F:\\ai\\hunyuan21\\run-googoo-api.bat 를 실행하고, 서버가 뜬 뒤 다시 시도하세요.');
  process.exit(1);
}

/**
 * 모양을 만드는 격자 해상도. 256 으로 고정한다.
 *
 * 낮추면 표면이 매끈해져 질감 조각이 줄지만, 실험 결과 쓸 수 없었다.
 *  - 128: 얇은 부분(잎)이 찢어진다
 *  - 192: 모양이 통째로 망가진다
 * 표면이 울퉁불퉁해서 면이 목표까지 줄지 않는 모델은 원본 그림을 매끈하게 다시 그린다
 * (scripts/model-prompts.ts).
 */
const OCTREE_RESOLUTION = 256;

/** 서버가 처음 만드는 모양의 대략적인 면 수 (octree 256, 열매 6개 실측 43~70만) */
const RAW_FACES_ESTIMATE = 600_000;

/**
 * 질감을 입히기 전에 서버에서 줄일 비율.
 *
 * 질감을 입힌 뒤에는 질감 이음선 때문에 목표까지 줄지 않는 모델이 있다 (오렌지: 1만 2천 개에서 멈춤).
 * 그래서 목표의 1.5배 정도까지 서버에서 미리 줄이고, 질감은 그 가벼운 모양에 맞춰 입힌다.
 */
function serverSimplifyRatio(spec: ModelSpec): number {
  const target = MODEL_BUDGET[spec.budget].triangles * 1.5;
  return Math.min(0.5, Math.max(0.002, target / RAW_FACES_ESTIMATE));
}

async function convertTo3D(spec: ModelSpec): Promise<void> {
  // 서버는 투명 배경을 검정으로 바꾼다. 흰 바탕에 얹어 보낸다.
  const png = await sharp(readFileSync(conceptPath(spec)))
    .flatten({ background: '#ffffff' })
    .resize(1024, 1024, { fit: 'contain', background: '#ffffff' })
    .png()
    .toBuffer();

  const started = Date.now();
  const body = JSON.stringify({
    single_multi_img_input: ['data:image/png;base64,' + png.toString('base64')],
    generate_what: 'make_meshes_and_tex',
    apply_texture: true,
    seed: 1234,
    num_inference_steps: 20,
    octree_resolution: OCTREE_RESOLUTION,
    // 1 이하는 비율로 받는다 (1 보다 크면 % 로 읽는다)
    mesh_simplify: serverSimplifyRatio(spec),
    texture_size: 1024,
    output_format: 'glb',
  });
  const generated = await request('POST', `${SERVER}/generate`, body);
  if (generated.status !== 200) {
    throw new Error(`변환 실패 (HTTP ${generated.status}): ${generated.data.toString().slice(0, 300)}`);
  }
  const model = await request('GET', `${SERVER}/download/model`);
  if (model.status !== 200) throw new Error(`결과 파일을 받지 못했습니다 (HTTP ${model.status})`);

  writeFileSync(rawPath(spec), model.data);
  log(spec, 'convert', { seconds: Math.round((Date.now() - started) / 1000), bytes: model.data.length });
}

/* ------------------------------ 3. 경량화 ------------------------------ */

function triangleCount(document: Document): number {
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
function smoothNormals(document: Document): void {
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
function matteMaterials(document: Document): void {
  for (const material of document.getRoot().listMaterials()) {
    if (material.getMetallicRoughnessTexture()) continue;
    material.setMetallicFactor(0);
    material.setRoughnessFactor(0.8);
  }
}

/**
 * 색 질감의 밝기 · 채도를 바꾼다 (models.ts 의 color). 배율 1 이 그대로.
 * warmHue 를 주면 빨강~노랑 사이의 색(껍질)을 모두 그 색조로 맞추고 선명하게 한다. 초록 잎은 그대로.
 * 3D 변환이 색을 칙칙하거나 얼룩지게 굽는 일이 있어서다 (오렌지가 배처럼 노랗고 아래만 붉었다).
 */
async function adjustColor(document: Document, color: NonNullable<ModelSpec['color']>): Promise<void> {
  const textures = new Set(
    document
      .getRoot()
      .listMaterials()
      .map((material) => material.getBaseColorTexture())
      .filter((texture) => texture !== null),
  );
  for (const texture of textures) {
    const image = texture.getImage();
    if (!image) continue;
    const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (color.warmHue !== undefined) {
      for (let i = 0; i < data.length; i += 4) {
        const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
        // 빨강(345°)~노랑(70°), 너무 회색이거나 어두운 곳(꼭지 그늘)은 빼고
        const warm = h >= 345 || h <= 70;
        if (!warm || s < 0.2 || l < 0.18) continue;
        // 파스텔처럼 옅게 구워진 껍질을 선명하게: 채도를 거의 끝까지, 너무 하얀 밝기는 조금 눌러서
        const [r, gr, b] = hslToRgb(color.warmHue, Math.max(s, 0.95), Math.min(l, 0.28 + l * 0.3));
        data[i] = r;
        data[i + 1] = gr;
        data[i + 2] = b;
      }
    }
    const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .modulate({ brightness: color.brightness ?? 1, saturation: color.saturation ?? 1 })
      .png()
      .toBuffer();
    texture.setImage(new Uint8Array(png)).setMimeType('image/png');
  }
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** 그림자 전용 사본의 면 수 (본 모양 대비) */
const SHADOW_PROXY_RATIO = 0.15;
/** 게임이 그림자 사본을 알아보는 이름 (src/world/assets3d.tsx 와 같아야 한다) */
const SHADOW_PROXY_NAME = 'shadow_proxy';

/**
 * 그림자 전용 사본을 모델 파일 안에 함께 넣는다. 그림자는 흐릿해서 모양이 조금 거칠어도 티가 안 나는데,
 * 그리는 비용은 면 수에 비례한다. 게임은 이 사본으로 그림자를 만들고 화면에는 원래 모양을 그린다.
 * 예전에는 태블릿이 모델을 불러올 때마다 직접 계산했다 — 장면에 들어갈 때 끊기고 계산 도구도 받아야 했다.
 * 위치만 남기고(무늬 이음매에서 끊긴 꼭짓점은 합친다) 면 수를 SHADOW_PROXY_RATIO 로 줄인다.
 */
function addShadowProxy(document: Document): { before: number; after: number } {
  let before = 0;
  let after = 0;
  const material = document.createMaterial(SHADOW_PROXY_NAME);
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || node.getName() === SHADOW_PROXY_NAME) continue;
    for (const primitive of mesh.listPrimitives() as Primitive[]) {
      const position = primitive.getAttribute('POSITION');
      const indices = primitive.getIndices();
      if (!position || !indices) continue;
      // 같은 자리 꼭짓점 합치기 (0.1mm 단위)
      const welded: number[] = [];
      const remap = new Uint32Array(position.getCount());
      const seen = new Map<string, number>();
      const v = [0, 0, 0];
      for (let i = 0; i < position.getCount(); i += 1) {
        position.getElement(i, v);
        const key = v.map((c) => Math.round(c * 1e4)).join(',');
        let id = seen.get(key);
        if (id === undefined) {
          id = welded.length / 3;
          seen.set(key, id);
          welded.push(v[0], v[1], v[2]);
        }
        remap[i] = id;
      }
      const source = new Uint32Array(indices.getCount());
      for (let i = 0; i < source.length; i += 1) source[i] = remap[indices.getScalar(i)];
      const target = Math.max(36, Math.floor((source.length * SHADOW_PROXY_RATIO) / 3) * 3);
      const [simplified] = MeshoptSimplifier.simplify(source, new Float32Array(welded), 3, target, 0.05);
      before += source.length / 3;
      after += simplified.length / 3;
      const proxyPrimitive = document
        .createPrimitive()
        .setAttribute('POSITION', document.createAccessor().setType('VEC3').setArray(new Float32Array(welded)))
        .setIndices(document.createAccessor().setType('SCALAR').setArray(new Uint32Array(simplified)))
        .setMaterial(material);
      const proxyMesh = document.createMesh(SHADOW_PROXY_NAME).addPrimitive(proxyPrimitive);
      // 원래 모양의 노드 아래에 둬서 위치 · 회전 · 크기를 그대로 따라간다
      node.addChild(document.createNode(SHADOW_PROXY_NAME).setMesh(proxyMesh));
    }
  }
  return { before, after };
}

/** 높이를 맞추고 바닥 중앙을 원점에 둔다. 게임은 모델을 땅 위 좌표에 그대로 놓기만 하면 된다. */
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

function normalize(document: Document, spec: ModelSpec): void {
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

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
});

/**
 * 면 줄이기의 허용 오차(모델 크기 대비 모양이 틀어져도 되는 비율).
 * 작은 값부터 써 보고, 목표 면 수에 못 미치면 다음 값으로 다시 줄인다.
 * 울퉁불퉁한 표면(오렌지 껍질 등)은 1% 안에서는 목표까지 줄지 않는다.
 */
const SIMPLIFY_ERRORS = [0.01, 0.02, 0.04];
/** 목표보다 이만큼까지 많은 것은 봐준다 */
const BUDGET_SLACK = 1.15;

/** 목표 면 수까지 줄인다. 오차 한도를 단계적으로 늘려 가며 원본에서 다시 줄인다. */
async function simplifyToBudget(spec: ModelSpec, triangles: number): Promise<{ document: Document; before: number }> {
  let best: { document: Document; before: number } | null = null;
  for (const error of SIMPLIFY_ERRORS) {
    const document = await io.read(rawPath(spec));
    const before = triangleCount(document);
    normalize(document, spec);
    await document.transform(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, triangles / before), error }),
    );
    best = { document, before };
    if (triangleCount(document) <= triangles * BUDGET_SLACK) break;
  }
  return best!;
}

async function optimize(spec: ModelSpec): Promise<{ before: number; after: number; bytes: number }> {
  const budget = MODEL_BUDGET[spec.budget];
  const { document, before } = await simplifyToBudget(spec, budget.triangles);
  // 줄인 뒤의 최종 모양으로 계산해야 맞다
  smoothNormals(document);
  matteMaterials(document);
  if (spec.color) await adjustColor(document, spec.color);
  // 뼈대가 있는 캐릭터는 몸이 움직여서 그림자 사본이 따라가지 못한다. 원래 모양으로 그림자를 만든다
  if (!spec.rig) {
    const proxy = addShadowProxy(document);
    log(spec, 'shadowProxy', proxy);
  }
  if (spec.rig) {
    const rig = autoRig(document);
    log(spec, 'rig', { ...rig });
    console.log(
      `  ${spec.key} 뼈대: 가랑이 ${rig.crotchY.toFixed(2)}m · 겨드랑이 ${rig.armpitY.toFixed(2)}m · ` +
        Object.entries(rig.vertices).map(([bone, n]) => `${bone} ${n}`).join(' '),
    );
    for (const warning of rig.warnings) console.warn(`  ⚠ ${spec.key}: ${warning}`);
  }

  await document.transform(
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [budget.texture, budget.texture],
      quality: 88,
    }),
    prune(),
    dedup(),
    // 위치·법선·UV 를 정수로 줄이고 압축한다. three.js 의 GLTFLoader + MeshoptDecoder 로 읽는다.
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );

  const after = triangleCount(document);
  const target = outputPath(spec);
  mkdirSync(path.dirname(target), { recursive: true });
  const data = await io.writeBinary(document);
  writeFileSync(target, data);
  log(spec, 'optimize', { before, after, bytes: data.length });
  return { before, after, bytes: data.length };
}

/* ------------------------------ 준비 목록 ------------------------------ */

function updateReadyManifest(): number {
  const ready = MODEL_MANIFEST.filter((spec) => existsSync(outputPath(spec))).map((spec) => spec.key);
  writeFileSync(READY_FILE, JSON.stringify({ ready }, null, 2) + '\n');
  return ready.length;
}

/* --------------------------------- 실행 --------------------------------- */

async function main(): Promise<void> {
  checkManifest();
  mkdirSync(MODEL_SOURCE_DIR, { recursive: true });
  await Promise.all([MeshoptEncoder.ready, MeshoptSimplifier.ready]);

  const selected = MODEL_MANIFEST.filter((spec) => !ONLY || ONLY.includes(spec.key));

  if (THUMBNAILS) {
    let made = 0;
    for (const spec of selected) {
      if (!spec.thumbnail || !existsSync(conceptPath(spec))) continue;
      if (await writeThumbnail(spec)) made += 1;
    }
    updateArtManifest();
    console.log(`아이콘 ${made}장을 원본 그림으로 만들었습니다.`);
    return;
  }

  if (REOPTIMIZE) {
    for (const spec of selected) {
      if (!existsSync(rawPath(spec))) continue;
      const { before, after, bytes } = await optimize(spec);
      console.log(`${spec.key}: 삼각형 ${before.toLocaleString()} → ${after.toLocaleString()}, ${(bytes / 1024).toFixed(0)}KB`);
    }
    console.log(`준비된 모델 ${updateReadyManifest()}/${MODEL_MANIFEST.length}`);
    return;
  }

  const todo = selected.filter((spec) => FORCE || !existsSync(outputPath(spec)));
  console.log(`만들 모델 ${todo.length}개`);
  for (const spec of todo) {
    const steps = [
      existsSync(conceptPath(spec)) ? null : '원본 그림',
      !FORCE && existsSync(rawPath(spec)) ? null : '3D 변환',
      '경량화',
    ].filter(Boolean);
    console.log(`  ${spec.key.padEnd(24)} ${spec.budget.padEnd(7)} ${steps.join(' → ')}`);
  }
  if (DRY || todo.length === 0) {
    if (todo.length === 0) console.log(`준비된 모델 ${updateReadyManifest()}/${MODEL_MANIFEST.length}`);
    return;
  }

  const needsConversion = todo.some((spec) => FORCE || !existsSync(rawPath(spec)));
  if (needsConversion) await checkServer();
  const codexBin = findCodex();

  const failures: string[] = [];

  // 원본 그림을 먼저 모두 만든다. Codex 는 동시에 두 장까지 돌리고, 3D 변환은 서버가 하나씩만 받는다.
  const needsConcept = todo.filter((spec) => !existsSync(conceptPath(spec)));
  if (needsConcept.length) {
    console.log(`원본 그림 ${needsConcept.length}장을 먼저 만듭니다...`);
    const queue = [...needsConcept];
    const worker = async () => {
      for (let spec = queue.shift(); spec; spec = queue.shift()) {
        try {
          await ensureConcept(spec, codexBin);
          console.log(`  원본 그림: ${spec.key}`);
        } catch (error) {
          failures.push(spec.key);
          console.error(`  원본 그림 실패: ${spec.key}: ${(error as Error).message}`);
        }
      }
    };
    await Promise.all([worker(), worker()]);
  }

  for (const [index, spec] of todo.entries()) {
    if (failures.includes(spec.key)) continue;
    const label = `[${index + 1}/${todo.length}] ${spec.key}`;
    try {
      await ensureConcept(spec, codexBin);
      if (await writeThumbnail(spec)) updateArtManifest();
      if (FORCE || !existsSync(rawPath(spec))) {
        console.log(`${label}: 3D 변환 중...`);
        await convertTo3D(spec);
      }
      const { before, after, bytes } = await optimize(spec);
      // 중간에 끊겨도 그때까지 만든 모델은 게임에 바로 보이게 한 개마다 갱신한다
      updateReadyManifest();
      console.log(
        `${label}: 삼각형 ${before.toLocaleString()} → ${after.toLocaleString()}, ${(bytes / 1024).toFixed(0)}KB`,
      );
    } catch (error) {
      failures.push(spec.key);
      console.error(`${label} 실패: ${(error as Error).message}`);
    }
  }

  console.log(`\n완료 ${todo.length - failures.length}개, 실패 ${failures.length}개. 준비된 모델 ${updateReadyManifest()}/${MODEL_MANIFEST.length}`);
  if (failures.length) {
    console.log(`실패한 것만 다시: npm run model -- --only ${failures.join(',')}`);
    process.exitCode = 1;
  }
}

void main();
