/**
 * 받침에 맞는 조사 붙이기. "닭이 · 염소가", "감을 · 사과를", "레벨 2가 · 레벨 3이".
 *
 * 이름이 바뀌어도 맞게 나오도록, 이름 뒤에 조사를 직접 적지 말고 이것을 쓴다.
 * "을(를)" 처럼 괄호로 쓰면 2학년이 읽기 어렵다.
 */

export type JosaPair = '이/가' | '을/를' | '은/는' | '과/와' | '으로/로' | '이에요/예요' | '이랑/랑' | '아/야';

/** 받침 번호. 0 이면 받침 없음, 8 은 ㄹ (으로/로 고를 때만 따로 본다) */
const NO_FINAL = 0;
const RIEUL = 8;

/** 숫자는 읽는 소리로: 일(ㄹ) 이 삼(ㅁ) 사 오 육(ㄱ) 칠(ㄹ) 팔(ㄹ) 구, 0 으로 끝나면 영 · 십 · 백 · 천 · 만 (모두 받침 있음) */
const DIGIT_FINAL = [21, RIEUL, NO_FINAL, 16, NO_FINAL, NO_FINAL, 1, RIEUL, RIEUL, NO_FINAL];

function finalOf(word: string): number {
  const text = word.trim();
  const last = text.charCodeAt(text.length - 1);
  if (last >= 0xac00 && last <= 0xd7a3) return (last - 0xac00) % 28;
  if (last >= 0x30 && last <= 0x39) {
    const digits = /(\d+)$/.exec(text)?.[1] ?? '';
    const n = Number(digits);
    // 10 · 20 · 100 처럼 0 으로 끝나면 십 · 백 … (받침 있음). 0 하나는 영
    return n % 10 === 0 ? (n === 0 ? 21 : 17) : DIGIT_FINAL[n % 10];
  }
  return NO_FINAL; // 영어 · 기호는 받침 없는 것으로 본다
}

/** 조사만. 앞 단어를 다른 모양(굵게 등)으로 따로 보여 줄 때 */
export function particle(word: string, pair: JosaPair): string {
  const [withFinal, withoutFinal] = pair.split('/');
  const final = finalOf(word);
  if (pair === '으로/로') return final === NO_FINAL || final === RIEUL ? withoutFinal : withFinal;
  return final === NO_FINAL ? withoutFinal : withFinal;
}

/** 단어 + 조사. josa('닭', '이/가') → "닭이" */
export function josa(word: string, pair: JosaPair): string {
  return `${word}${particle(word, pair)}`;
}
