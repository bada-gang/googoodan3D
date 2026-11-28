/**
 * 창밖 풍경 그림: 창 자리에 판 하나를 놓고 풍경 그림을 입힌다 (집 안 창 · 마굿간 다락 창).
 * 그림 비율이 창과 달라도 찌그러지지 않게 가운데를 잘라 채운다 (cover).
 * 낮에는 그림 그대로, 노을 · 밤에는 바깥 하늘색 쪽으로 어두워진다 (rendering/dayNight).
 * 빛을 받지 않는 재질이라 방이 어두워도 창은 바깥 밝기를 따른다.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, PlaneGeometry, type MeshBasicMaterial } from 'three';
import { ArtTexture } from '../rendering/assets';
import { daylight } from '../rendering/dayNight';

/** 생성 풍경 그림의 가로:세로 (1536×1024) */
const IMAGE_ASPECT = 1.5;
/** 낮에도 아주 조금만 눌러 방 안 물건보다 튀지 않게 */
const DAY_TINT = new Color('#f4f4f4');

export function WindowView({
  assetKey,
  width,
  height,
  position,
  fallbackColor,
}: {
  assetKey: string;
  width: number;
  height: number;
  position: [number, number, number];
  /** 그림을 아직 못 불러왔을 때의 창 색 */
  fallbackColor: string;
}): React.ReactElement {
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(width, height);
    // 그림 가운데를 창 비율로 잘라 쓴다
    const aspect = width / height;
    const [su, sv] = aspect < IMAGE_ASPECT ? [aspect / IMAGE_ASPECT, 1] : [1, IMAGE_ASPECT / aspect];
    const uv = plane.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + (uv.getX(i) - 0.5) * su, 0.5 + (uv.getY(i) - 0.5) * sv);
    return plane;
  }, [width, height]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useRef<MeshBasicMaterial>(null);
  useFrame(() => {
    if (!material.current?.map) return;
    material.current.color.copy(DAY_TINT).lerp(daylight.sky, Math.min(1, daylight.darkness * 1.1));
  });

  return (
    <mesh geometry={geometry} position={position}>
      <ArtTexture assetKey={assetKey}>
        {(map) => <meshBasicMaterial ref={material} map={map} color={map ? DAY_TINT : fallbackColor} toneMapped={false} />}
      </ArtTexture>
    </mesh>
  );
}
