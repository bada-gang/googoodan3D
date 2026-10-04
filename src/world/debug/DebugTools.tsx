/**
 * 캔버스 안에 두는 측정 · 개발 도구: 그린 횟수 세기(?fps), 30fps 고정(?cap30), 콘솔 손잡이(__googooR3f).
 */
import { useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { frameStats } from './testFlags';

/** 그린 횟수를 센다 (?fps 표시용) */
export function FrameCounter(): null {
  useFrame(() => {
    frameStats.rendered += 1;
  });
  return null;
}

/**
 * 정해진 fps 로만 그린다 (?cap30). 60Hz 화면에서 30 이면 모든 그림이 똑같이 두 번씩 보여
 * 움직임 간격이 일정해진다 — fps 가 40~50 처럼 주사율과 안 맞으면 간격이 들쭉날쭉해 겹쳐 보인다.
 */
export function FrameCap({ fps }: { fps: number }): null {
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    const interval = 1000 / fps;
    let last = 0;
    let id = requestAnimationFrame(function tick(now) {
      // 화면 갱신 시각이 조금씩 흔들려도 박자를 놓치지 않게 여유(2ms)를 둔다
      if (now - last >= interval - 2) {
        last = now;
        advance(now);
      }
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [advance, fps]);
  return null;
}

/** 개발 중 콘솔에서 프레임을 직접 돌려 볼 수 있게 한다 (화면이 숨겨진 창에서 시험할 때) */
export function DevHandle(): null {
  const state = useThree();
  useEffect(() => {
    (window as unknown as { __googooR3f?: unknown }).__googooR3f = state;
  }, [state]);
  return null;
}
