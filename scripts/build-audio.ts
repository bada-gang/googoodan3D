/**
 * 게임 소리 만들기: art-src/audio-src 의 원본(무료 공개 음원)에서 쓸 부분만 골라
 * public/assets/audio/*.mp3 로 줄여 둔다.
 *
 *   npm run audio
 *
 * - 원본은 받아서 악성코드 검사를 마친 것만 둔다 (Kenney CC0, OpenGameArt CC0, 위키미디어 공용).
 * - mp3 로 바꾸는 이유: 예전 아이패드(iOS 16 이하)는 ogg 를 못 튼다.
 * - 동물 녹음은 길어서 울음이 큰 구간만 자른다 (구간은 소리 크기 그래프를 보고 골랐다).
 * - 출처마다 음량이 달라서 크기를 맞춘다 (loudnorm).
 * - ffmpeg 위치: 환경 변수 FFMPEG, 없으면 F:\ai\ffmpeg 의 것.
 *
 * 출처 표기가 필요한 것(소 울음, CC BY-SA 3.0)은 src/config/credits.ts 에 적고 설정 화면에 보인다.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';

const FFMPEG = process.env.FFMPEG ?? 'F:/ai/ffmpeg/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe';
const SOURCE_DIR = 'art-src/audio-src';
const OUT_DIR = 'public/assets/audio';

interface Clip {
  /** 결과 파일 이름 (확장자 없이). 게임은 이 이름으로 찾는다 (src/audio/sfx.ts) */
  out: string;
  /** SOURCE_DIR 기준 원본 */
  from: string;
  /** 자를 구간 (초). 없으면 전체 */
  start?: number;
  end?: number;
  /** 빠르기 배율 (소리 높이는 그대로). 1.1 이면 1.1배속 */
  tempo?: number;
  /** 배경음악이면 true: 스테레오, 조금 작게 */
  music?: boolean;
}

const INTERFACE = 'kenney_interface-sounds/Audio';
const RPG = 'kenney_rpg-audio/Audio';
const IMPACT = 'kenney_impact-sounds/Audio';
const JINGLES = 'kenney_music-jingles/Audio/Pizzicato jingles';

const CLIPS: Clip[] = [
  // 버튼 · 문제
  { out: 'tap', from: `${INTERFACE}/click_001.ogg` },
  { out: 'correct', from: `${INTERFACE}/confirmation_001.ogg` },
  { out: 'wrong', from: `${INTERFACE}/error_004.ogg` },
  { out: 'levelUp', from: `${JINGLES}/jingles_PIZZI07.ogg` },
  // 농장 · 가게 · 꾸미기
  { out: 'coin', from: `${RPG}/handleCoins.ogg` },
  // 수확 · 열매 맺힘 · 생산물 받기. 사용자가 후보 87개 중 고름 (wobbleboxx "Level up, power up, Coin get", OpenGameArt CC0)
  { out: 'harvest', from: 'candidates/level-up-power-up-coin-get-13-sounds__SoundPack01/Rise03.aif', tempo: 1.1 },
  { out: 'place', from: `${IMPACT}/impactWood_light_002.ogg` },
  { out: 'door', from: `${RPG}/doorOpen_1.ogg` },
  // 발소리: 몇 개를 번갈아 써야 기계 소리처럼 안 들린다
  ...[0, 1, 2].map((i) => ({ out: `step_grass_${i}`, from: `${IMPACT}/footstep_grass_00${i}.ogg` })),
  ...[0, 1, 2].map((i) => ({ out: `step_wood_${i}`, from: `${IMPACT}/footstep_wood_00${i}.ogg` })),
  // 낚시 대어 팡파레. 사용자가 OpenGameArt 후보 26개 중 고름 (둘 다 CC0). 끝의 조용한 부분은 자른다
  // 전설의 연어: listener "Win sound effect" / 용왕의 왕관: congusbongus "New thing get!"
  { out: 'fanfare_salmon', from: 'fanfare/win_sound.wav', end: 2.3 },
  { out: 'fanfare_crown', from: 'fanfare/newthingget.ogg', end: 5.05 },
  // 동물 울음 (위키미디어 공용)
  { out: 'animal_chicken', from: 'chicken_hen_egg.ogg', start: 3.5, end: 5.5 },
  { out: 'animal_sheep', from: 'sheep_bleating.ogg', start: 0.35, end: 1.75 },
  { out: 'animal_goat', from: 'goat_herd_bleating.ogg', start: 38.8, end: 40.4 },
  { out: 'animal_cow', from: 'cow_mudchute.ogg', start: 0.5 },
  // 배경음악 (OpenGameArt, Zane Little Music, CC0)
  { out: 'bgm_village', from: 'apple_cider.ogg', music: true },
];

function build(clip: Clip): void {
  const source = path.join(SOURCE_DIR, clip.from);
  if (!existsSync(source)) throw new Error(`원본이 없습니다: ${source}`);
  const target = path.join(OUT_DIR, `${clip.out}.mp3`);
  const trim = [
    ...(clip.start !== undefined ? ['-ss', String(clip.start)] : []),
    ...(clip.end !== undefined ? ['-to', String(clip.end)] : []),
  ];
  const filters = clip.music
    ? ['loudnorm=I=-20:TP=-2']
    : [
        ...(clip.tempo ? [`atempo=${clip.tempo}`] : []),
        'loudnorm=I=-16:TP=-1.5',
        // 자른 녹음은 끝이 툭 끊기지 않게 살짝 줄인다
        ...(clip.start !== undefined || clip.end !== undefined
          ? ['afade=t=in:d=0.04', `areverse,afade=t=in:d=0.15,areverse`]
          : []),
      ];
  execFileSync(
    FFMPEG,
    [
      '-hide_banner', '-loglevel', 'error', '-y',
      ...trim,
      '-i', source,
      '-af', filters.join(','),
      '-ar', '44100',
      '-ac', clip.music ? '2' : '1',
      '-c:a', 'libmp3lame',
      '-b:a', clip.music ? '96k' : '64k',
      target,
    ],
    { stdio: 'inherit' },
  );
  console.log(`  ${clip.out}.mp3  ${(statSync(target).size / 1024).toFixed(0)}KB`);
}

if (!existsSync(FFMPEG)) throw new Error(`ffmpeg 가 없습니다: ${FFMPEG} (환경 변수 FFMPEG 로 지정)`);
mkdirSync(OUT_DIR, { recursive: true });
for (const clip of CLIPS) build(clip);
console.log(`소리 ${CLIPS.length}개를 만들었습니다 → ${OUT_DIR}`);
