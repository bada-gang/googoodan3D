/**
 * 입력: 조이스틱(React UI 의 move:vector 이벤트)과 키보드를 runtime.input 에 옮긴다.
 * 땅을 톡 치는 이동(input.tapTarget)은 각 장면의 땅 클릭에서 넣는다.
 */
import { useEffect } from 'react';
import { gameEvents } from '@/bridge/eventBus';
import { input, resetInput } from '../state/runtime';

/** 조이스틱(React UI 에서 오는 이벤트)과 키보드를 runtime.input 에 옮긴다 */
export function InputSystem(): null {
  useEffect(() => {
    resetInput();
    const offStick = gameEvents.on('move:vector', (vector) => {
      input.stick = vector;
    });
    const isTyping = (event: KeyboardEvent) =>
      event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
    const down = (event: KeyboardEvent) => {
      if (isTyping(event)) return;
      input.keys.add(event.code);
    };
    const up = (event: KeyboardEvent) => input.keys.delete(event.code);
    // 창을 벗어나면 뗀 키 이벤트를 못 받는다. 계속 걸어가지 않게 비운다
    const blur = () => input.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      offStick();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      resetInput();
    };
  }, []);
  return null;
}
