/**
 * 게임 이미지 생성기. ASSET_MANIFEST 의 그림을 만든다.
 *
 *   npm run art -- --dry                 무엇을 몇 장 만들지만 본다
 *   npm run art                          없는 그림을 모두 만든다
 *   npm run art -- --only a,b --force    지정한 그림을 다시 만든다
 *   npm run art -- --reprocess           원본(art-src/)으로 후처리만 다시 한다
 *
 * 만드는 방법(--engine) 두 가지:
 *
 *   codex (기본)  이 PC 에 로그인된 Codex 의 이미지 생성을 쓴다.
 *                 ChatGPT 구독(Plus 이상) 사용량에서 빠지고 따로 요금이 없다. --parallel 2
 *   api           OpenAI 이미지 API. .env.local 의 OPENAI_API_KEY 가 필요하고 장당 요금이 나간다.
 *                 --model gpt-image-2  --quality low|medium|high  --ipm 5
 *
 * 이 스크립트는 개발 PC 에서만 돌고 게임 번들에는 들어가지 않는다.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ASSET_MANIFEST as ALL_ASSETS, type AssetKind, type AssetSpec } from '@/config/assets';
import { ART_ADJUST, ART_PROMPTS, KIND_PROMPT } from './art-prompts';
import { findCodex, generateImageWithCodex } from './lib/codex';
import { processSprite } from './lib/sprite';

/**
 * 이 스크립트가 만드는 그림. thumbnail(가구 · 동물 · 캐릭터 아이콘)은 3D 모델의 원본 그림으로
 * npm run model 이 만든다.
 */
type GeneratedKind = Exclude<AssetKind, 'thumbnail'>;
type GenSpec = AssetSpec & { kind: GeneratedKind };
const ASSET_MANIFEST = ALL_ASSETS.filter((spec): spec is GenSpec => spec.kind !== 'thumbnail');

const ROOT = process.cwd();
const PUBLIC_ASSETS = path.join(ROOT, 'public', 'assets');
const SOURCE_DIR = path.join(ROOT, 'art-src');
const LOG_FILE = path.join(SOURCE_DIR, 'log.jsonl');
const READY_FILE = path.join(PUBLIC_ASSETS, 'art-manifest.json');

/* --------------------------------- 설정 --------------------------------- */

interface KindConfig {
  /** API 에 요청할 크기 */
  size: '1024x1024' | '1536x1024';
  transparent: boolean;
  /** 최종 한 변 길이. 배경은 원본 크기를 그대로 쓴다 */
  finalSize: number | null;
}

const KIND_CONFIG: Record<GeneratedKind, KindConfig> = {
  icon: { size: '1024x1024', transparent: true, finalSize: 256 },
  particle: { size: '1024x1024', transparent: true, finalSize: 128 },
  texture: { size: '1024x1024', transparent: false, finalSize: 512 },
  background: { size: '1536x1024', transparent: false, finalSize: null },
};

/** 1024×1024 한 장 값 (USD). 공개된 값만 적는다. 1536×1024 는 약 1.5 배로 어림한다. */
const PRICE_1024: Record<string, Record<string, number>> = {
  'gpt-image-2': { low: 0.006, medium: 0.053, high: 0.211 },
};

/* --------------------------------- 인자 --------------------------------- */

const args = process.argv.slice(2);
function flag(name: string): boolean {
  return args.includes(`--${name}`);
}
function option(name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
}

const DRY = flag('dry');
const FORCE = flag('force');
const REPROCESS = flag('reprocess');
const ONLY = option('only')?.split(',').map((s) => s.trim()).filter(Boolean);
const ENGINE = option('engine') ?? 'codex';
const MODEL = option('model') ?? 'gpt-image-2';
const QUALITY = option('quality') ?? 'medium';
/** api: 분당 요청 수 (Tier 1 은 5). codex: 제한 없음 — 동시 실행 수로 조절한다 */
const IPM = ENGINE === 'api' ? Number(option('ipm') ?? 5) : Infinity;
/**
 * 동시에 기다리는 요청 수. 한 장에 1분 남짓 걸리므로 몇 개는 겹쳐 둔다.
 * codex 는 구독 사용량 한도가 있어 적게 둔다.
 */
const MAX_IN_FLIGHT = ENGINE === 'api' ? 4 : Number(option('parallel') ?? 2);

if (ENGINE !== 'codex' && ENGINE !== 'api') {
  console.error(`--engine 은 codex 또는 api 입니다 (받은 값: ${ENGINE})`);
  process.exit(1);
}

/* --------------------------------- 키 --------------------------------- */

function readApiKey(): string {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  for (const file of ['.env.local', '.env']) {
    const full = path.join(ROOT, file);
    if (!existsSync(full)) continue;
    const match = readFileSync(full, 'utf8').match(/^\s*OPENAI_API_KEY\s*=\s*(.*)$/m);
    const value = match?.[1]?.trim().replace(/^["']|["']$/g, '');
    if (value) return value;
  }
  throw new Error('.env.local 에 OPENAI_API_KEY 가 없습니다.');
}

/* ------------------------------- 목록 검사 ------------------------------- */

function checkPrompts(): void {
  const manifestKeys = new Set(ASSET_MANIFEST.map((a) => a.key));
  const missing = [...manifestKeys].filter((k) => !ART_PROMPTS[k]);
  const extra = Object.keys(ART_PROMPTS).filter((k) => !manifestKeys.has(k));
  if (missing.length || extra.length) {
    if (missing.length) console.error('프롬프트가 없는 키:', missing.join(', '));
    if (extra.length) console.error('매니페스트에 없는 프롬프트 키:', extra.join(', '));
    process.exit(1);
  }
  if (ONLY) {
    const unknown = ONLY.filter((k) => !manifestKeys.has(k));
    if (unknown.length) {
      console.error('없는 키:', unknown.join(', '));
      process.exit(1);
    }
  }
}

function outputPath(spec: AssetSpec): string {
  return path.join(PUBLIC_ASSETS, spec.path);
}

function sourcePath(spec: GenSpec): string {
  return path.join(SOURCE_DIR, `${spec.key}.png`);
}

function fullPrompt(spec: GenSpec): string {
  return KIND_PROMPT[spec.kind](ART_PROMPTS[spec.key]);
}

/* --------------------------------- 생성 --------------------------------- */

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ImageResponse {
  data?: { b64_json?: string }[];
  usage?: unknown;
  error?: { message?: string; code?: string };
}

function logGenerated(spec: GenSpec, prompt: string, extra: Record<string, unknown>): void {
  appendFileSync(
    LOG_FILE,
    JSON.stringify({ key: spec.key, at: new Date().toISOString(), engine: ENGINE, prompt, ...extra }) + '\n',
  );
}

/* ---- codex ---- */

const CODEX_WORK_DIR = path.join(SOURCE_DIR, '.codex-work');

async function generateViaCodex(codexBin: string, spec: GenSpec): Promise<Buffer> {
  const config = KIND_CONFIG[spec.kind];
  const result = await generateImageWithCodex(
    codexBin,
    {
      description: fullPrompt(spec),
      aspect: config.size === '1536x1024' ? 'landscape' : 'square',
      transparent: config.transparent,
    },
    CODEX_WORK_DIR,
  );
  logGenerated(spec, result.prompt, { thread: result.threadId, file: result.file });
  return result.image;
}

/* ---- api ---- */

async function generateViaApi(apiKey: string, spec: GenSpec): Promise<Buffer> {
  const config = KIND_CONFIG[spec.kind];
  const body = {
    model: MODEL,
    prompt: fullPrompt(spec),
    size: config.size,
    quality: QUALITY,
    background: config.transparent ? 'transparent' : 'opaque',
    output_format: 'png',
    n: 1,
  };

  for (let attempt = 1; ; attempt++) {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let json: ImageResponse = {};
    try {
      json = JSON.parse(text) as ImageResponse;
    } catch {
      // 프록시 오류 등 JSON 이 아닌 응답. 아래에서 재시도한다.
    }

    if (response.ok && json.data?.[0]?.b64_json) {
      logGenerated(spec, body.prompt, { model: MODEL, quality: QUALITY, size: config.size, usage: json.usage });
      return Buffer.from(json.data[0].b64_json, 'base64');
    }

    const retryable = response.status === 429 || response.status >= 500 || !text.startsWith('{');
    const reason = json.error?.message ?? `HTTP ${response.status}`;
    if (!retryable || attempt >= 5) throw new Error(reason);

    const retryAfter = Number(response.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 15_000 * attempt;
    console.warn(`  ${spec.key}: ${reason} — ${Math.round(waitMs / 1000)}초 뒤 다시 시도 (${attempt}/5)`);
    await sleep(waitMs);
  }
}

/* -------------------------------- 후처리 -------------------------------- */

/**
 * 반복 질감의 이음매를 없앤다.
 *
 * 생성 모델은 "이어지는 무늬"를 약속하지 못한다. 그래서 그림을 반만큼 민 사본을
 * 가장자리 근처에만 섞는다. 민 사본은 가장자리끼리 원래 이어져 있던 픽셀이라
 * 붙였을 때 끊기지 않고, 민 사본 자체의 이음매는 가운데에 있어 원본에 가려진다.
 * 가로를 먼저, 세로를 나중에 한다.
 */
async function processTexture(input: Buffer, finalSize: number): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .resize(finalSize, finalSize)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const n = info.width;
  const channels = info.channels;
  const band = n * 0.25;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const weight = (i: number) => smooth(Math.min(1, Math.min(i, n - 1 - i) / band));

  const blend = (source: Buffer, horizontal: boolean): Buffer => {
    const out = Buffer.alloc(source.length);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const w = weight(horizontal ? x : y);
        const sx = horizontal ? (x + n / 2) % n : x;
        const sy = horizontal ? y : (y + n / 2) % n;
        const i = (y * n + x) * channels;
        const j = (sy * n + sx) * channels;
        for (let c = 0; c < channels; c++) {
          out[i + c] = Math.round(w * source[i + c] + (1 - w) * source[j + c]);
        }
      }
    }
    return out;
  };

  const seamless = blend(blend(data, true), false);
  return sharp(seamless, { raw: { width: n, height: n, channels } }).png({ compressionLevel: 9 }).toBuffer();
}

async function processImage(spec: GenSpec, generated: Buffer): Promise<void> {
  const config = KIND_CONFIG[spec.kind];
  const adjust = ART_ADJUST[spec.key];
  const original = adjust ? await sharp(generated).modulate(adjust).png().toBuffer() : generated;
  let output: Buffer;
  if (spec.kind === 'icon' || spec.kind === 'particle') {
    output = await processSprite(original, config.finalSize!);
  } else if (spec.kind === 'texture') {
    output = await processTexture(original, config.finalSize!);
  } else {
    // codex 는 크기를 고정해 주지 않는다. 화면 배경 크기로 맞춘다.
    output = await sharp(original).resize(1536, 1024, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
  }
  const target = outputPath(spec);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, output);
}

/* ------------------------------ 준비 목록 ------------------------------ */

function updateReadyManifest(): number {
  const ready = ALL_ASSETS.filter((spec) => existsSync(outputPath(spec))).map((spec) => spec.key);
  writeFileSync(READY_FILE, JSON.stringify({ ready }, null, 2) + '\n');
  return ready.length;
}

/* --------------------------------- 실행 --------------------------------- */

function estimate(specs: GenSpec[]): string {
  if (ENGINE === 'codex') return 'Codex(ChatGPT 구독) 사용량에서 빠집니다. 따로 요금은 없습니다.';
  const prices = PRICE_1024[MODEL];
  const per = prices?.[QUALITY];
  if (per === undefined) return `${MODEL} / ${QUALITY} 의 공개 가격을 몰라 계산하지 않았습니다.`;
  const total = specs.reduce(
    (sum, spec) => sum + per * (KIND_CONFIG[spec.kind].size === '1536x1024' ? 1.5 : 1),
    0,
  );
  return `예상 비용 약 $${total.toFixed(2)} (${MODEL}, ${QUALITY})`;
}

async function main(): Promise<void> {
  checkPrompts();
  mkdirSync(SOURCE_DIR, { recursive: true });

  const selected = ASSET_MANIFEST.filter((spec) => !ONLY || ONLY.includes(spec.key));

  if (REPROCESS) {
    let count = 0;
    for (const spec of selected) {
      if (!existsSync(sourcePath(spec))) continue;
      await processImage(spec, readFileSync(sourcePath(spec)));
      count++;
    }
    console.log(`후처리 다시 함: ${count}장. 준비된 그림 ${updateReadyManifest()}/${ASSET_MANIFEST.length}`);
    return;
  }

  // 원본이 있으면 다시 사지 않고 후처리만 한다 (중간에 끊긴 경우 등)
  const todo: GenSpec[] = [];
  for (const spec of selected) {
    if (!FORCE && existsSync(outputPath(spec))) continue;
    if (!FORCE && existsSync(sourcePath(spec))) {
      await processImage(spec, readFileSync(sourcePath(spec)));
      continue;
    }
    todo.push(spec);
  }

  const byKind = todo.reduce<Record<string, number>>((acc, spec) => {
    acc[spec.kind] = (acc[spec.kind] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`만들 그림 ${todo.length}장 ${JSON.stringify(byKind)}`);
  console.log(estimate(todo));
  const minutes =
    ENGINE === 'api' ? Math.ceil(todo.length / IPM) : Math.ceil((todo.length * 1.5) / MAX_IN_FLIGHT);
  console.log(`약 ${minutes}분 이상 걸립니다.`);

  if (DRY) {
    for (const spec of todo) console.log(`  ${spec.kind.padEnd(10)} ${spec.key}`);
    return;
  }
  if (todo.length === 0) {
    console.log(`준비된 그림 ${updateReadyManifest()}/${ASSET_MANIFEST.length}`);
    return;
  }

  let generate: (spec: GenSpec) => Promise<Buffer>;
  if (ENGINE === 'api') {
    const apiKey = readApiKey();
    generate = (spec) => generateViaApi(apiKey, spec);
  } else {
    const codexBin = findCodex();
    console.log(`codex: ${codexBin}`);
    generate = (spec) => generateViaCodex(codexBin, spec);
  }

  const interval = Number.isFinite(IPM) ? 60_000 / IPM : 0;
  const failures: string[] = [];
  let done = 0;
  let nextStart = Date.now();
  const inFlight = new Set<Promise<void>>();

  for (const spec of todo) {
    while (inFlight.size >= MAX_IN_FLIGHT) await Promise.race(inFlight);
    const wait = nextStart - Date.now();
    if (wait > 0) await sleep(wait);
    nextStart = Date.now() + interval;

    const job = (async () => {
      try {
        const original = await generate(spec);
        writeFileSync(sourcePath(spec), original);
        await processImage(spec, original);
        // 중간에 끊겨도 그때까지 만든 그림은 게임에 바로 보이게 한 장마다 갱신한다
        updateReadyManifest();
        done++;
        console.log(`[${done + failures.length}/${todo.length}] ${spec.key}`);
      } catch (error) {
        failures.push(spec.key);
        console.error(`[${done + failures.length}/${todo.length}] ${spec.key} 실패: ${(error as Error).message}`);
      }
    })();
    inFlight.add(job);
    void job.finally(() => inFlight.delete(job));
  }
  await Promise.all(inFlight);

  const readyCount = updateReadyManifest();
  console.log(`\n완료 ${done}장, 실패 ${failures.length}장. 준비된 그림 ${readyCount}/${ASSET_MANIFEST.length}`);
  if (failures.length) {
    console.log(`실패한 것만 다시: npm run art -- --only ${failures.join(',')}`);
    process.exitCode = 1;
  }
}

void main();
