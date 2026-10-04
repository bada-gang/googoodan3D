/**
 * 실제 아트가 준비된 에셋 키 목록.
 * React UI 도 3D 월드와 같은 그림을 쓰도록 여기서 한 번만 읽는다. (Phase 7)
 */
import { ART_MANIFEST_URL, ASSET_BASE_URL, ASSET_SPEC_BY_KEY, type ArtManifestFile } from './assets';

let ready = new Set<string>();

export function setArtReady(keys: string[]): void {
  ready = new Set(keys);
}

export function isArtReady(key: string): boolean {
  return ready.has(key);
}

/** 실제 이미지 파일 URL */
export function realAssetUrl(key: string): string | null {
  const spec = ASSET_SPEC_BY_KEY[key];
  if (!spec) return null;
  return ASSET_BASE_URL + spec.path;
}

/** 아직 그림이 준비되지 않은 키 수. 설정 화면에서 "임시 그림" 안내를 띄우는 데 쓴다. */
export function missingArtCount(): number {
  return Object.keys(ASSET_SPEC_BY_KEY).filter((key) => !ready.has(key)).length;
}

/** 앱 시작 시 한 번 호출. 파일이 없거나 느려도 게임 시작을 막지 않는다. */
export async function loadArtManifest(timeoutMs = 2000): Promise<void> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(ART_MANIFEST_URL, {
      cache: 'no-cache',
      signal: controller.signal,
    });
    if (!response.ok) return;
    const manifest = (await response.json()) as ArtManifestFile;
    setArtReady(manifest.ready ?? []);
  } catch {
    // 매니페스트가 없어도 정상. 임시 아트로 동작한다.
  } finally {
    window.clearTimeout(timer);
  }
}
