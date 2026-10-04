/**
 * Codex 로 그림 한 장 만들기. 이미지 생성(gen-art)과 3D 원본 그림(gen-model)이 함께 쓴다.
 *
 * 이 PC 에 ChatGPT 계정으로 로그인된 Codex 의 내장 이미지 생성을 쓰므로 따로 요금이 없다.
 * 그림은 CODEX_HOME/generated_images/<thread>/ 에 생긴다.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CODEX_HOME = process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex');
/** 한 장이 이보다 오래 걸리면 멈춘 것으로 본다 */
const CODEX_TIMEOUT_MS = 6 * 60_000;

/**
 * codex 실행 파일. PATH 에 없으면 데스크톱 앱이 깔아 둔 것을 찾는다.
 * 앱이 업데이트되면 bin 아래 폴더 이름이 바뀌므로 가장 최근 것을 고른다.
 */
export function findCodex(): string {
  if (process.env.CODEX_BIN) return process.env.CODEX_BIN;
  const binRoot = path.join(process.env.LOCALAPPDATA ?? '', 'OpenAI', 'Codex', 'bin');
  if (existsSync(binRoot)) {
    const candidates = readdirSync(binRoot)
      .map((dir) => path.join(binRoot, dir, 'codex.exe'))
      .filter((file) => existsSync(file))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    if (candidates[0]) return candidates[0];
  }
  return 'codex';
}

export interface CodexImageRequest {
  /** 그림 설명 (화풍 문장까지 포함한 전체) */
  description: string;
  aspect: 'square' | 'landscape';
  transparent: boolean;
}

/** codex 에게 "그림만 한 장 만들고 끝내라" 고 시키는 지시문 */
export function codexImagePrompt(request: CodexImageRequest): string {
  const shape =
    request.aspect === 'landscape' ? 'Wide landscape 3:2 image (1536x1024).' : 'Square 1:1 image (1024x1024).';
  const background = request.transparent
    ? 'Fully transparent background with a real alpha channel.'
    : 'Fully opaque image, no transparency.';
  return (
    'Use your built-in image generation tool to generate exactly one image, then stop. ' +
    'Do not write code, run scripts, or create or edit any files. ' +
    'If the image cannot be generated, explain why in one sentence.\n\n' +
    `Image request: ${request.description} ${shape} ${background}`
  );
}

interface CodexEvent {
  type?: string;
  thread_id?: string;
  item?: { type?: string; text?: string };
  error?: { message?: string };
  message?: string;
}

export interface CodexImageResult {
  image: Buffer;
  prompt: string;
  threadId: string;
  file: string;
}

/**
 * codex exec 를 한 번 돌려 그림 한 장을 받는다.
 * workDir 는 codex 가 읽기 전용으로 머무는 빈 폴더다.
 */
export function generateImageWithCodex(
  codexBin: string,
  request: CodexImageRequest,
  workDir: string,
): Promise<CodexImageResult> {
  const prompt = codexImagePrompt(request);
  mkdirSync(workDir, { recursive: true });

  return new Promise((resolve, reject) => {
    const child = spawn(
      codexBin,
      [
        'exec',
        '--skip-git-repo-check',
        '--json',
        // 그림만 받으면 된다. 파일을 고치거나 명령을 실행할 일이 없다.
        '-s',
        'read-only',
        '-c',
        'model_reasoning_effort="low"',
        '-C',
        workDir,
        prompt,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    const timer = setTimeout(() => child.kill(), CODEX_TIMEOUT_MS);

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`codex 를 실행하지 못했습니다 (${error.message}). CODEX_BIN 으로 경로를 지정하세요.`));
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const events: CodexEvent[] = stdout
        .split('\n')
        .filter((line) => line.startsWith('{'))
        .map((line) => {
          try {
            return JSON.parse(line) as CodexEvent;
          } catch {
            return {};
          }
        });
      const threadId = events.find((e) => e.type === 'thread.started')?.thread_id;
      const imageDir = threadId ? path.join(CODEX_HOME, 'generated_images', threadId) : null;
      const images =
        imageDir && existsSync(imageDir)
          ? readdirSync(imageDir)
              .filter((f) => f.toLowerCase().endsWith('.png'))
              .map((f) => path.join(imageDir, f))
              .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
          : [];

      if (threadId && images[0]) {
        resolve({ image: readFileSync(images[0]), prompt, threadId, file: images[0] });
        return;
      }

      // 그림이 안 나온 이유: 거절 메시지, 사용량 한도, 로그인 만료 등
      const said = events
        .filter((e) => e.item?.type === 'agent_message' && e.item.text)
        .map((e) => e.item!.text)
        .pop();
      const failed = events.find((e) => e.type === 'turn.failed' || e.type === 'error');
      const reason =
        failed?.error?.message ??
        failed?.message ??
        said ??
        (stderr.trim().split('\n').pop() || `codex 종료 코드 ${code}`);
      reject(new Error(reason));
    });
  });
}
