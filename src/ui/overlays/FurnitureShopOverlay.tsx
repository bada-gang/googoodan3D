/**
 * 가구 가게. 칸은 집 안(가구 · 벽지 · 바닥재) · 마당 · 잡화, 칸 안에서는 종류별로 묶는다. (명세 52)
 * 구입할 때만 문제를 풀고, 배치는 자유롭게 한다. (명세 29)
 * 꾸미기 물건은 레벨 해금이 없다 — 레벨 1부터 다 살 수 있다 (config/decor).
 */
import { josa } from '@/config/josa';
import { useState } from 'react';
import { CATEGORY_NAME, FLOORS, WALLPAPERS, furnitureByCategory, type SurfaceDef } from '@/config/catalog';
import { CURRENCY } from '@/config/strings';
import { useGameStore } from '@/state/gameStore';
import { useUiStore } from '@/state/uiStore';
import { furnitureIcon, surfaceStyle } from '../common/icons';
import { GameButton, ItemCard, MoneyTag, OverlayShell } from '../common/ui';
import { askMath, awardCorrect } from '../mathFlow';
import { audio } from '@/audio/sfx';

type Tab = 'home' | 'yard';

const TAB_LABEL: Record<Tab, string> = {
  home: '집 안',
  yard: '마당',
};

export function FurnitureShopOverlay(): React.ReactElement {
  const money = useGameStore((s) => s.money);
  const unlocked = useGameStore((s) => s.unlocked);
  const closeOverlay = useUiStore((s) => s.closeOverlay);
  const pushToast = useUiStore((s) => s.pushToast);
  const [tab, setTab] = useState<Tab>('home');

  const buyFurniture = async (itemId: string, name: string, price: number) => {
    if (money < price) {
      pushToast({ text: '돈이 모자라요', tone: 'warn' });
      return;
    }
    const math = await askMath('SHOP', `${josa(name, '을/를')} 사 볼까요?`);
    if (!math.correct) return;
    if (!useGameStore.getState().buyFurniture(itemId)) return;
    audio.play('coin');
    awardCorrect('SHOP', math);
    pushToast({ text: `${josa(name, '을/를')} 샀어요. 꾸미기에서 놓아 보세요`, tone: 'reward' });
  };

  const buySurface = async (surfaceId: string, name: string, price: number) => {
    if (price > 0 && money < price) {
      pushToast({ text: '돈이 모자라요', tone: 'warn' });
      return;
    }
    if (price > 0) {
      const math = await askMath('SHOP', `${josa(name, '을/를')} 사 볼까요?`);
      if (!math.correct) return;
      awardCorrect('SHOP', math);
    }
    if (!useGameStore.getState().buySurface(surfaceId)) return;
    audio.play('coin');
    pushToast({ text: `${josa(name, '을/를')} 얻었어요. 꾸미기에서 바꿀 수 있어요`, tone: 'reward' });
  };

  return (
    <OverlayShell title="가구 가게" onClose={closeOverlay} wide footer={<MoneyTag amount={money} />}>
      <div className="mb-4 flex flex-wrap justify-center gap-3">
        {(Object.keys(TAB_LABEL) as Tab[]).map((key) => (
          <GameButton key={key} tone={tab === key ? 'gold' : 'plain'} onClick={() => setTab(key)}>
            {TAB_LABEL[key]}
          </GameButton>
        ))}
      </div>

      {furnitureByCategory(tab).map(({ category, items }) => (
        <Section key={category} title={CATEGORY_NAME[category]}>
          {items.map((item) => (
            <ItemCard
              key={item.id}
              icon={furnitureIcon(item.id)}
              name={item.name}
              price={item.price}
              disabled={money < item.price}
              actionLabel="사기"
              onClick={() => void buyFurniture(item.id, item.name, item.price)}
            />
          ))}
        </Section>
      ))}

      {/* 벽지 · 바닥재는 집 안 칸에 */}
      {tab === 'home' && (
        <>
          <SurfaceGroup title="벽지" kind="wall" surfaces={WALLPAPERS} money={money} unlocked={unlocked} onBuy={buySurface} />
          <SurfaceGroup title="바닥재" kind="floor" surfaces={FLOORS} money={money} unlocked={unlocked} onBuy={buySurface} />
        </>
      )}
    </OverlayShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="mb-5">
      <p className="font-game mb-2 text-[1.25rem] text-ink">{title}</p>
      <div className="grid grid-cols-4 gap-3">{children}</div>
    </div>
  );
}

function SurfaceGroup({
  title,
  kind,
  surfaces,
  money,
  unlocked,
  onBuy,
}: {
  title: string;
  kind: 'wall' | 'floor';
  surfaces: SurfaceDef[];
  money: number;
  unlocked: string[];
  onBuy: (id: string, name: string, price: number) => Promise<void>;
}): React.ReactElement {
  return (
    <Section title={title}>
      {surfaces.map((surface) => {
        const owned = surface.price === 0 || unlocked.includes(`surface_${surface.id}`);
        return (
          <button
            key={surface.id}
            type="button"
            disabled={!owned && money < surface.price}
            onClick={() => void onBuy(surface.id, surface.name, owned ? 0 : surface.price)}
            className="panel-paper flex min-h-[132px] flex-col items-center gap-2 p-3 transition active:translate-y-[3px] disabled:opacity-55"
          >
            {/* 방에 깔릴 그림 그대로 보여 준다 */}
            <div aria-hidden style={surfaceStyle(surface, kind)} className="block h-[54px] w-full rounded-xl border-4 border-ink" />
            <span className="font-game text-[1.1rem]">{surface.name}</span>
            <span className="font-game text-[1rem] text-ink-soft">
              {owned ? '가지고 있어요' : `${surface.price.toLocaleString()}${CURRENCY}`}
            </span>
          </button>
        );
      })}
    </Section>
  );
}
