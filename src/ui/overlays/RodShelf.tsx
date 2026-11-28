/**
 * 가구 가게의 잡화 칸: 낚싯대 (config/rods). 사면 바로 쓸 수 있고, 가진 것 중 하나를 골라 쓴다.
 * 살 때만 곱셈 문제를 푼다 (가구와 같다). 기본 낚싯대(맨 왼쪽)로 돌아가기도 여기서.
 */
import { josa } from '@/config/josa';
import { RODS, rodUnlockKey, type RodDef } from '@/config/rods';
import { useGameStore } from '@/state/gameStore';
import { useUiStore } from '@/state/uiStore';
import { audio } from '@/audio/sfx';
import { iconUrl } from '../common/icons';
import { ItemCard } from '../common/ui';
import { askMath, awardCorrect } from '../mathFlow';

/**
 * 기본 낚싯대 그림: 생성 그림 없이 코드로 그린 작은 그림 (손에 든 기본 낚싯대 색과 같다, config/rods)
 */
const BASIC_ROD_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<path d="M14 54 L52 10" stroke="#7a5232" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M12 56 L22 45" stroke="#3f6fa8" stroke-width="8" stroke-linecap="round"/>' +
      '<circle cx="24" cy="46" r="5" fill="#d9d4c8" stroke="#5a4636" stroke-width="2"/>' +
      '<path d="M52 10 Q56 30 50 40" stroke="#bdb6a8" stroke-width="1.5" fill="none"/>' +
      '<circle cx="50" cy="44" r="5" fill="#e8524a" stroke="#5a4636" stroke-width="2"/>' +
      '</svg>',
  );

export function RodShelf(): React.ReactElement {
  const money = useGameStore((s) => s.money);
  const unlocked = useGameStore((s) => s.unlocked);
  const equipped = useGameStore((s) => s.equippedRod);
  const pushToast = useUiStore((s) => s.pushToast);

  const buy = async (rod: RodDef) => {
    if (money < rod.price) {
      pushToast({ text: '돈이 모자라요', tone: 'warn' });
      return;
    }
    const math = await askMath('SHOP', `${josa(rod.name, '을/를')} 사 볼까요?`);
    if (!math.correct) return;
    const store = useGameStore.getState();
    if (!store.buyRod(rod.id)) return;
    store.equipRod(rod.id);
    audio.play('coin');
    awardCorrect('SHOP', math);
    pushToast({ text: `${josa(rod.name, '을/를')} 샀어요. 낚시터에서 써 보세요`, tone: 'reward' });
  };

  const use = (rod: RodDef | null) => {
    useGameStore.getState().equipRod(rod?.id ?? null);
    pushToast({ text: rod ? `${josa(rod.name, '을/를')} 써요` : '기본 낚싯대를 써요', tone: 'info' });
  };

  return (
    <div className="mb-5">
      <p className="font-game mb-2 text-[1.25rem] text-ink">낚싯대</p>
      <p className="mb-3 text-[1rem] text-ink-soft">낚싯대마다 특별한 힘이 하나씩 있어요. 가진 낚싯대 중 하나를 골라 써요.</p>
      <div className="grid grid-cols-4 gap-3">
        {/* 기본 낚싯대: 맨 왼쪽. 처음부터 가지고 있다 (특별한 힘이 없어 설명은 없다) */}
        <ItemCard
          icon={BASIC_ROD_ICON}
          name="기본 낚싯대"
          selected={equipped === null}
          actionLabel={equipped === null ? '쓰는 중' : '쓰기'}
          onClick={() => equipped !== null && use(null)}
        />
        {RODS.map((rod) => {
          const owned = unlocked.includes(rodUnlockKey(rod.id));
          const using = equipped === rod.id;
          return (
            <ItemCard
              key={rod.id}
              icon={iconUrl(rod.icon)}
              name={rod.name}
              sub={rod.ability}
              price={owned ? undefined : rod.price}
              selected={using}
              disabled={!owned && money < rod.price}
              actionLabel={using ? '쓰는 중' : owned ? '쓰기' : '사기'}
              onClick={() => (owned ? !using && use(rod) : void buy(rod))}
            />
          );
        })}
      </div>
    </div>
  );
}
