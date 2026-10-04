/**
 * 투명 배경 아이콘 후처리. 이미지 생성(gen-art)과 3D 모델 원본 그림 아이콘(gen-model)이 함께 쓴다.
 */
import sharp from 'sharp';

/**
 * 투명 배경이 안 나온 경우(투명 배경은 아직 미리보기 기능이다) 가장자리에서 이어진
 * 배경색을 지운다. 네 모서리 평균색과 가까운 픽셀을 테두리부터 채우기로 찾는다.
 */
async function removeFlatBackground(input: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const at = (x: number, y: number) => (y * width + x) * 4;

  const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
  const ref = [0, 1, 2].map((c) => corners.reduce((sum, i) => sum + data[i + c], 0) / corners.length);
  const distance = (i: number) =>
    Math.hypot(data[i] - ref[0], data[i + 1] - ref[1], data[i + 2] - ref[2]);

  const TOLERANCE = 42;
  const removed = new Uint8Array(width * height);
  const queue: number[] = [];
  const visit = (x: number, y: number) => {
    const p = y * width + x;
    if (removed[p] || distance(p * 4) > TOLERANCE) return;
    removed[p] = 1;
    queue.push(p);
  };
  for (let x = 0; x < width; x++) {
    visit(x, 0);
    visit(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    visit(0, y);
    visit(width - 1, y);
  }
  while (queue.length) {
    const p = queue.pop()!;
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) visit(x - 1, y);
    if (x < width - 1) visit(x + 1, y);
    if (y > 0) visit(x, y - 1);
    if (y < height - 1) visit(x, y + 1);
  }

  for (let p = 0; p < width * height; p++) {
    if (removed[p]) data[p * 4 + 3] = 0;
  }
  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function isOpaque(input: Buffer): Promise<boolean> {
  // 투명 채널이 아예 없는 그림(3D 모델 원본 그림 등)은 통계에 4번째 채널이 없다
  const { hasAlpha } = await sharp(input).metadata();
  if (!hasAlpha) return true;
  const stats = await sharp(input).stats();
  return stats.channels[3].min === 255;
}

/** 투명 배경 그림을 여백만 다듬어 가운데 정사각형에 놓는다 */
export async function processSprite(input: Buffer, finalSize: number): Promise<Buffer> {
  let source = input;
  if (await isOpaque(source)) {
    console.warn('    투명 배경이 아니라서 배경을 직접 지웁니다. 결과를 눈으로 확인하세요.');
    source = await removeFlatBackground(source);
  }
  const trimmed = await sharp(source).trim({ threshold: 4 }).png().toBuffer();
  // 가장자리에 조금 여유를 둔다. 둥근 버튼 안에서 그림이 테두리에 닿지 않게.
  const inner = Math.round(finalSize * 0.9);
  const resized = await sharp(trimmed)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({
    create: { width: finalSize, height: finalSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

