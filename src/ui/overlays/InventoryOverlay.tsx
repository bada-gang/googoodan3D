/**
 * 가방. 가지고 있는 것을 보여주기만 한다. 문제를 내지 않는다. (명세 78)
 * '물고기 도감' 칸: 잡아 본 물고기와 아직 못 잡은 물고기(그림자)를 모두 보여 주고, 가진 수도 함께 적는다.
 */
import { useState } from 'react';
import { SELLABLE_ORDER, SELL_PRICE } from '@/config/catalog';
import { FISH, FISH_ORDER, FISH_SIZE_LABEL } from '@/config/fishing';
import { CURRENCY } from '@/config/strings';
import { useGameStore } from '@/state/gameStore';
import { useUiStore } from '@/state/uiStore';
import type { SellableId } from '@/types/game';
import { chestIcon, cropIcon, itemCategory, itemIcon, itemName } from '../common/icons';
import { EmptyNote, GameButton, Icon, ItemCard, MoneyTag, OverlayShell } from '../common/ui';

type Tab = 'harvest' | 'seed' | 'supply' | 'furniture' | 'fish';

/** 칸 버튼은 이 순서로 놓인다 (물고기 도감은 맨 오른쪽) */
const TAB_LABEL: Record<Tab, string> = {
  harvest: '수확물',
  seed: '씨앗',
  supply: '물 · 먹이',
  furniture: '가구 · 장식',
  fish: '물고기 도감',
};

export function InventoryOverlay(): React.ReactElement {
  const inventory = useGameStore((s) => s.inventory);
  const chests = useGameStore((s) => s.chests);
  const sellableTotal = useGameStore((s) => s.sellableTotal());
  const closeOverlay = useUiStore((s) => s.closeOverlay);
  const [tab, setTab] = useState<Tab>('harvest');

  const entries = Object.entries(inventory).filter(([, count]) => count > 0);
  const shown = entries.filter(([itemId]) => itemCategory(itemId) === tab);

  return (
    <OverlayShell
      title="가방"
      onClose={closeOverlay}
      wide
      footer={
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-game text-[1.2rem] text-ink-soft">
            팔 수 있는 물건 값어치
          </span>
          <MoneyTag amount={sellableTotal} size={26} />
          {/* 팔기는 시장의 농장 가게에 직접 가서 한다 (가방에서 바로 가게로 가는 버튼은 없앴다) */}
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap justify-center gap-3">
        {(Object.keys(TAB_LABEL) as Tab[]).map((key) => (
          <GameButton key={key} tone={tab === key ? 'gold' : 'plain'} onClick={() => setTab(key)}>
            {TAB_LABEL[key]}
          </GameButton>
        ))}
      </div>

      {chests > 0 && (
        <div className="panel-paper mb-3 flex items-center gap-3 px-4 py-3">
          <Icon src={chestIcon()} size={52} alt="" />
          <p className="font-game text-[1.25rem]">
            랜덤 상자 {chests}개 — 집 안에서 열 수 있어요
          </p>
        </div>
      )}

      {tab === 'fish' ? (
        <FishDex />
      ) : shown.length === 0 ? (
        <EmptyNote>
          {tab === 'harvest'
            ? '아직 수확한 것이 없어요. 농장에서 열매를 키워 보세요.'
            : tab === 'seed'
              ? '씨앗이 없어요. 시장의 농장 가게에 가 보세요.'
              : tab === 'supply'
                ? '물과 먹이가 없어요. 시장의 농장 가게에서 살 수 있어요.'
                : '가구가 없어요. 시장의 가구 가게에 가 보세요.'}
        </EmptyNote>
      ) : (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {shown.map(([itemId, count]) => (
            <ItemCard
              key={itemId}
              icon={itemIcon(itemId)}
              name={itemName(itemId)}
              count={count}
              sub={
                SELLABLE_ORDER.includes(itemId as SellableId)
                  ? `한 개 ${SELL_PRICE[itemId as SellableId]}${CURRENCY}`
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </OverlayShell>
  );
}

/** 물고기 도감: 여덟 칸. 잡아 본 물고기는 그림 · 이름 · 잡은 수 · 가진 수, 못 잡은 물고기는 그림자와 크기만 */
function FishDex(): React.ReactElement {
  const dex = useGameStore((s) => s.fishDex);
  const inventory = useGameStore((s) => s.inventory);
  const found = FISH_ORDER.filter((fish) => dex[fish]).length;
  return (
    <div>
      <p className="font-game text-ink-soft mb-3 text-center text-[1.2rem]">
        {found === 0
          ? '아직 잡은 물고기가 없어요. 시장 낚시터에서 낚아 보세요.'
          : `${FISH_ORDER.length}마리 중 ${found}마리를 찾았어요`}
      </p>
      <div className="grid grid-cols-4 gap-3">
        {FISH_ORDER.map((fish) => {
          const entry = dex[fish];
          const def = FISH[fish];
          const have = inventory[fish] ?? 0;
          return (
            <div
              key={fish}
              className={[
                'panel-paper flex flex-col items-center gap-1 px-2 py-3 text-center',
                def.size === 'legend' && entry ? 'bg-[#fff1c4]' : '',
              ].join(' ')}
            >
              <img
                src={cropIcon(fish)}
                alt={entry ? def.name : ''}
                width={84}
                height={84}
                draggable={false}
                // 못 잡은 물고기는 까만 그림자로
                style={entry ? undefined : { filter: 'brightness(0)', opacity: 0.22 }}
              />
              <p className="font-game text-ink text-[1.15rem] leading-tight">{entry ? def.name : '???'}</p>
              <p className="font-game text-ink-soft text-[0.95rem] leading-tight">
                {entry ? `잡은 수 ${entry.caught} · 가진 수 ${have}` : FISH_SIZE_LABEL[def.size]}
              </p>
              {entry && (
                <p className="font-game text-ink-soft text-[0.95rem] leading-tight">
                  한 마리 {def.price}
                  {CURRENCY}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
