/**
 * 3D 판 Firestore 컬렉션 이름.
 * 2D 판(googoodan)과 같은 프로젝트를 쓰므로 이름 끝에 3d 를 붙여 따로 둔다 — 저장 데이터 모양이 달라 섞이면 안 된다.
 * 보안 규칙(firestore.rules)의 경로와 같아야 한다.
 */
export const PLAYERS = 'players3d';
export const SAVES = 'saves3d';
export const STATS = 'stats3d';
/** 학급 목록 (선생님이 만든 반들). 학생 문서의 classId 가 이 문서 id 를 가리킨다 */
export const CLASSES = 'classes3d';
