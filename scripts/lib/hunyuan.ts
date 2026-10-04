/**
 * Hunyuan3D 2.1 API 서버로 그림 한 장을 3D 모델(GLB)로 바꾼다.
 * 서버는 F:\ai\hunyuan21\run-googoo-api.bat 로 먼저 켠다 (기본 http://127.0.0.1:7960).
 */
import http from 'node:http';
import sharp from 'sharp';

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

/** 서버가 안 켜져 있으면 안내하고 끝낸다 */
export async function checkServer(server: string): Promise<void> {
  try {
    const { status } = await request('GET', `${server}/ping`);
    if (status === 200) return;
  } catch {
    // 아래에서 안내한다
  }
  console.error(`3D 변환 서버(${server})에 연결하지 못했습니다.`);
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
function serverSimplifyRatio(targetTriangles: number): number {
  const target = targetTriangles * 1.5;
  return Math.min(0.5, Math.max(0.002, target / RAW_FACES_ESTIMATE));
}

/** 그림(PNG 등)을 3D 모델로 바꿔 GLB 를 돌려준다. targetTriangles 는 경량화 목표 면 수 */
export async function convertImageTo3D(server: string, image: Buffer, targetTriangles: number): Promise<Buffer> {
  // 서버는 투명 배경을 검정으로 바꾼다. 흰 바탕에 얹어 보낸다.
  const png = await sharp(image)
    .flatten({ background: '#ffffff' })
    .resize(1024, 1024, { fit: 'contain', background: '#ffffff' })
    .png()
    .toBuffer();

  const body = JSON.stringify({
    single_multi_img_input: ['data:image/png;base64,' + png.toString('base64')],
    generate_what: 'make_meshes_and_tex',
    apply_texture: true,
    seed: 1234,
    num_inference_steps: 20,
    octree_resolution: OCTREE_RESOLUTION,
    // 1 이하는 비율로 받는다 (1 보다 크면 % 로 읽는다)
    mesh_simplify: serverSimplifyRatio(targetTriangles),
    texture_size: 1024,
    output_format: 'glb',
  });
  const generated = await request('POST', `${server}/generate`, body);
  if (generated.status !== 200) {
    throw new Error(`변환 실패 (HTTP ${generated.status}): ${generated.data.toString().slice(0, 300)}`);
  }
  const model = await request('GET', `${server}/download/model`);
  if (model.status !== 200) throw new Error(`결과 파일을 받지 못했습니다 (HTTP ${model.status})`);
  return model.data;
}
