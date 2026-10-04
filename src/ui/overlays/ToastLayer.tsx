/**
 * 짧은 알림. 화면을 막지 않고 위쪽에 잠깐 떴다 사라진다. (명세 60)
 * 가게 · 가방 같은 창이 열려 있으면 창 위쪽 탭을 가리지 않게 아래쪽(돈 · 닫기 버튼 사이)에 띄운다.
 */
import { useEffect } from 'react';
import { useUiStore } from '@/state/uiStore';
import type { ToastTone } from '@/bridge/events';

/** 안내를 띄워 두는 기본 시간. 길게 보여야 하면 pushToast 에서 durationMs 로 늘린다. */
const DEFAULT_TOAST_MS = 2400;

const TONE_STYLE: Record<ToastTone, string> = {
  info: 'bg-cream',
  reward: 'bg-gold',
  warn: 'bg-blossom',
};

export function ToastLayer(): React.ReactElement {
  const toasts = useUiStore((s) => s.toasts);
  const dismissToast = useUiStore((s) => s.dismissToast);
  const overlayOpen = useUiStore((s) => s.overlay !== null);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((toast) =>
      window.setTimeout(() => dismissToast(toast.id), toast.durationMs ?? DEFAULT_TOAST_MS),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [toasts, dismissToast]);

  return (
    // z-[48]: 가게 · 가방 창(z-40)과 레벨업(z-45) 위에 보이고, 문제 창(z-50)은 가리지 않는다
    <div
      className={`pointer-events-none absolute inset-x-0 z-[48] flex items-center gap-2 ${
        overlayOpen ? 'bottom-[52px] flex-col-reverse' : 'top-[104px] flex-col'
      }`}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          // 사라지는 연출 길이를 표시 시간과 맞춘다.
          style={{ animationDuration: `${toast.durationMs ?? DEFAULT_TOAST_MS}ms` }}
          className={`animate-rise-fade rounded-2xl border-4 border-ink px-6 py-2.5 shadow-[0_6px_0_rgba(74,58,47,0.28)] ${TONE_STYLE[toast.tone]}`}
        >
          <p className="font-game text-[1.35rem] text-ink">{toast.text}</p>
        </div>
      ))}
    </div>
  );
}
