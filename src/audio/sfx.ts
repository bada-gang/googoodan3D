/**
 * 게임 소리. public/assets/audio 의 음원(무료 공개 음원을 scripts/build-audio.ts 로 줄인 것)을 튼다.
 *
 * - 효과음: 소리를 켤 때(unlock) 미리 불러 둔다. 아직 못 불러왔거나 파일이 없으면 예전 합성음으로 대신한다.
 * - 배경음악: 3분짜리 곡을 통째로 풀면 메모리를 70MB 넘게 먹어서 태블릿에 무겁다.
 *   <audio> 로 조금씩 읽으며(스트리밍) 반복한다. 미니게임 트랙은 아직 합성음.
 * - 탭이 가려지면 배경음악을 멈췄다가 돌아오면 다시 튼다.
 */

/** 배경음 트랙. 장소에 따라 바뀐다. */
export type BgmTrack = 'village' | 'minigame';

export type SfxName =
  | 'step'
  | 'correct'
  | 'wrong'
  | 'coin'
  | 'harvest'
  | 'place'
  | 'door'
  | 'animal'
  | 'levelUp'
  | 'tap';

/**
 * 효과음 파일. 키는 소리 이름 또는 "이름:종류" (발소리 바닥, 동물 종류).
 * 여러 개면 번갈아 튼다 (같은 소리만 반복되면 기계 소리처럼 들린다).
 */
const SFX_FILES: Record<string, string[]> = {
  tap: ['tap'],
  correct: ['correct'],
  wrong: ['wrong'],
  levelUp: ['levelUp'],
  coin: ['coin'],
  harvest: ['harvest'],
  place: ['place'],
  door: ['door'],
  'step:grass': ['step_grass_0', 'step_grass_1', 'step_grass_2'],
  'step:wood': ['step_wood_0', 'step_wood_1', 'step_wood_2'],
  'animal:chicken': ['animal_chicken'],
  'animal:goat': ['animal_goat'],
  'animal:sheep': ['animal_sheep'],
  'animal:cow': ['animal_cow'],
};

/** 파일마다 크기 (음원은 모두 같은 크기로 맞춰 두었다. 발소리 · 울음은 작게) */
const SFX_FILE_GAIN: Record<string, number> = {
  step: 0.3,
  animal: 0.55,
  // 정답 소리는 자주 나서 조금 작게 (기본보다 15% 작게)
  correct: 0.68,
  // 수확 소리는 자주 나서 작게 (사용자가 들어 보고 정한 크기)
  harvest: 0.54,
  // 장면 이동(집 문 · 마을 ↔ 시장) 소리는 기본보다 25% 작게 (사용자 요청)
  door: 0.6,
};
const SFX_FILE_DEFAULT_GAIN = 0.8;

const AUDIO_URL = 'assets/audio/';
/** 마을 배경음악 크기 */
const MUSIC_GAIN = 0.4;

function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

interface ToneOptions {
  freq: number;
  start: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  glideTo?: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private bgmTimer: number | null = null;
  private bgmStep = 0;
  private bgmNextTime = 0;
  private sfxEnabled = true;
  private bgmEnabled = true;
  private track: BgmTrack = 'village';
  /** 불러온 효과음 (파일 이름 → 소리) */
  private buffers = new Map<string, AudioBuffer>();
  private loading = false;
  private bgmPlaying = false;
  private music: HTMLAudioElement | null = null;

  /** 사용자 입력 이후에 호출해야 브라우저 정책상 소리가 난다. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.24;
      this.sfxGain.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.07;
      this.bgmGain.connect(this.ctx.destination);
      this.loadSfx();
      // 탭을 가리면 배경음악을 멈추고, 돌아오면 다시 튼다
      document.addEventListener('visibilitychange', () => {
        if (!this.music || !this.bgmPlaying) return;
        if (document.hidden) this.music.pause();
        else void this.music.play().catch(() => undefined);
      });
    } catch (error) {
      console.warn('[audio] 오디오를 켤 수 없습니다.', error);
    }
  }

  setSfxEnabled(on: boolean): void {
    this.sfxEnabled = on;
  }

  setBgmEnabled(on: boolean): void {
    this.bgmEnabled = on;
    if (on) this.startBgm();
    else this.stopBgm();
  }

  private tone({ freq, start, duration, type = 'triangle', gain = 1, glideTo }: ToneOptions): void {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + duration);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  /** 효과음 파일을 모두 불러 둔다. 작은 파일들이라(모두 합쳐 150KB 쯤) 한 번에 */
  private loadSfx(): void {
    if (this.loading || !this.ctx) return;
    this.loading = true;
    const ctx = this.ctx;
    const names = new Set(Object.values(SFX_FILES).flat());
    for (const name of names) {
      fetch(`${AUDIO_URL}${name}.mp3`)
        .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(String(response.status)))))
        .then((data) => ctx.decodeAudioData(data))
        .then((buffer) => this.buffers.set(name, buffer))
        .catch(() => undefined); // 없으면 합성음으로 대신한다
    }
  }

  /** 불러온 파일이 있으면 튼다 */
  private playFile(name: SfxName, variant?: string): boolean {
    if (!this.ctx || !this.sfxGain) return false;
    const files = SFX_FILES[variant ? `${name}:${variant}` : name];
    const loaded = files?.filter((file) => this.buffers.has(file)) ?? [];
    if (loaded.length === 0) return false;
    const file = loaded[Math.floor(Math.random() * loaded.length)];
    const source = this.ctx.createBufferSource();
    source.buffer = this.buffers.get(file)!;
    const gain = this.ctx.createGain();
    gain.gain.value = SFX_FILE_GAIN[name] ?? SFX_FILE_DEFAULT_GAIN;
    // 합성음 기준 크기(sfxGain 0.24)를 파일에는 쓰지 않는다
    source.connect(gain).connect(this.ctx.destination);
    source.start();
    return true;
  }

  /**
   * 효과음. variant 는 발소리 바닥(grass · wood)이나 동물 종류(chicken · goat · sheep · cow).
   */
  play(name: SfxName, variant?: string): void {
    if (!this.sfxEnabled) return;
    this.unlock();
    if (!this.ctx) return;
    if (this.playFile(name, variant)) return;
    const now = this.ctx.currentTime;

    switch (name) {
      case 'correct':
        // 밝은 3화음 아르페지오
        [72, 76, 79, 84].forEach((note, i) =>
          this.tone({ freq: midiToFreq(note), start: now + i * 0.065, duration: 0.22, gain: 0.7 }),
        );
        break;
      case 'wrong':
        // 부드럽게 내려가는 두 음. 실패음처럼 들리지 않게 한다. (명세 57)
        this.tone({ freq: midiToFreq(69), start: now, duration: 0.18, gain: 0.4, type: 'sine' });
        this.tone({ freq: midiToFreq(66), start: now + 0.11, duration: 0.24, gain: 0.35, type: 'sine' });
        break;
      case 'coin':
        this.tone({ freq: midiToFreq(88), start: now, duration: 0.1, gain: 0.5 });
        this.tone({ freq: midiToFreq(93), start: now + 0.07, duration: 0.16, gain: 0.45 });
        break;
      case 'harvest':
        this.tone({ freq: midiToFreq(74), start: now, duration: 0.14, gain: 0.55 });
        this.tone({ freq: midiToFreq(81), start: now + 0.08, duration: 0.2, gain: 0.5 });
        break;
      case 'place':
        this.tone({ freq: midiToFreq(60), start: now, duration: 0.11, gain: 0.5, type: 'sine' });
        this.tone({ freq: midiToFreq(67), start: now + 0.05, duration: 0.13, gain: 0.35, type: 'sine' });
        break;
      case 'door':
        this.tone({ freq: midiToFreq(55), start: now, duration: 0.3, gain: 0.4, type: 'sine', glideTo: midiToFreq(62) });
        break;
      case 'animal':
        this.tone({ freq: midiToFreq(71), start: now, duration: 0.16, gain: 0.4, type: 'sawtooth', glideTo: midiToFreq(76) });
        break;
      case 'levelUp':
        [67, 72, 76, 79, 84].forEach((note, i) =>
          this.tone({ freq: midiToFreq(note), start: now + i * 0.085, duration: 0.3, gain: 0.6 }),
        );
        break;
      case 'step':
        this.tone({ freq: 140 + Math.random() * 30, start: now, duration: 0.05, gain: 0.18, type: 'sine' });
        break;
      case 'tap':
      default:
        this.tone({ freq: midiToFreq(79), start: now, duration: 0.07, gain: 0.35, type: 'sine' });
        break;
    }
  }

  /* --------------------------------- BGM --------------------------------- */

  /**
   * 배경음 트랙.
   * village: 편안하고 반복해도 지치지 않는 루프
   * minigame: 빠르고 조금 긴장되는 단조 루프 (요청 5)
   */
  private static readonly TRACKS: Record<
    BgmTrack,
    { pattern: number[][]; beat: number; gain: number; wave: OscillatorType }
  > = {
    village: {
      pattern: [
        [60, 64, 67, 72],
        [57, 60, 64, 69],
        [53, 57, 60, 65],
        [55, 59, 62, 67],
      ],
      beat: 0.42,
      gain: 0.07,
      wave: 'triangle',
    },
    minigame: {
      // Am - F - G - Am. 단조라 조금 조급한 느낌이 난다.
      pattern: [
        [57, 60, 64, 60],
        [53, 57, 60, 57],
        [55, 59, 62, 59],
        [57, 64, 60, 64],
      ],
      beat: 0.19,
      gain: 0.075,
      wave: 'sawtooth',
    },
  };

  /** 지금 트랙을 바꾼다. 같은 트랙이면 아무 일도 하지 않는다. */
  setBgmTrack(track: BgmTrack): void {
    if (this.track === track) return;
    this.track = track;
    if (this.bgmPlaying) {
      this.stopBgm();
      this.startBgm();
    }
  }

  startBgm(): void {
    if (!this.bgmEnabled) return;
    this.unlock();
    if (!this.ctx || !this.bgmGain || this.bgmPlaying) return;
    this.bgmPlaying = true;
    if (this.track === 'village') {
      this.startMusic();
      return;
    }
    this.bgmGain.gain.value = AudioEngine.TRACKS[this.track].gain;
    this.bgmNextTime = this.ctx.currentTime + 0.1;
    this.bgmStep = 0;
    this.bgmTimer = window.setInterval(() => this.scheduleBgm(), 120);
  }

  /** 마을 배경음악 파일. 처음 한 번 만들고, 멈출 때는 일시정지만 한다 (다시 틀면 이어서) */
  private startMusic(): void {
    if (!this.ctx || !this.bgmGain) return;
    if (!this.music) {
      const element = new Audio(`${AUDIO_URL}bgm_village.mp3`);
      element.loop = true;
      element.preload = 'auto';
      // 아이패드는 <audio> 의 volume 을 무시해서, 크기는 WebAudio 쪽에서 줄인다
      this.ctx.createMediaElementSource(element).connect(this.bgmGain);
      this.music = element;
    }
    // 툭 튀어나오지 않게 1초 동안 커진다
    const now = this.ctx.currentTime;
    this.bgmGain.gain.cancelScheduledValues(now);
    this.bgmGain.gain.setValueAtTime(0.0001, now);
    this.bgmGain.gain.exponentialRampToValueAtTime(MUSIC_GAIN, now + 1);
    void this.music.play().catch(() => undefined);
  }

  stopBgm(): void {
    this.bgmPlaying = false;
    if (this.bgmTimer !== null) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.music?.pause();
  }

  private scheduleBgm(): void {
    if (!this.ctx || !this.bgmGain) return;
    const { pattern, beat, wave } = AudioEngine.TRACKS[this.track];
    while (this.bgmNextTime < this.ctx.currentTime + 0.6) {
      const chord = pattern[Math.floor(this.bgmStep / 4) % pattern.length];
      const note = chord[this.bgmStep % 4];
      this.bgmNote(midiToFreq(note + 12), this.bgmNextTime, beat * 1.6, 0.5, wave);
      if (this.bgmStep % 4 === 0) {
        this.bgmNote(midiToFreq(chord[0] - 12), this.bgmNextTime, beat * 3.4, 0.42, wave);
      }
      this.bgmNextTime += beat;
      this.bgmStep += 1;
    }
  }

  private bgmNote(
    freq: number,
    start: number,
    duration: number,
    gain: number,
    wave: OscillatorType = 'triangle',
  ): void {
    if (!this.ctx || !this.bgmGain) return;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.08);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env);
    env.connect(this.bgmGain);
    osc.start(start);
    osc.stop(start + duration + 0.1);
  }
}

export const audio = new AudioEngine();

// 개발 중 코드를 고치면 이 파일이 다시 실행돼 엔진이 하나 더 생긴다. 예전 엔진의 음악을 멈춰야 노래가 겹치지 않는다
if (import.meta.hot) {
  import.meta.hot.dispose(() => audio.stopBgm());
}
