/**
 * 활성 저장소 제공자.
 *
 * 지금은 이 기기(localStorage)에만 저장한다. 서버 저장(Firebase)은 나중 단계에서 붙인다.
 * 그때도 게임/UI 코드는 항상 repositories() 만 호출하므로 이 파일만 바뀐다.
 */
import { createLocalRepositories } from './local/LocalRepositories';
import type { RepositoryBundle } from './repositories';

export type StorageMode = 'firebase' | 'local';

let active: RepositoryBundle = createLocalRepositories();
let mode: StorageMode = 'local';

export function repositories(): RepositoryBundle {
  return active;
}

export function storageMode(): StorageMode {
  return mode;
}

export function setRepositories(bundle: RepositoryBundle, nextMode: StorageMode = 'local'): void {
  active = bundle;
  mode = nextMode;
}

/** 앱 시작 시 한 번 호출한다. 서버 저장이 붙기 전까지는 이 기기 저장 그대로 둔다. */
export async function initRepositories(): Promise<StorageMode> {
  return mode;
}

export type { RepositoryBundle } from './repositories';
