/**
 * 성능 측정용 주소 옵션. 태블릿에서 무엇이 무거운지 하나씩 꺼 보며 fps 를 비교한다 (배포본에서도 된다).
 *
 *   ?noshadow  그림자를 끈다
 *   ?noaa      테두리 다듬기(안티에일리어싱)를 끈다
 *   ?pbrground 땅 · 길을 예전 무거운 재질(반사광 계산)로 그린다 (가벼운 재질과 비교용)
 *
 * ?fps 와 같이 쓰면 화면 위쪽에 fps 와 꺼 둔 것이 함께 보인다. three.js 를 불러오지 않는 작은 파일이다.
 */
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

export const TEST_FLAGS = {
  noShadow: params.has('noshadow'),
  noAntialias: params.has('noaa'),
  pbrGround: params.has('pbrground'),
} as const;

/** 켜 둔 측정 옵션 이름 (fps 표시에 덧붙인다) */
export function activeTestFlags(): string[] {
  const names: string[] = [];
  if (TEST_FLAGS.noShadow) names.push('그림자 끔');
  if (TEST_FLAGS.noAntialias) names.push('AA 끔');
  if (TEST_FLAGS.pbrGround) names.push('땅 PBR');
  return names;
}
