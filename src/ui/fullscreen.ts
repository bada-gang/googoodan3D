/**
 * 전체화면 전환.
 *
 * 태블릿 브라우저는 주소창·도구모음이 화면 위아래를 먹어서 게임이 잘려 보인다.
 * 전체화면으로 들어가면 그 공간이 사라진다.
 *
 * 두 가지 제약이 있다.
 *  - 브라우저는 **사용자가 화면을 만진 직후에만** 전체화면을 허용한다.
 *    그래서 페이지가 뜨자마자 자동으로 들어갈 수는 없고, 첫 터치에 걸어 둔다.
 *  - 아이폰 사파리는 이 기능 자체가 없다. 없으면 조용히 넘어간다.
 */

type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenEl = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function doc(): FullscreenDoc {
  return document as FullscreenDoc;
}

function root(): FullscreenEl {
  return document.documentElement as FullscreenEl;
}

export function isFullscreenSupported(): boolean {
  const el = root();
  return typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function';
}

export function isFullscreen(): boolean {
  const d = doc();
  return Boolean(d.fullscreenElement ?? d.webkitFullscreenElement);
}

/** 실패해도 예외를 던지지 않는다 — 전체화면이 안 돼도 게임은 그대로 돌아가야 한다. */
export async function enterFullscreen(): Promise<boolean> {
  if (!isFullscreenSupported() || isFullscreen()) return isFullscreen();
  const el = root();
  try {
    await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
    return true;
  } catch {
    // 사용자 제스처 없이 호출됐거나 브라우저가 거부한 경우
    return false;
  }
}

export async function exitFullscreen(): Promise<void> {
  if (!isFullscreen()) return;
  const d = doc();
  try {
    await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
  } catch {
    // 이미 빠져나왔거나 브라우저가 거부한 경우
  }
}

export async function toggleFullscreen(): Promise<void> {
  if (isFullscreen()) await exitFullscreen();
  else await enterFullscreen();
}

/** 전체화면 상태가 바뀔 때 알려 준다 (ESC 로 빠져나가는 경우 포함). */
export function onFullscreenChange(listener: () => void): () => void {
  document.addEventListener('fullscreenchange', listener);
  document.addEventListener('webkitfullscreenchange', listener);
  return () => {
    document.removeEventListener('fullscreenchange', listener);
    document.removeEventListener('webkitfullscreenchange', listener);
  };
}

/**
 * 첫 터치에 전체화면으로 들어간다. 브라우저가 제스처를 요구하므로 앱 시작 시 자동 진입은 이 방법뿐이다.
 *
 * 터치는 손가락을 **뗄 때**(pointerup · touchend · click)만 사용자 동작으로 인정된다. 닿는 순간(pointerdown)에
 * 부르면 마우스(PC)에서는 되지만 태블릿에서는 거부된다. 그래서 뗄 때 부르고,
 * 거부되면(다른 창이 떠 있었다 등) 다음 터치에서 다시 시도한다. 한 번 들어가면 더 시도하지 않는다.
 */
export function enterFullscreenOnFirstTouch(shouldEnter: () => boolean): () => void {
  const events = ['pointerup', 'touchend', 'click', 'keydown'] as const;
  let trying = false;
  const attempt = () => {
    if (isFullscreen()) {
      detach();
      return;
    }
    if (trying || !shouldEnter()) return;
    trying = true;
    void enterFullscreen().then((entered) => {
      trying = false;
      if (entered) detach();
    });
  };
  const detach = () => {
    for (const type of events) window.removeEventListener(type, attempt);
  };
  for (const type of events) window.addEventListener(type, attempt);
  return detach;
}
