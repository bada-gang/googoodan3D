/**
 * 무늬 벽지 · 바닥(구름 · 하트 · 딸기 · 별처럼 바탕에 무늬가 흩어진 질감)을 다시 짠다.
 *
 * 보통 질감은 반만큼 민 사본을 가장자리에 섞어 이음매를 없애는데(gen-art processTexture),
 * 무늬가 흩어진 그림에서는 섞인 자리에 무늬가 반투명 유령처럼 하나 더 생긴다 (사용자: "투명한 딸기").
 * 그래서 생성 그림에서 또렷한 무늬만 오려 내어, 같은 바탕색 위에 정해진 개수만큼 엇갈린 줄로 다시 놓는다.
 * 가장자리를 넘는 무늬는 반대쪽으로 이어 그려 이음매가 없다. 개수로 촘촘함을 정확히 정한다.
 */
import sharp from 'sharp';

export interface MotifLayout {
  /** 한 줄에 놓을 무늬 수 */
  cols: number;
  /** 줄 수. 짝수면 한 줄씩 반 칸 엇갈리고, 홀수면 줄마다 1/줄수 칸씩 밀려 비스듬히 이어진다 (어느 쪽이든 이음매 없음) */
  rows: number;
}

interface Motif {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** 바탕과 이만큼 다르면 무늬 (0~255, 세 색의 차이 중 가장 큰 값) */
const MASK_THRESHOLD = 24;
/** 무늬 가장자리를 바탕에 부드럽게 섞는 범위 */
const ALPHA_FROM = 8;
const ALPHA_TO = 40;

export async function rebuildMotifPattern(input: Buffer, size: number, layout: MotifLayout): Promise<Buffer> {
  const { data } = await sharp(input).resize(size, size).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = size;
  const px = (x: number, y: number) => (y * n + x) * 3;

  // 바탕색: 가장 많은 색 (세 색 각각의 중앙값)
  const background = [0, 1, 2].map((c) => {
    const histogram = new Array(256).fill(0);
    for (let i = c; i < data.length; i += 3) histogram[data[i]]++;
    let seen = 0;
    for (let v = 0; v < 256; v++) {
      seen += histogram[v];
      if (seen >= n * n / 2) return v;
    }
    return 255;
  });
  const diff = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) {
    diff[i] = Math.max(
      Math.abs(data[i * 3] - background[0]),
      Math.abs(data[i * 3 + 1] - background[1]),
      Math.abs(data[i * 3 + 2] - background[2]),
    );
  }

  // 무늬 덩어리 찾기 (8방향으로 이어진 무늬 픽셀)
  const label = new Int32Array(n * n).fill(-1);
  const found: (Motif & { area: number; strength: number; edge: boolean })[] = [];
  for (let start = 0; start < n * n; start++) {
    if (label[start] >= 0 || diff[start] < MASK_THRESHOLD) continue;
    const id = found.length;
    const queue = [start];
    label[start] = id;
    const blob = { x0: n, y0: n, x1: 0, y1: 0, area: 0, strength: 0, edge: false };
    while (queue.length) {
      const i = queue.pop()!;
      const x = i % n;
      const y = (i - x) / n;
      blob.area++;
      blob.strength += diff[i];
      blob.x0 = Math.min(blob.x0, x);
      blob.y0 = Math.min(blob.y0, y);
      blob.x1 = Math.max(blob.x1, x);
      blob.y1 = Math.max(blob.y1, y);
      if (x === 0 || y === 0 || x === n - 1 || y === n - 1) blob.edge = true;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
          const j = ny * n + nx;
          if (label[j] < 0 && diff[j] >= MASK_THRESHOLD) {
            label[j] = id;
            queue.push(j);
          }
        }
      }
    }
    blob.strength /= blob.area;
    found.push(blob);
  }

  // 가장자리에 걸린 것(잘린 무늬) · 너무 작은 것 · 흐린 것(유령 무늬)은 뺀다
  const minArea = n * n * 0.0006;
  const whole = found.filter((b) => !b.edge && b.area >= minArea);
  const strongest = Math.max(0, ...whole.map((b) => b.strength));
  const motifs: Motif[] = whole.filter((b) => b.strength >= strongest * 0.7);
  if (motifs.length === 0) throw new Error('무늬를 찾지 못했다 (바탕과 무늬 색이 비슷한지 확인)');

  // 바탕 위에 엇갈린 줄로 다시 놓는다
  const out = Buffer.alloc(n * n * 3);
  for (let i = 0; i < n * n; i++) out.set(background, i * 3);
  const cellW = n / layout.cols;
  const cellH = n / layout.rows;
  let seed = 11;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  let pick = 0;
  for (let r = 0; r < layout.rows; r++) {
    for (let c = 0; c < layout.cols; c++) {
      const motif = motifs[pick++ % motifs.length];
      // 조금씩 흔들어 너무 반듯해 보이지 않게
      const shift = layout.rows % 2 === 0 ? (r % 2) * 0.5 : r / layout.rows;
      const cx = (c + 0.5 + shift + (random() - 0.5) * 0.2) * cellW;
      const cy = (r + 0.5 + (random() - 0.5) * 0.2) * cellH;
      const pad = 3;
      const mx0 = Math.max(0, motif.x0 - pad);
      const my0 = Math.max(0, motif.y0 - pad);
      const mx1 = Math.min(n - 1, motif.x1 + pad);
      const my1 = Math.min(n - 1, motif.y1 + pad);
      const offsetX = Math.round(cx - (motif.x0 + motif.x1) / 2);
      const offsetY = Math.round(cy - (motif.y0 + motif.y1) / 2);
      for (let y = my0; y <= my1; y++) {
        for (let x = mx0; x <= mx1; x++) {
          const a = Math.min(1, Math.max(0, (diff[y * n + x] - ALPHA_FROM) / (ALPHA_TO - ALPHA_FROM)));
          if (a <= 0) continue;
          const tx = (((x + offsetX) % n) + n) % n;
          const ty = (((y + offsetY) % n) + n) % n;
          const s = px(x, y);
          const t = px(tx, ty);
          for (let k = 0; k < 3; k++) out[t + k] = Math.round(out[t + k] * (1 - a) + data[s + k] * a);
        }
      }
    }
  }
  return sharp(out, { raw: { width: n, height: n, channels: 3 } }).png({ compressionLevel: 9 }).toBuffer();
}
