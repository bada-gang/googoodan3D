/**
 * 발밑 동그란 그림자. 집 안 · 마굿간에서 캐릭터의 실시간 그림자 대신 쓴다 (사용자 요청).
 * 실내에는 실시간으로 그림자를 드리우는 것이 캐릭터뿐이라, 이걸로 바꾸면 해의 그림자 그리기를 통째로 끌 수 있다
 * (rendering/lighting 의 Sun: 실내에서는 castShadow 끔 — 그림자 지도 그리기와 바닥의 그림자 계산이 없어진다).
 * 가구 · 마굿간 물건 그림자는 바닥에 미리 구운 그대로다 (rendering/bakedShadows).
 */
import { CanvasTexture, SRGBColorSpace } from 'three';

/** 지름 (m) */
const SIZE = 0.95;
const OPACITY = 0.32;

let texture: CanvasTexture | null = null;

/** 가운데가 진하고 가장자리로 갈수록 사라지는 동그라미. 한 번만 만들어 같이 쓴다 */
function blobTexture(): CanvasTexture {
  if (texture) return texture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d')!;
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0,0,0,1)');
  gradient.addColorStop(0.55, 'rgba(0,0,0,0.75)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function BlobShadow(): React.ReactElement {
  return (
    // 바닥에서 아주 살짝 띄운다 (바닥과 겹쳐 깜박이지 않게)
    <mesh rotation-x={-Math.PI / 2} position-y={0.015} renderOrder={1}>
      <planeGeometry args={[SIZE, SIZE]} />
      <meshBasicMaterial map={blobTexture()} color="#2a1a10" transparent opacity={OPACITY} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
