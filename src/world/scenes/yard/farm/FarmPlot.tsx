/**
 * 밭 한 칸: 땅 높이 · 부딪힘 · 안내 버튼(farmActions) · 나무(Tree) · 열매(Fruits)를 묶는다.
 * 흙과 테두리는 여섯 칸을 한 번에 그린다 (PlotBeds).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { YARD, plotPosition } from '@/config/layout';
import { useGameStore } from '@/state/gameStore';
import type { TreeSpeciesId } from '@/types/game';
import { useInteractable } from '../../../systems/interaction';
import { obstacles, raisedAreas } from '../../../state/runtime';
import { PLOT_HEIGHT, TREE_RADIUS } from './farmShared';
import { handlePlotAction, plotPrompts } from './farmActions';
import { FALLBACK_CROWN, FLY_SECONDS, FlyingFruits } from './Fruits';
import { Tree, type Crown } from './Tree';

export function FarmPlot({ index }: { index: number }): React.ReactElement {
  const plotId = `plot_${index}`;
  const plot = useGameStore((s) => s.plots.find((p) => p.id === plotId));
  const { x, z } = plotPosition(index);
  const size = YARD.farm.plotSize;

  useInteractable({
    id: plotId,
    position: () => ({ x, z }),
    range: size / 2 + 0.9,
    prompts: () => plotPrompts(plotId),
    onAction: (actionId) => handlePlotAction(plotId, actionId),
  });

  // 수확하면 나무에서 열매가 사라지는 대신 캐릭터에게 날아간다.
  // 마지막 수확이면 나무도 사라지므로, 날아가는 열매는 나무가 아니라 밭이 그린다.
  const crown = useRef<Crown | null>(null);
  const onCrown = useCallback((measured: Crown | null) => {
    if (measured) crown.current = measured;
  }, []);
  const [flying, setFlying] = useState<{ species: TreeSpeciesId; startedAt: number } | null>(null);
  const previous = useRef(plot);
  useEffect(() => {
    const before = previous.current;
    previous.current = plot;
    const wasFruiting = !!before?.species && before.stage === 'fruiting';
    const stillFruiting = plot?.species === before?.species && plot?.stage === 'fruiting';
    if (!wasFruiting || stillFruiting || !before?.species) return;
    const startedAt = performance.now();
    setFlying({ species: before.species, startedAt });
    window.setTimeout(() => setFlying((f) => (f?.startedAt === startedAt ? null : f)), FLY_SECONDS * 1000 + 600);
  }, [plot]);

  // 흙 위에 올라선다 (나무 테두리까지)
  useEffect(() => {
    const key = `plot_${plotId}`;
    const half = size / 2 + 0.08;
    raisedAreas.set(key, { minX: x - half, maxX: x + half, minZ: z - half, maxZ: z + half, height: PLOT_HEIGHT });
    return () => {
      raisedAreas.delete(key);
    };
  }, [plotId, size, x, z]);

  // 묘목부터는 나무에 부딪힌다
  const blocking = !!plot?.species && (plot.stage === 'sapling' || plot.stage === 'mature' || plot.stage === 'fruiting');
  useEffect(() => {
    if (!blocking) return;
    const key = `tree_${plotId}`;
    obstacles.set(key, { kind: 'circle', x, z, radius: TREE_RADIUS });
    return () => {
      obstacles.delete(key);
    };
  }, [blocking, plotId, x, z]);

  return (
    <>
      <group position={[x, 0, z]}>
        {/* 흙과 나무 테두리는 밭 여섯 칸을 한 번에 그린다 (PlotBeds) */}
        {plot?.species && <Tree species={plot.species} stage={plot.stage} onCrown={onCrown} />}
        {flying && (
          <FlyingFruits
            key={flying.startedAt}
            species={flying.species}
            crown={crown.current ?? FALLBACK_CROWN}
            plot={{ x, z }}
            startedAt={flying.startedAt}
          />
        )}
      </group>
    </>
  );
}
