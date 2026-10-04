/**
 * 생성이 끝난 3D 모델 키 목록 (public/assets/model-manifest.json).
 *
 * three.js 를 불러오지 않는 가벼운 파일이다. 앱 시작(main.tsx)에서 읽어도
 * 첫 화면 번들에 three.js 가 실리지 않는다.
 */
import { ASSET_BASE_URL } from './assets';
import { MODEL_MANIFEST_URL, MODEL_SPEC_BY_KEY } from './models';

let ready = new Set<string>();

/** 앱 시작 시 한 번 호출. 파일이 없거나 느려도 게임 시작을 막지 않는다. */
export async function loadModelManifest(timeoutMs = 2000): Promise<void> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(MODEL_MANIFEST_URL, { cache: 'no-cache', signal: controller.signal });
    if (!response.ok) return;
    const manifest = (await response.json()) as { ready?: string[] };
    ready = new Set(manifest.ready ?? []);
  } catch {
    // 매니페스트가 없어도 정상. 임시 모양으로 동작한다.
  } finally {
    window.clearTimeout(timer);
  }
}

/** 준비된 모델의 파일 주소. 아직 없으면 null */
export function modelUrl(key: string): string | null {
  const spec = MODEL_SPEC_BY_KEY[key];
  if (!spec || !ready.has(key)) return null;
  return ASSET_BASE_URL + spec.path;
}
