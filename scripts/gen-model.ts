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
 *
 * 단계별 도구는 scripts/lib/ 에 있다: hunyuan(3D 변환) · meshTools(법선 · 재질 · 크기 맞추기)
 * · colorAdjust(색 보정) · shadowProxy(그림자 사본) · autorig(캐릭터 뼈대) · codex(그림 생성) · sprite(아이콘).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { ASSET_MANIFEST, ASSET_SPEC_BY_KEY } from '@/config/assets';
import { MODEL_BUDGET, MODEL_MANIFEST, type ModelSpec } from '@/config/models';
import { MODEL_CONCEPT_STYLE, MODEL_PROMPTS } from './model-prompts';
import { autoRig } from './lib/autorig';
import { findCodex, generateImageWithCodex } from './lib/codex';
import { adjustColor } from './lib/colorAdjust';
import { checkServer, convertImageTo3D } from './lib/hunyuan';
import { matteMaterials, normalize, smoothNormals, triangleCount } from './lib/meshTools';
import { addShadowProxy } from './lib/shadowProxy';
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

/** 변환 서버로 원본 그림을 3D 로 바꿔 변환 원본(art-src/models/*.raw.glb)으로 남긴다 (lib/hunyuan) */
async function convertTo3D(spec: ModelSpec): Promise<void> {
  const started = Date.now();
  const glb = await convertImageTo3D(SERVER, readFileSync(conceptPath(spec)), MODEL_BUDGET[spec.budget].triangles);
  writeFileSync(rawPath(spec), glb);
  log(spec, 'convert', { seconds: Math.round((Date.now() - started) / 1000), bytes: glb.length });
}

/* ------------------------------ 3. 경량화 ------------------------------ */

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
  if (needsConversion) await checkServer(SERVER);
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
