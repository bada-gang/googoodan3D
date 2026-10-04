# 구구 마을 3D

초등학교 2학년 곱셈구구 성장형 게임 [구구 마을](../googoo)의 3D 판. 태블릿 웹브라우저(가로 화면) 전용.

## 실행

```bash
npm install
```

```bash
npm run dev
```

선생님 화면은 `http://localhost:5173/teacher.html`.

## 기술 구성

```
Vite + React 19 + TypeScript + Tailwind CSS 4 + three.js (React Three Fiber · drei) + Zustand
```

| 영역 | 담당 |
| --- | --- |
| `src/world/` | 3D 월드 (React Three Fiber): 장면(마당 · 집 · 시장), 캐릭터, 빛 · 그림자 · 밤낮 |
| `src/ui/` | 시작 화면, HUD, 문제 팝업, 가게 · 가방 · 꾸미기 · 설정 창 |
| `src/state/` | 게임 상태(주제별 조각은 `state/game/`) · 자동 저장 |
| `src/config/` | 밸런스 · 상품 목록 · 배치 · 모델 목록 |
| `src/math/` `src/bridge/` | 출제기 · 월드↔UI 이벤트 약속 |
| `src/data/` | 저장소. 지금은 이 기기(localStorage)만. 학급 서버는 나중 단계 |

**무엇을 고치려면 어느 파일인지는 [CODE_MAP.md](CODE_MAP.md).**

## 그림

- 모양(집·나무·동물·캐릭터·가구)은 생성 그림을 이 PC 의 Hunyuan3D 로 3D 로 바꿔 만든다 (`npm run model`).
- 아이콘·질감·배경 이미지는 Codex(ChatGPT 구독)의 이미지 생성으로 만든다. 목록은 `src/config/assets.ts`.
- 아직 없는 그림은 점선 동그라미 임시 그림으로 보인다.

```bash
npm run art
```

자세한 사용법은 [ART_DIRECTION.md](ART_DIRECTION.md) 10번.
유료 API 로 만들 때만 `.env.local` 에 `OPENAI_API_KEY` 가 필요하다.
**`VITE_` 를 붙이지 않는다** — 붙이면 키가 학생 브라우저로 내려간다.

## 진행 단계

- [x] 0. 뼈대 — 2D 판 코드 이식, Phaser 제거, 3D 캔버스
- [x] 1. 아트 파이프라인 — 3D 아트 가이드, 이미지 생성(`npm run art`), 3D 모델 생성(`npm run model`)
- [x] 2. 마당 + 조작 — 캐릭터 6종(자동 뼈대로 팔다리 동작), 조이스틱·땅 톡·키보드 이동, 밭 심기·물 주기·수확
- [x] 3. 농장 · 동물 — 나무 6종 단계별 모델(열매 달기), 동물 4종(돌아다니기·먹이 주기·생산물 받기), 헛간·여물통. 시험용 `?dev-animals`
- [x] 4. 집 내부 · 꾸미기 — 가구 놓기 · 옮기기 · 돌리기 · 치우기, 벽지 · 바닥, 벽 장식
- [x] 5. 시장 · 상점 — 농장 가게 · 가구 가게 건물
- [ ] 6. 미니게임 — 보류
- [x] 7. 밤낮 · 연출 · 소리 — 12분 순환, 별 · 물방울 효과, 무료 공개 음원(출처는 설정 화면)
- [x] 8. 성능 — 화질 보통 고정, 미리 그린 그림자, 그림자용 저해상도 사본, 정적 모양 합치기
- [ ] 9. 배포 · 학급 서버 저장
