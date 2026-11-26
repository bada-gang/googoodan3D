/**
 * 캐릭터 6종 고르기. (명세 9, 10)
 * 새로 만들 때(이름 선택 화면)와 바꿀 때(구구단 선택 화면)가 같은 그림을 본다.
 */
import { AVATARS } from '@/config/strings';
import type { AvatarId } from '@/types/game';
import { avatarIcon } from './icons';
import { Icon } from './ui';
import { audio } from '@/audio/sfx';

export function AvatarGrid({
  selected,
  onSelect,
}: {
  selected: AvatarId;
  onSelect: (id: AvatarId) => void;
}): React.ReactElement {
  return (
    <div className="grid grid-cols-6 gap-3">
      {AVATARS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => {
            audio.play('tap');
            onSelect(item.id);
          }}
          aria-label={item.name}
          aria-pressed={selected === item.id}
          className={[
            'panel-paper flex h-[118px] w-[118px] items-center justify-center transition',
            selected === item.id ? 'ring-4 ring-gold ring-offset-2' : 'opacity-80',
          ].join(' ')}
        >
          {/* 동물 이름은 띄우지 않는다 (그림만). 화면 읽기용 이름은 aria-label 에 */}
          <Icon src={avatarIcon(item.id)} size={86} alt="" />
        </button>
      ))}
    </div>
  );
}
