/**
 * 밭 열두 칸의 흙과 나무 테두리. 칸마다 그리면 24번이라, 흙끼리 · 테두리끼리 모양 하나로 합쳐 2번에 그린다.
 * 움직이지 않아 그림자를 미리 그려 두고(rendering/bakedShadows), 나무 그림자는 흙 위에 지도록 그림자를 받는다.
 */
import { useEffect, useMemo } from 'react';
import { ASSETS } from '@/config/assets';
import { PALETTE } from '@/config/artTokens';
import { PLOT_COUNT, YARD, plotPosition } from '@/config/layout';
import { ArtTexture } from '../../../rendering/assets';
import { StaticShadow } from '../../../rendering/bakedShadows';
import { mergedBoxGeometry, type BoxSpec } from '../../../props/mergedBoxes';
import { PLOT_HEIGHT } from './farmShared';

export function PlotBeds(): React.ReactElement {
  const { soil, border } = useMemo(() => {
    const size = YARD.farm.plotSize;
    const y = PLOT_HEIGHT / 2 + 0.04;
    const h = PLOT_HEIGHT + 0.08;
    const soilBoxes: BoxSpec[] = [];
    const borderBoxes: BoxSpec[] = [];
    for (let i = 0; i < PLOT_COUNT; i += 1) {
      const { x, z } = plotPosition(i);
      soilBoxes.push({ x, y: PLOT_HEIGHT / 2, z, w: size, h: PLOT_HEIGHT, d: size });
      borderBoxes.push(
        { x, y, z: z + size / 2, w: size + 0.16, h, d: 0.16 },
        { x, y, z: z - size / 2, w: size + 0.16, h, d: 0.16 },
        { x: x + size / 2, y, z, w: 0.16, h, d: size },
        { x: x - size / 2, y, z, w: 0.16, h, d: size },
      );
    }
    return { soil: mergedBoxGeometry(soilBoxes), border: mergedBoxGeometry(borderBoxes) };
  }, []);
  useEffect(
    () => () => {
      soil.dispose();
      border.dispose();
    },
    [soil, border],
  );

  return (
    <StaticShadow receive>
      <mesh geometry={soil} receiveShadow castShadow>
        <ArtTexture assetKey={ASSETS.textures.soil} repeat={[1, 1]}>
          {(map) => <meshStandardMaterial map={map} color={map ? '#ffffff' : PALETTE.soil} roughness={1} />}
        </ArtTexture>
      </mesh>
      <mesh geometry={border} castShadow receiveShadow>
        <meshStandardMaterial color={PALETTE.wood} roughness={0.9} />
      </mesh>
    </StaticShadow>
  );
}
