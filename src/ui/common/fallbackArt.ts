/**
 * 이미지가 아직 생성되지 않았을 때 쓰는 임시 그림.
 *
 * 둥근 바탕 + 글자 두 개만 그린다. 최종 그림처럼 보이면 안 된다 — 빠진 그림이 눈에 띄어야
 * 생성 스크립트를 돌릴 때 놓치지 않는다. (ART_DIRECTION 13-10)
 */
import { PALETTE } from '@/config/artTokens';
import type { CharacterId } from '@/types/game';

const OUTLINE_COLOR = PALETTE.outline;

function svgUrl(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** 아이콘 자리 임시 그림 */
export function fallbackIcon(label: string, color: string): string {
  const text = [...label].slice(0, 2).join('');
  return svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">` +
      `<circle cx="48" cy="48" r="40" fill="${color}" stroke="${OUTLINE_COLOR}" stroke-width="4" stroke-dasharray="8 6"/>` +
      `<text x="48" y="58" text-anchor="middle" font-family="Jua, sans-serif" font-size="28" fill="${OUTLINE_COLOR}">${text}</text>` +
      `</svg>`,
  );
}

/** 반복 질감 자리 임시 그림. 색만 칠한다. */
export function fallbackSwatch(color: string): string {
  return svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${color}"/></svg>`,
  );
}

/** 캐릭터마다 옷 색. 3D 모델이 생기면 그 모델을 찍은 그림으로 바뀐다. */
const CHARACTER_COLOR: Record<CharacterId, { body: string; head: string }> = {
  boy: { body: '#7fb8e6', head: '#6b4632' },
  girl: { body: '#f6a8bd', head: '#835a41' },
  farmer: { body: '#8fd8c4', head: '#f6c453' },
  dino: { body: '#8ed486', head: '#6fbf6a' },
  bunny: { body: '#fdfaf2', head: '#f6a8bd' },
  astro: { body: '#e8e8f0', head: '#b8a0e0' },
};

/** 캐릭터 고르기 자리 임시 그림 */
export function fallbackCharacter(id: CharacterId): string {
  const { body, head } = CHARACTER_COLOR[id];
  return svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 160">` +
      `<ellipse cx="60" cy="152" rx="30" ry="6" fill="rgba(74,58,47,0.22)"/>` +
      `<rect x="34" y="80" width="52" height="68" rx="22" fill="${body}" stroke="${OUTLINE_COLOR}" stroke-width="4"/>` +
      `<circle cx="60" cy="56" r="32" fill="#f6d3ae" stroke="${OUTLINE_COLOR}" stroke-width="4"/>` +
      `<path d="M28 52 Q60 10 92 52 Q76 34 60 34 Q44 34 28 52Z" fill="${head}" stroke="${OUTLINE_COLOR}" stroke-width="4" stroke-linejoin="round"/>` +
      `<circle cx="49" cy="60" r="4" fill="${OUTLINE_COLOR}"/><circle cx="71" cy="60" r="4" fill="${OUTLINE_COLOR}"/>` +
      `</svg>`,
  );
}
