/**
 * 만물상 잡화 칸의 낚시 티켓: 하루에 한 번 살 수 있고, 사면 그날 낚시를 FISHING.ticket.casts 번 더 할 수 있다.
 * 값 · 늘어나는 횟수는 config/fishing 의 FISHING.ticket. 살 때 곱셈 문제를 푼다 (다른 물건과 같다).
 */
import { FISHING } from '@/config/fishing';
import { useGameStore } from '@/state/gameStore';
import { useUiStore } from '@/state/uiStore';
import { audio } from '@/audio/sfx';
import { ItemCard } from '../common/ui';
import { askMath, awardCorrect } from '../mathFlow';

/** 티켓 그림: 생성 그림 없이 코드로 그린 작은 그림 (하늘색 표에 물고기) */
const TICKET_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<path d="M6 18 H58 V27 A5 5 0 0 0 58 37 V46 H6 V37 A5 5 0 0 0 6 27 Z" fill="#8fd3e8" stroke="#5a4636" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M44 20 V44" stroke="#5a4636" stroke-width="2" stroke-dasharray="3 3"/>' +
      '<path d="M14 32 Q22 24 32 32 Q22 40 14 32 Z" fill="#f2953a" stroke="#5a4636" stroke-width="2"/>' +
      '<path d="M32 32 L38 27 V37 Z" fill="#f2953a" stroke="#5a4636" stroke-width="2" stroke-linejoin="round"/>' +
      '<circle cx="19" cy="31" r="1.6" fill="#5a4636"/>' +
      '<text x="51" y="37" font-size="13" font-family="sans-serif" font-weight="bold" text-anchor="middle" fill="#5a4636">+</text>' +
      '</svg>',
  );

export function FishingTicketShelf(): React.ReactElement {
  const money = useGameStore((s) => s.money);
  const bought = useGameStore((s) => s.boughtFishingTicket());
  const pushToast = useUiStore((s) => s.pushToast);
  const { price, casts } = FISHING.ticket;

  const buy = async () => {
    if (money < price) {
      pushToast({ text: '돈이 모자라요', tone: 'warn' });
      return;
    }
    const math = await askMath('SHOP', '낚시 티켓을 사 볼까요?');
    if (!math.correct) return;
    if (!useGameStore.getState().buyFishingTicket()) return;
    audio.play('coin');
    awardCorrect('SHOP', math);
    pushToast({ text: `오늘 낚시를 ${casts}번 더 할 수 있어요`, tone: 'reward' });
  };

  return (
    <div className="mb-5">
      <p className="font-game mb-2 text-[1.25rem] text-ink">낚시 티켓</p>
      <div className="grid grid-cols-4 gap-3">
        <ItemCard
          icon={TICKET_ICON}
          name="낚시 티켓"
          sub={`오늘 낚시 ${casts}번 더`}
          price={bought ? undefined : price}
          disabled={bought || money < price}
          actionLabel={bought ? '오늘 샀어요' : '사기'}
          onClick={() => void buy()}
        />
      </div>
    </div>
  );
}
