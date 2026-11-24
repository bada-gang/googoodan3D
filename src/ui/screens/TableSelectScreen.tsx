/**
 * 연습할 문제 고르기 화면. 게임에 들어갈 때마다 반드시 표시한다. (명세 11, 12)
 * 곱셈구구 단(여러 개)과 다른 문제 묶음(나눗셈 · 받아내림 뺄셈, 여러 개)을 함께 고를 수 있다.
 * 이 선택은 현재 세션에만 적용되고 저장하지 않는다.
 *
 * 캐릭터 바꾸기 · 이름 바꾸기도 여기 둔다. 이름을 이미 고른 뒤라 "누구 것을 바꿀까요"를 물을 필요가 없고,
 * 이름 카드가 "게임 시작"과 "캐릭터 바꾸기" 두 가지를 겸하지 않아도 된다.
 */
import { useEffect, useState } from 'react';
import { PROBLEM_SETS, PROBLEM_SET_EXAMPLE, PROBLEM_SET_LABEL, TABLES, type ProblemSet } from '@/config/curriculum';
import { pickPracticeTables } from '@/math/practiceNeeds';
import { repositories } from '@/data';
import type { AvatarId, CharacterId, PlayerProfile } from '@/types/game';
import { MAX_PLAYER_NAME_LENGTH, characterOf } from '@/types/game';
import type { LearningStats } from '@/types/learning';
import { AvatarGrid } from '../common/AvatarGrid';
import { CharacterPicker } from '../common/CharacterPicker';
import { avatarIcon } from '../common/icons';
import { GameButton, Icon } from '../common/ui';
import { ScreenShell } from './ProfileSelectScreen';
import { audio } from '@/audio/sfx';

export function TableSelectScreen({
  profile,
  onStart,
  onBack,
  onProfileChanged,
}: {
  profile: PlayerProfile;
  onStart: (tables: number[], sets: ProblemSet[]) => void;
  onBack: () => void;
  /** 바뀐 모습 · 이름을 위(App)에도 알린다 — 게임 안 캐릭터와 저장 데이터가 같이 바뀌어야 한다. */
  onProfileChanged: (patch: Partial<Pick<PlayerProfile, 'avatarId' | 'characterId' | 'displayName'>>) => void;
}): React.ReactElement {
  const [selected, setSelected] = useState<number[]>([]);
  const [sets, setSets] = useState<ProblemSet[]>([]);
  const [picking, setPicking] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(profile.displayName);
  const [avatar, setAvatar] = useState<AvatarId>(profile.avatarId);
  const [character, setCharacter] = useState<CharacterId>(characterOf(profile));
  const [busy, setBusy] = useState(false);
  /** 이 학생의 지난 기록. "연습 필요"를 계산하는 데만 쓴다. */
  const [stats, setStats] = useState<LearningStats | null>(null);
  /** 퀵버튼이 무엇을 골랐는지 한 줄 설명 */
  const [pickNote, setPickNote] = useState('');

  // 기록은 게임에 들어갈 때 다시 제대로 읽는다. 여기서는 단을 고르는 데만 쓰므로
  // 실패해도 조용히 넘어간다 — 이 화면이 멈추면 수업이 멈춘다.
  useEffect(() => {
    let alive = true;
    void repositories()
      .learning.loadStats(profile.id)
      .then((loaded) => {
        if (alive) setStats(loaded);
      })
      .catch((error) => {
        console.error('[table] 지난 기록을 불러오지 못했습니다.', error);
      });
    return () => {
      alive = false;
    };
  }, [profile.id]);

  const toggle = (table: number) => {
    audio.play('tap');
    setPickNote('');
    setSelected((prev) =>
      prev.includes(table) ? prev.filter((t) => t !== table) : [...prev, table],
    );
  };

  const toggleSet = (set: ProblemSet) => {
    audio.play('tap');
    setSets((prev) => (prev.includes(set) ? prev.filter((s) => s !== set) : [...prev, set]));
  };

  const selectAll = () => {
    audio.play('tap');
    setSelected([...TABLES]);
    setPickNote('');
  };

  const selectPractice = () => {
    audio.play('tap');
    const pick = pickPracticeTables(stats);
    setSelected(pick.tables);
    setPickNote(pick.reason);
  };

  const saveLook = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await repositories().player.updateLook(profile.id, { avatarId: avatar, characterId: character });
      onProfileChanged({ avatarId: avatar, characterId: character });
      setPicking(false);
    } catch (error) {
      console.error('[profile] 캐릭터를 바꾸지 못했습니다.', error);
    } finally {
      setBusy(false);
    }
  };

  const trimmedName = newName.trim();
  const saveName = async () => {
    if (busy || !trimmedName || trimmedName === profile.displayName) return;
    setBusy(true);
    try {
      await repositories().player.rename(profile.id, trimmedName);
      onProfileChanged({ displayName: trimmedName });
      setRenaming(false);
    } catch (error) {
      console.error('[profile] 이름을 바꾸지 못했습니다.', error);
    } finally {
      setBusy(false);
    }
  };

  if (renaming) {
    return (
      <ScreenShell title="새 이름을 적어 주세요">
        <div className="flex flex-col items-center gap-5 pt-2">
          <p className="font-game text-[1.2rem] text-ink-soft">
            지금 이름: {profile.displayName} · {MAX_PLAYER_NAME_LENGTH}글자까지 쓸 수 있어요
          </p>
          <input
            value={newName}
            autoFocus
            onChange={(event) => setNewName(event.target.value.slice(0, MAX_PLAYER_NAME_LENGTH))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void saveName();
            }}
            placeholder="이름"
            aria-label="새 이름"
            className="panel-paper font-game w-[380px] max-w-full px-6 py-4 text-center text-[2rem] text-ink outline-none focus:ring-4 focus:ring-gold"
          />
          <div className="flex gap-4">
            <GameButton
              onClick={() => {
                setNewName(profile.displayName);
                setRenaming(false);
              }}
            >
              돌아가기
            </GameButton>
            <GameButton
              tone="leaf"
              big
              disabled={busy || !trimmedName || trimmedName === profile.displayName}
              onClick={() => void saveName()}
            >
              이걸로 할래요
            </GameButton>
          </div>
        </div>
      </ScreenShell>
    );
  }

  if (picking) {
    return (
      <ScreenShell title={`${profile.displayName}의 캐릭터를 골라 주세요`}>
        <div className="flex flex-col items-center gap-4 pt-1">
          <p className="font-game text-[1.15rem] text-ink-soft">마을에서 걸어 다닐 내 모습</p>
          <CharacterPicker selected={character} onSelect={setCharacter} />

          <p className="font-game text-[1.15rem] text-ink-soft">내 이름 옆에 붙일 그림</p>
          <AvatarGrid selected={avatar} onSelect={setAvatar} />

          <div className="flex gap-4">
            <GameButton
              onClick={() => {
                setAvatar(profile.avatarId);
                setCharacter(characterOf(profile));
                setPicking(false);
              }}
            >
              돌아가기
            </GameButton>
            <GameButton tone="leaf" big disabled={busy} onClick={() => void saveLook()}>
              이걸로 할래요
            </GameButton>
          </div>
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title={
        // 이름이 길면(8글자) 쉼표 뒤에서 두 줄로 나뉜다
        <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[2.3rem]">
          <span className="inline-flex items-center gap-2">
            <Icon src={avatarIcon(profile.avatarId)} size={52} alt="" />
            {profile.displayName}님,
          </span>
          <span>오늘은 무엇을 공부할까요?</span>
        </span>
      }
    >
      <div className="flex flex-col items-center gap-4 pt-1">
        <div className="flex items-center gap-3">
          <GameButton
            tone="white"
            onClick={() => {
              audio.play('tap');
              setAvatar(profile.avatarId);
              setCharacter(characterOf(profile));
              setPicking(true);
            }}
          >
            캐릭터 바꾸기
          </GameButton>
          <GameButton
            tone="white"
            onClick={() => {
              audio.play('tap');
              setNewName(profile.displayName);
              setRenaming(true);
            }}
          >
            이름 바꾸기
          </GameButton>
        </div>

        {/* 왼쪽 곱셈구구 · 오른쪽 나눗셈 · 뺄셈. 둘을 섞어 여러 개 고를 수 있다. */}
        <div className="flex items-stretch gap-6">
          {/* 곱셈구구: 단 여덟 개(4 × 2) + 퀵버튼. 2학년이 여덟 개를 보고 약한 단을 스스로 고르기는 어렵다. */}
          <div className="flex flex-col items-center gap-3">
            <span className="font-game text-[1.35rem] text-ink">곱셈구구</span>
            <div className="grid grid-cols-4 gap-2.5">
              {TABLES.map((table) => {
                const on = selected.includes(table);
                return (
                  <button
                    key={table}
                    type="button"
                    onClick={() => toggle(table)}
                    aria-pressed={on}
                    className={[
                      'btn-game h-[84px] w-[88px] whitespace-nowrap !px-0 text-[1.8rem]',
                      on ? 'btn-gold ring-4 ring-white/70' : '',
                    ].join(' ')}
                  >
                    {table}단
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <GameButton tone="sky" onClick={selectAll}>
                구구단 전체
              </GameButton>
              <GameButton tone="berry" onClick={selectPractice}>
                연습 필요
              </GameButton>
            </div>
          </div>

          <div className="w-[3px] self-stretch rounded-full bg-ink/15" aria-hidden />

          {/* 다른 문제 묶음 (2 × 2) */}
          <div className="flex flex-col items-center gap-3">
            <span className="font-game text-[1.35rem] text-ink">나눗셈 · 뺄셈</span>
            <div className="grid grid-cols-2 gap-2.5">
              {PROBLEM_SETS.map((set) => {
                const on = sets.includes(set);
                return (
                  <button
                    key={set}
                    type="button"
                    onClick={() => toggleSet(set)}
                    aria-pressed={on}
                    className={[
                      'btn-game flex h-[84px] w-[190px] flex-col items-center justify-center !gap-0 !px-2 leading-tight',
                      on ? 'btn-gold ring-4 ring-white/70' : '',
                    ].join(' ')}
                  >
                    <span className="text-[1.2rem]">{PROBLEM_SET_LABEL[set]}</span>
                    <span className="text-[0.95rem] opacity-75">{PROBLEM_SET_EXAMPLE[set]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex min-h-[2.6rem] items-center gap-3">
          <p className="font-game text-center text-[1.2rem] text-ink-soft">
            {selected.length === 0 && sets.length === 0 ? (
              '연습할 것을 하나 이상 골라 주세요'
            ) : (
              <>
                <span className="text-ink">{describeChoice(selected, sets)}</span>
                {objectParticle(describeChoice(selected, sets))} 연습해요
                {pickNote && <span className="text-ink"> — {pickNote}</span>}
              </>
            )}
          </p>
        </div>

        <div className="flex gap-4">
          <GameButton tone="white" onClick={onBack}>
            이름 다시 고르기
          </GameButton>
          {/* 늘 같은 자리에 둔다. 고른 게 없으면 흐리게만 */}
          <GameButton
            tone="orange"
            disabled={selected.length === 0 && sets.length === 0}
            onClick={() => {
              audio.play('tap');
              setSelected([]);
              setSets([]);
              setPickNote('');
            }}
          >
            선택 취소
          </GameButton>
          <GameButton
            tone="leaf"
            big
            glow={!(selected.length === 0 && sets.length === 0)}
            disabled={selected.length === 0 && sets.length === 0}
            onClick={() => onStart([...selected].sort((a, b) => a - b), PROBLEM_SETS.filter((set) => sets.includes(set)))}
          >
            마을로 출발!
          </GameButton>
        </div>
      </div>
    </ScreenShell>
  );
}

/** 마지막 글자에 받침이 있으면 '을', 없으면 '를' ("구구단 전체를", "뺄셈을") */
function objectParticle(text: string): string {
  const code = text.charCodeAt(text.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return '을';
  return code % 28 === 0 ? '를' : '을';
}

/** "2단, 3단 · 받아내림 뺄셈" 처럼 고른 것을 한 줄로 */
function describeChoice(tables: number[], sets: ProblemSet[]): string {
  const parts: string[] = [];
  if (tables.length === TABLES.length) parts.push('구구단 전체');
  else if (tables.length > 0) parts.push(`${[...tables].sort((a, b) => a - b).join('단, ')}단`);
  for (const set of PROBLEM_SETS) if (sets.includes(set)) parts.push(PROBLEM_SET_LABEL[set]);
  return parts.join(' · ');
}
