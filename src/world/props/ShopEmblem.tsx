/**
 * 가게 건물의 둥근 간판 그림을 선명하게 덧대는 판.
 *
 * 가게 모델은 질감 한 장(1024px)에 건물 전체가 들어 있어서, 간판 그림(새싹 · 의자)은 그중 작은 조각이라 흐리다.
 * 모델을 다시 만들면 건물 모양까지 바뀌므로, 같은 자리에 캔버스로 그린 판을 살짝 띄워 붙인다.
 * 테두리 · 바탕 색은 원래 간판과 맞췄다.
 */
import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { PALETTE } from '@/config/artTokens';

export type EmblemPicture = 'sprout' | 'chair';

const SIZE = 512;
const OUTLINE = PALETTE.outline;

function drawSprout(ctx: CanvasRenderingContext2D): void {
  const c = SIZE / 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = OUTLINE;
  // 흙 둔덕
  ctx.fillStyle = PALETTE.soil;
  ctx.beginPath();
  ctx.ellipse(c, c + 118, 118, 46, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 줄기
  ctx.strokeStyle = PALETTE.leafShade;
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(c, c + 80);
  ctx.quadraticCurveTo(c - 6, c + 10, c, c - 30);
  ctx.stroke();
  // 잎 두 장 (안쪽 잎맥까지)
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(c + side * 6, c - 30);
    ctx.rotate(side * -0.55);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(side * 40, -80, side * 150, -70, side * 160, 0);
    ctx.bezierCurveTo(side * 150, 50, side * 40, 50, 0, 0);
    ctx.closePath();
    ctx.fillStyle = PALETTE.leaf;
    ctx.fill();
    ctx.lineWidth = 14;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(side * 18, 0);
    ctx.quadraticCurveTo(side * 80, -12, side * 130, 0);
    ctx.lineWidth = 9;
    ctx.strokeStyle = PALETTE.leafShade;
    ctx.stroke();
    ctx.restore();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.stroke();
}

function drawChair(ctx: CanvasRenderingContext2D): void {
  const c = SIZE / 2;
  const red = '#e0574c';
  const redShade = '#b9433b';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = OUTLINE;
  // 다리
  ctx.fillStyle = PALETTE.woodDark;
  roundRect(ctx, c - 108, c + 92, 30, 50, 8);
  roundRect(ctx, c + 78, c + 92, 30, 50, 8);
  // 등받이
  ctx.fillStyle = red;
  roundRect(ctx, c - 100, c - 140, 200, 170, 60);
  // 방석
  ctx.fillStyle = redShade;
  roundRect(ctx, c - 112, c + 20, 224, 84, 30);
  // 팔걸이
  ctx.fillStyle = red;
  roundRect(ctx, c - 150, c - 40, 66, 146, 33);
  roundRect(ctx, c + 84, c - 40, 66, 146, 33);
  // 등받이 단추 (폭신한 느낌)
  ctx.fillStyle = redShade;
  for (const x of [-40, 40]) {
    ctx.beginPath();
    ctx.arc(c + x, c - 62, 11, 0, Math.PI * 2);
    ctx.fill();
  }
}

function emblemTexture(picture: EmblemPicture): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  // 원 바깥도 테두리색으로 채운다 (투명하게 두면 가장자리 거름에서 검은 테가 생긴다)
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const c = SIZE / 2;
  // 나무 테두리 → 크림색 바탕
  ctx.beginPath();
  ctx.arc(c, c, c - 6, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.wood;
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, c - 58, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.cream;
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.stroke();

  ctx.save();
  // 그림은 바탕 안쪽을 거의 채우게
  ctx.translate(c, c);
  ctx.scale(0.95, 0.95);
  ctx.translate(-c, -c);
  if (picture === 'sprout') {
    // 새싹은 그림 자체가 작아 조금 더 키운다 (잎이 테두리에 닿지 않을 만큼)
    ctx.translate(c, c);
    ctx.scale(1.08, 1.08);
    ctx.translate(-c, -c);
    drawSprout(ctx);
  }
  else drawChair(ctx);
  ctx.restore();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** 둥근 간판판. 놓는 자리는 가게 모델을 재서 맞춘다 (TownWorld 의 SHOP_EMBLEMS) */
export function ShopEmblem({ picture, radius }: { picture: EmblemPicture; radius: number }): React.ReactElement {
  const texture = useMemo(() => emblemTexture(picture), [picture]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh>
      <circleGeometry args={[radius, 48]} />
      <meshStandardMaterial map={texture} roughness={0.85} />
    </mesh>
  );
}
