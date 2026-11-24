/**
 * 학생 이름 선택 / 만들기 화면. (명세 8, 9, 10)
 * 앞 화면에서 고른 반의 학생만 보여 준다 (학급이 없으면 모두).
 * 이메일·비밀번호 로그인은 쓰지 않고, 이름과 캐릭터로 구분한다.
 *
 * 캐릭터 바꾸기는 여기가 아니라 구구단 선택 화면에 있다 —
 * 이름을 고른 뒤라야 "누구 것을 바꾸는지" 물어볼 필요가 없다.
 */
import { useEffect, useState } from 'react';
import { ASSETS } from '@/config/assets';
import { ALLOW_NEW_PROFILE } from '@/config/features';
import { GAME_TITLE } from '@/config/strings';
import { repositories } from '@/data';
import type { AvatarId, CharacterId, ClassRoom, PlayerProfile } from '@/types/game';
import { AvatarGrid } from '../common/AvatarGrid';
import { CharacterPicker } from '../common/CharacterPicker';
import { avatarIcon, realImageUrl } from '../common/icons';
import { EmptyNote, GameButton, Icon } from '../common/ui';
import { audio } from '@/audio/sfx';

export function ProfileSelectScreen({
  classRoom,
  onReady,
  onBack,
}: {
  /** 앞 화면에서 고른 반. null 이면 반 구분 없이 모두 */
  classRoom: ClassRoom | null;
  onReady: (profile: PlayerProfile) => void;
  /** 반 다시 고르기. 반 고르기를 건너뛰었으면 없다 */
  onBack?: () => void;
}): React.ReactElement {
  const [profiles, setProfiles] = useState<PlayerProfile[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<AvatarId>('rabbit');
  const [character, setCharacter] = useState<CharacterId>('boy');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void repositories()
      .player.listProfiles()
      .then((all) => {
        const list = classRoom ? all.filter((p) => p.classId === classRoom.id) : all;
        setProfiles(list);
        // 이름이 하나도 없으면 만들기 화면부터 보여 준다. 만들기를 막아 둔 학기에는
        // 그냥 빈 목록을 보여 주고 선생님을 부르게 한다.
        if (list.length === 0 && ALLOW_NEW_PROFILE) setCreating(true);
      })
      // 목록을 못 불러와도 화면이 멈추면 안 된다.
      .catch((error) => {
        console.error('[profile] 친구 목록을 불러오지 못했습니다.', error);
        setProfiles([]);
        if (ALLOW_NEW_PROFILE) setCreating(true);
      });
  }, [classRoom]);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    audio.unlock();
    try {
      const profile = await repositories().player.createProfile(trimmed, avatar, character, classRoom?.id ?? null);
      onReady(profile);
    } catch (error) {
      console.error('[profile] 이름을 저장하지 못했습니다.', error);
      setBusy(false);
    }
  };

  return (
    <ScreenShell title={GAME_TITLE} subtitle={classRoom?.name}>
      {profiles === null ? (
        <EmptyNote>친구들을 불러오는 중이에요…</EmptyNote>
      ) : creating && ALLOW_NEW_PROFILE ? (
        <div className="flex flex-col items-center gap-4">
          <p className="font-game text-[1.6rem] text-ink">이름을 적고 캐릭터를 골라 주세요</p>

          <input
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, 8))}
            placeholder="이름"
            aria-label="이름"
            className="panel-paper font-game w-[380px] max-w-full px-6 py-4 text-center text-[2rem] text-ink outline-none focus:ring-4 focus:ring-gold"
          />

          {/* 마을을 걸어 다닐 내 모습 */}
          <CharacterPicker selected={character} onSelect={setCharacter} />

          {/* 이름 목록에서 나를 찾을 때 쓰는 표시 (명세 10) */}
          <p className="font-game text-[1.15rem] text-ink-soft">내 이름 옆에 붙일 그림</p>
          <AvatarGrid selected={avatar} onSelect={setAvatar} />

          <div className="mt-2 flex gap-4">
            {profiles.length > 0 && (
              <GameButton onClick={() => setCreating(false)}>돌아가기</GameButton>
            )}
            <GameButton tone="leaf" big disabled={!name.trim() || busy} onClick={() => void create()}>
              게임 시작
            </GameButton>
          </div>
        </div>
      ) : (
        <div className="flex w-full flex-col items-center gap-5">
          <p className="font-game text-[1.6rem] text-ink">내 이름을 선택하세요</p>

          {profiles.length === 0 && (
            <EmptyNote>이름이 아직 없어요. 선생님께 말씀해 주세요.</EmptyNote>
          )}

          <div className="no-scrollbar grid max-h-[336px] w-full grid-cols-3 gap-4 overflow-y-auto px-2 pb-2">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => {
                  audio.unlock();
                  audio.play('tap');
                  onReady(profile);
                }}
                className="panel-paper flex min-h-[124px] items-center gap-3 px-4 py-3 text-left transition active:translate-y-[3px]"
              >
                <Icon src={avatarIcon(profile.avatarId)} size={72} alt="" />
                <span className="font-game min-w-0 flex-1 truncate text-[1.6rem] text-ink">
                  {profile.displayName}
                </span>
              </button>
            ))}
          </div>

          <div className="flex gap-4">
            {onBack && (
              <GameButton
                onClick={() => {
                  audio.play('tap');
                  onBack();
                }}
              >
                반 다시 고르기
              </GameButton>
            )}
            {/* 학기 초에 이름을 다 만든 뒤에는 이 버튼을 감춘다. (요청 1) */}
            {ALLOW_NEW_PROFILE && (
              <GameButton tone="gold" big onClick={() => setCreating(true)}>
                새 친구 만들기
              </GameButton>
            )}
          </div>
        </div>
      )}
    </ScreenShell>
  );
}

/** 두 시작 화면이 공유하는 배경. 게임과 같은 아트를 쓴다. */
export function ScreenShell({
  title,
  subtitle,
  children,
}: {
  /** 보통은 글자, 연습 고르기 화면처럼 그림을 넣을 때는 요소 */
  title: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const background = realImageUrl(ASSETS.environment.title);
  return (
    <div
      className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-hidden"
      style={
        background
          ? { backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : // 배경 그림을 만들기 전에는 하늘과 언덕 색만 칠한다
            { background: 'linear-gradient(#bfe6f5 0%, #e8f6fb 55%, #bde184 56%, #a8d66f 100%)' }
      }
    >
      <div className="panel-wood relative z-10 flex max-h-[700px] w-[900px] flex-col items-center gap-3 px-8 py-7">
        <h1 className="font-game text-[2.6rem] leading-none text-ink stroke-ink">{title}</h1>
        {subtitle && <p className="font-game text-[1.3rem] text-ink-soft">{subtitle}</p>}
        {/* 스크롤 상자가 버튼 그림자 · 빛나는 테두리를 자르지 않게, 패널 여백까지 넓혀 두고 안쪽을 그만큼 띄운다 */}
        <div className="no-scrollbar -mx-7 -mt-3 -mb-7 self-stretch overflow-y-auto px-7 pt-3 pb-7">{children}</div>
      </div>
    </div>
  );
}
