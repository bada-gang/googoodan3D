/**
 * 마굿간 안. 동물 우리의 헛간 문으로 들어온다 (yard/pen/AnimalPen 의 '마굿간 들어가기').
 * 지금은 장식만 있고 상호작용은 나가기뿐이다.
 *
 * - 집 안처럼 카메라를 고정하고(BARN_VIEW) 앞벽 없이 들여다본다.
 * - 출입구는 화면 아래 가운데(6시 방향). 들어오면 아래에서 위(안쪽)를 보고 선다.
 * - 약간 어둡게 (rendering/lighting 의 마굿간 빛 배율). 창 · 판자 틈만 밝다.
 * - 가볍게 (그리기 호출 30번대): 햇빛 줄기 · 먼지 · 바닥 빛은 뺐다 (사용자 요청).
 *   물건 · 칸막이 · 사다리 · 문짝 그림자는 들어올 때 한 번만 그려 바닥 그림에 굽는다 (rendering/bakedShadows,
 *   그 뒤로는 그림자 그리기 호출이 없다). 실시간 그림자는 캐릭터만.
 *
 * 파일:
 *   barnLayout.ts      크기 · 카메라 · 물건 자리 · 부딪힘 · 색 · 그림자 범위 (숫자는 여기서)
 *   BarnStructure.tsx  바닥 · 벽 · 기둥 · 입구 문짝 · 칸막이 · 다락 · 사다리 (같은 색 상자는 한 모양으로 합친다)
 *   BarnProps.tsx      건초 · 도구 걸이 · 손수레 등 3D 모델 물건과 등불
 */
import { useEffect } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useInteractable } from '../../systems/interaction';
import { placePlayer } from '../../systems/movement';
import { input, obstacles, walkBounds } from '../../state/runtime';
import { goToScene, useWorldScene } from '../../state/scenes';
import { BARN } from '../yard/pen/penLayout';
import { BARN_OBSTACLES, ENTRANCE, FRONT_Z, SPAWN, WALK_BOUNDS } from './barnLayout';
import { Entrance, Floor, Frame, Ladder, Walls, Woodwork } from './BarnStructure';
import { BarnProps, Lanterns } from './BarnProps';
import { BakedShadows, StaticShadow } from '../../rendering/bakedShadows';
import { BARN_SHADOW, BARN_SHADOW_BOUNDS } from './barnLayout';

export { BARN_VIEW } from './barnLayout';

export function BarnWorld(): React.ReactElement {
  useEffect(() => {
    Object.assign(walkBounds, WALK_BOUNDS);
    const spawn = useWorldScene.getState().spawn ?? SPAWN;
    placePlayer(spawn.x, spawn.z, spawn.facing ?? SPAWN.facing);

    for (const [key, obstacle] of BARN_OBSTACLES) obstacles.set(key, obstacle);
    return () => {
      for (const [key] of BARN_OBSTACLES) obstacles.delete(key);
    };
  }, []);

  useInteractable({
    id: 'barn_exit',
    // 문 소리만 (버튼 딸깍과 겹치지 않게)
    silentTap: true,
    position: () => ({ x: 0, z: FRONT_Z - 0.5 }),
    area: { minX: -ENTRANCE.halfWidth, maxX: ENTRANCE.halfWidth, minZ: FRONT_Z - 1.1, maxZ: FRONT_Z + 1 },
    prompts: () => [{ id: 'exit_barn', label: '밖으로 나가기', enabled: true }],
    // 마굿간 문 앞, 우리 쪽(카메라 쪽)을 보고 선다
    // 들어가기 버튼 범위(문 앞 0.75m) 밖에 세워 바로 다시 들어가지 않게
    onAction: () => goToScene('YardScene', { x: BARN.x, z: BARN.z + 3.1, facing: 0 }),
  });

  const onTap = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 10) return;
    input.tapTarget = { x: event.point.x, z: event.point.z };
  };

  return (
    <group>
      <Floor onTap={onTap} />
      <Walls />
      {/* 기둥 · 들보는 그림자를 드리우지 않는다 (벽 위 들보가 바닥에 긴 줄 그림자를 만든다) */}
      <Frame />
      {/* 움직이지 않는 것: 그림자를 한 번만 그려 바닥에 굽는다 */}
      <StaticShadow>
        <Entrance />
        <Woodwork />
        <Ladder />
        <BarnProps />
      </StaticShadow>
      <Lanterns />
      <BakedShadows bounds={BARN_SHADOW_BOUNDS} color={BARN_SHADOW.color} opacity={BARN_SHADOW.opacity} />
    </group>
  );
}
