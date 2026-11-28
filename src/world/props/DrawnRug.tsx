/**
 * 코드로 그린 카펫. 카펫은 납작해서 3D 모델로 바꾸면 무늬가 뭉개진다
 * (포근한 카펫의 하트가 동그란 얼룩 셋이 되고, 알록달록 카펫의 무지개 줄무늬가 조각보가 됐다).
 * 그래서 바닥에 얇은 판을 깔고, 가게 그림(아이콘)과 같은 무늬를 캔버스에 직접 그려 입힌다. 새 그림 없음.
 *
 * 여기 있는 카펫은 꾸미기(gameplay/decorate)가 3D 모델 대신 이것을 그린다 (DRAWN_RUGS).
 */
import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';

interface RugStyle {
  /** 바닥에 깔리는 크기 (m): 가로(x) · 세로(z) */
  width: number;
  depth: number;
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void;
}

/** 둥근 모서리 네모 길 */
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** 하트 (가운데 cx, cy, 너비 size) */
function heart(g: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const s = size / 2;
  g.beginPath();
  g.moveTo(cx, cy + s * 0.95);
  g.bezierCurveTo(cx - s * 1.25, cy + s * 0.1, cx - s * 0.95, cy - s * 0.95, cx, cy - s * 0.42);
  g.bezierCurveTo(cx + s * 0.95, cy - s * 0.95, cx + s * 1.25, cy + s * 0.1, cx, cy + s * 0.95);
  g.closePath();
}

export const DRAWN_RUGS: Record<string, RugStyle> = {
  // 포근한 카펫: 코랄 바탕 · 크림 테두리 띠 · 가운데 크림 하트 (가게 그림과 같다)
  carpet_cozy: {
    width: 2.2,
    depth: 1.55,
    draw: (g, w, h) => {
      roundRect(g, 4, 4, w - 8, h - 8, 40);
      g.fillStyle = '#dc6a55';
      g.fill();
      const inset = 34;
      roundRect(g, inset, inset, w - inset * 2, h - inset * 2, 24);
      g.lineWidth = 22;
      g.strokeStyle = '#f7dcc2';
      g.stroke();
      g.fillStyle = '#f7dcc2';
      heart(g, w / 2, h / 2, h * 0.36);
      g.fill();
    },
  },
  // 알록달록 카펫: 민트 물결 테두리 안에 무지개 줄무늬 (가게 그림과 같다)
  carpet_colorful: {
    width: 2.2,
    depth: 1.55,
    draw: (g, w, h) => {
      const bump = 22;
      // 물결 테두리: 둘레를 따라 동그라미를 잇는다
      g.fillStyle = '#8fd8c4';
      roundRect(g, bump, bump, w - bump * 2, h - bump * 2, 30);
      g.fill();
      for (let x = bump; x <= w - bump; x += bump * 1.6) {
        for (const y of [bump, h - bump]) {
          g.beginPath();
          g.arc(x, y, bump, 0, Math.PI * 2);
          g.fill();
        }
      }
      for (let y = bump; y <= h - bump; y += bump * 1.6) {
        for (const x of [bump, w - bump]) {
          g.beginPath();
          g.arc(x, y, bump, 0, Math.PI * 2);
          g.fill();
        }
      }
      // 무지개 줄무늬
      const colors = ['#f2756a', '#f6a85c', '#f6d24a', '#8ed486', '#7fb8e6', '#a58be0'];
      const x0 = bump * 2.2;
      const y0 = bump * 2.2;
      const innerW = w - x0 * 2;
      const innerH = h - y0 * 2;
      g.save();
      roundRect(g, x0, y0, innerW, innerH, 18);
      g.clip();
      colors.forEach((color, i) => {
        g.fillStyle = color;
        g.fillRect(x0, y0 + (innerH / colors.length) * i, innerW, innerH / colors.length + 1);
      });
      g.restore();
    },
  },
};

export function DrawnRug({
  itemId,
  ghost = false,
  tint = '#ffffff',
}: {
  itemId: string;
  /** 꾸미기 미리보기: 반투명, 놓을 수 없는 자리면 붉게 */
  ghost?: boolean;
  tint?: string;
}): React.ReactElement | null {
  const style = DRAWN_RUGS[itemId];
  const texture = useMemo(() => {
    if (!style) return null;
    const w = 512;
    const h = Math.round((w * style.depth) / style.width);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    style.draw(canvas.getContext('2d')!, w, h);
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, [style]);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!style || !texture) return null;
  return (
    // 바닥에서 아주 살짝 띄운 판 (바닥과 겹쳐 깜박이지 않게). 둥근 모서리는 그림의 투명한 곳으로
    <mesh rotation-x={-Math.PI / 2} position-y={0.012} receiveShadow={!ghost}>
      <planeGeometry args={[style.width, style.depth]} />
      <meshStandardMaterial
        map={texture}
        color={ghost ? tint : '#ffffff'}
        transparent={ghost}
        opacity={ghost ? 0.6 : 1}
        alphaTest={ghost ? 0 : 0.5}
        depthWrite={!ghost}
        roughness={0.95}
        polygonOffset
        polygonOffsetFactor={-1}
      />
    </mesh>
  );
}
