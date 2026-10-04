/**
 * 성능 측정용 주소 옵션. 태블릿에서 무엇이 무거운지 하나씩 꺼 보며 fps 를 비교한다 (배포본에서도 된다).
 *
 *   ?noshadow  그림자를 끈다
 *   ?noaa      테두리 다듬기(안티에일리어싱)를 끈다
 *   ?pbrground 땅 · 길을 예전 무거운 재질(반사광 계산)로 그린다 (가벼운 재질과 비교용)
 *   ?cap30     30fps 로 고정한다 (fps 가 화면 주사율과 안 맞아 캐릭터가 겹쳐 보이는지 확인용)
 *   ?shadow1   그림자를 매 프레임 다시 그린다 (기본은 2프레임에 한 번)
 *
 * ?fps 와 같이 쓰면 화면 위쪽에 fps 와 꺼 둔 것이 함께 보인다. three.js 를 불러오지 않는 작은 파일이다.
 */
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

export const TEST_FLAGS = {
  noShadow: params.has('noshadow'),
  noAntialias: params.has('noaa'),
  pbrGround: params.has('pbrground'),
  cap30: params.has('cap30'),
  shadowEveryFrame: params.has('shadow1'),
} as const;

/** 켜 둔 측정 옵션 이름 (fps 표시에 덧붙인다) */
export function activeTestFlags(): string[] {
  const names: string[] = [];
  if (TEST_FLAGS.noShadow) names.push('그림자 끔');
  if (TEST_FLAGS.noAntialias) names.push('AA 끔');
  if (TEST_FLAGS.pbrGround) names.push('땅 PBR');
  if (TEST_FLAGS.cap30) names.push('30fps 고정');
  if (TEST_FLAGS.shadowEveryFrame) names.push('그림자 매 프레임');
  return names;
}

/** 3D 화면을 실제로 그린 횟수. ?fps 표시가 읽는다 (화면 주사율이 아니라 게임이 그린 횟수를 보여야 한다) */
export const frameStats = { rendered: 0 };
