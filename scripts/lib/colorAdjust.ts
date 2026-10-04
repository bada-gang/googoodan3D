/** 모델 색 질감 보정 (models.ts 의 color). */
import type { Document } from '@gltf-transform/core';
import sharp from 'sharp';
import type { ModelSpec } from '@/config/models';

/**
 * 색 질감의 밝기 · 채도를 바꾼다. 배율 1 이 그대로.
 * warmHue 를 주면 빨강~노랑 사이의 색(껍질)을 모두 그 색조로 맞추고 선명하게 한다. 초록 잎은 그대로.
 * 3D 변환이 색을 칙칙하거나 얼룩지게 굽는 일이 있어서다 (오렌지가 배처럼 노랗고 아래만 붉었다).
 */
export async function adjustColor(document: Document, color: NonNullable<ModelSpec['color']>): Promise<void> {
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
