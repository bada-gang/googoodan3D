# 코드 지도

고치거나 더하려는 것이 어느 파일에 있는지 찾는 문서. 파일마다 맨 위 주석에 그 파일이 하는 일이 한두 줄로 적혀 있다.

## 한눈에 보기

```
src/
  config/        숫자 · 목록 · 이름 (밸런스, 상품 목록, 배치, 모델 목록) ← 내용 바꾸기는 대부분 여기
  types/         게임 데이터 모양 (타입)
  math/          문제 출제기(곱셈구구 · 나눗셈 · 받아내림 뺄셈) · 오답 선택지 · 연습 필요 판단
  state/         게임 상태(저장되는 것) · UI 상태 · 기기 설정 · 자동 저장
    game/          게임 상태를 주제별로 나눈 조각 (세션 · 진행 · 가방 · 밭 · 동물 · 꾸미기 · 학습)
  data/          저장소 (Firebase 서버 저장, 안 되면 이 기기 localStorage 로 자동 전환)
  bridge/        3D 월드 ↔ React UI 이벤트 약속
  audio/         효과음 · 배경음
  ui/            React 화면: 시작 화면, HUD, 문제 팝업, 가게 · 가방 · 꾸미기 · 설정 창
  world/         3D 월드 (React Three Fiber)
    scenes/        장면별 내용: yard(마당 · 밭 · 동물 우리), home(집 안), town(시장)
    player/        내 캐릭터
    systems/       카메라 · 입력 · 이동 · 상호작용(가까이 가면 뜨는 버튼)
    gameplay/      월드 공통 규칙(문제 풀기 · 경험치 · 알림), 꾸미기(가구 놓기)
    effects/       별 터지기 · 물방울 · 떠오르는 글자 · 느낌표
    rendering/     빛 · 그림자 · 밤낮 · 모델과 질감 불러오기
    props/         여러 장면이 같이 쓰는 소품(땅 · 길 · 표지판)
    state/         매 프레임 쓰는 위치 · 장애물, 장면 바꾸기
    debug/         fps 측정 · 개발용 주소 옵션
  teacher/       선생님 화면 (teacher.html) — 학급 만들기 · 반별 학생 · 기록
scripts/         그림 · 3D 모델 · 소리 만드는 도구 (npm run art / model / audio)
  lib/             단계별 도구 (3D 변환, 모양 다듬기, 색 보정, 그림자 사본, 자동 뼈대, Codex, 아이콘)
dev/             개발 중 확인용 페이지 (그림 모아보기, 모델 미리보기)
public/assets/   게임이 읽는 완성 파일 (그림 · 모델 · 소리)
art-src/         생성 원본 (git 에 안 들어감 — 아래 "백업" 참고)
```

## 무엇을 고치려면 어느 파일

### 숫자 · 내용 바꾸기

| 하고 싶은 것 | 파일 |
| --- | --- |
| 돈 · 경험치 · 레벨 · 수확량 · 상자 보상 · 출제 비율 | `src/config/balance.ts` |
| 나무 · 동물 · 가구 · 벽지/바닥 · 물/먹이의 이름과 가격 | `src/config/catalog.ts` |
| 물고기 (이름 · 값 · 무는 정도 · 막대 빠르기와 칸 너비) · 하루 낚시 횟수 | `src/config/fishing.ts` |
| 마당 · 시장 배치 (밭 자리, 우리 크기, 건물 위치) | `src/config/layout.ts` |
| 가구의 3D 크기와 놓는 방식 (바닥/벽) | `src/config/furniture3d.ts` |
| 3D 모델 목록 · 크기 · 색 보정 | `src/config/models.ts` |
| 그림(아이콘 · 질감) 목록 | `src/config/assets.ts` |
| 밤낮 길이 · 하늘색 | `src/config/dayNight.ts` |
| 화면 글자 (게임 이름, 구역 이름, 캐릭터 이름) | `src/config/strings.ts` |
| 학기 중 켜고 끄는 기능 (새 이름 만들기, 구역 표지판) | `src/config/features.ts` |
| 출처 표기 | `src/config/credits.ts` |
| 색 팔레트 | `src/config/artTokens.ts` (UI 쪽 같은 값: `src/styles/index.css`) |

### 게임 규칙

| 하고 싶은 것 | 파일 |
| --- | --- |
| 심기 · 물 주기 · 수확 규칙 (상태 변화) | `src/state/game/farmSlice.ts` |
| 밭에서 뜨는 버튼 · 문제 내기 · 연출 | `src/world/scenes/yard/farm/farmActions.ts` |
| 먹이 주기 · 생산물 규칙 (상태 변화) | `src/state/game/animalSlice.ts` |
| 동물에게 뜨는 버튼 · 문제 내기 · 연출 | `src/world/scenes/yard/pen/animalActions.ts` |
| 사고팔기 · 가방 | `src/state/game/inventorySlice.ts` |
| 낚시 횟수 · 물고기 도감 (저장되는 것) | `src/state/game/fishingSlice.ts` |
| 낚시 한 번의 진행 (던지기 → 입질 → 끌어올리기) | `src/state/fishingStore.ts` |
| 돈 · 경험치 · 레벨업 · 상자 | `src/state/game/progressSlice.ts` |
| 가구 놓기 · 옮기기 · 돌리기 · 치우기 (저장되는 것) | `src/state/game/decorateSlice.ts` |
| 꾸미기 조작 (3D 에서 들고 다니기, 놓을 수 있는지) | `src/world/gameplay/decorate.tsx` |
| 저장 데이터 모양 · 옛 저장본 고치기 | `src/state/game/saveData.ts` |
| 자동 저장 시점 | `src/state/persistence.ts` |
| 문제 출제 (어떤 문제를 낼지, 고른 묶음끼리 같은 확률) | `src/math/questionGenerator.ts` |
| 나눗셈 · 뺄셈 묶음 (문제 범위 · 헷갈리는 오답 · 힌트) | `src/math/problemSets.ts` |
| 묶음 이름 · 예시 (선택 화면 · 교사 화면) | `src/config/curriculum.ts` |
| 출제기 점검 (정답 · 선택지 확인, 유형별 비율): `npx tsx --tsconfig tsconfig.scripts.json scripts/check-questions.ts` | `scripts/check-questions.ts` |
| 조사 (닭이 · 염소가, 레벨 2가): 이름 뒤에 조사를 직접 쓰지 말고 `josa(이름, '이/가')`. 점검: `npx tsx --tsconfig tsconfig.scripts.json scripts/check-josa.ts` | `src/config/josa.ts`, `scripts/check-josa.ts` |
| 오답 선택지 | `src/math/distractors.ts` |
| 정답/오답 처리 흐름 | `src/ui/mathFlow.ts` |
| 학습 기록 (정답률 · 오답 복습) | `src/state/game/learningSlice.ts` |

### 3D 화면

| 하고 싶은 것 | 파일 |
| --- | --- |
| 마당 전체 배치 (집 · 길 · 표지판 · 덤불) | `src/world/scenes/yard/YardWorld.tsx` |
| 밭 흙 · 테두리 모양 | `src/world/scenes/yard/farm/PlotBeds.tsx` |
| 나무 모양 · 흔들림 · 단계별 크기 | `src/world/scenes/yard/farm/Tree.tsx` |
| 열매 위치 · 색 · 수확할 때 날아가기 | `src/world/scenes/yard/farm/Fruits.tsx` |
| 울타리 · 헛간 · 여물통 · '마굿간 들어가기' 버튼 거리 | `src/world/scenes/yard/pen/AnimalPen.tsx` |
| 우리 크기 · 문 · 동물 크기와 걷는 빠르기 | `src/world/scenes/yard/pen/penLayout.ts` |
| 동물 움직임 (걷기 · 먹기 · 기뻐하기) | `src/world/scenes/yard/pen/Animal.tsx` |
| 집 안 (방 크기 · 벽 · 문) | `src/world/scenes/home/HomeWorld.tsx` |
| 마굿간 안: 크기 · 카메라 · 물건 자리 · 부딪힘 · 색 (숫자는 여기만) | `src/world/scenes/barn/barnLayout.ts` |
| 마굿간 안: 들어오기 · 나가기, 무엇을 그리는지 | `src/world/scenes/barn/BarnWorld.tsx` |
| 마굿간 안: 바닥 · 벽 · 기둥 · 입구 문짝 · 칸막이 · 다락 · 사다리 | `src/world/scenes/barn/BarnStructure.tsx` |
| 마굿간 안: 건초 · 도구 걸이 · 손수레 등 3D 물건 · 등불 | `src/world/scenes/barn/BarnProps.tsx` (모델: `config/models.ts` 의 `barnProps`) |
| 마굿간 안: 햇빛 줄기 · 바닥 빛 · 먼지 | `src/world/scenes/barn/BarnLight.tsx` (어둡기: `rendering/lighting.tsx` 의 `BARN_LIGHT`) |
| 시장 (가게 건물 · 가로등 · 장식) | `src/world/scenes/town/TownWorld.tsx` |
| 시장 낚시터 (연못 · 데크 · 낚싯대 · 찌) | `src/world/scenes/town/FishingSpot.tsx` (자리: `config/layout.ts` 의 `TOWN.pond`) |
| 땅 · 흙길 | `src/world/props/Ground.tsx` |
| 맵을 둘러싼 숲 벽 (앞줄 3D 나무 · 뒷줄 침엽수 모델, 12m 토막으로 화면 밖 안 그림 · 어두워지는 잔디 숲 바닥, 길 틈) | `src/world/props/ForestWall.tsx` |
| 표지판 | `src/world/props/SignBoard.tsx` |
| 내 캐릭터 (걷는 동작 · 밭 위 높이) | `src/world/player/Player.tsx` |
| 걷는 빠르기 · 부딪힘 | `src/world/systems/movement.ts` |
| 카메라 거리 · 각도 | `src/world/systems/CameraRig.tsx` (고정 카메라: 집 안 `HomeWorld.tsx` 의 `HOME_VIEW`, 마굿간 `barnLayout.ts` 의 `BARN_VIEW`) |
| 가까이 가면 뜨는 버튼의 거리 | `src/world/systems/interaction.tsx` |
| 별 터지기 · 물방울 개수 | `src/world/effects/particles.tsx` |
| 떠오르는 글자 · 느낌표 | `src/world/effects/effects.tsx` |
| 해 · 그림자 범위 · 환경맵 | `src/world/rendering/lighting.tsx` |
| 미리 그린 그림자 (건물 · 울타리 · 덤불) | `src/world/rendering/bakedShadows.tsx`, `groundShadow.ts` |
| 그림자용 저해상도 사본 | `src/world/rendering/shadowProxies.ts` (만드는 쪽: `scripts/lib/shadowProxy.ts`) |
| 밤낮 색 · 별 · 밤 불빛 | `src/world/rendering/dayNight.tsx` |
| 모델 · 질감 불러오기 | `src/world/rendering/assets.tsx` |
| 캔버스 설정 (화질 · 그림자 방식) | `src/world/WorldRoot.tsx`, `src/world/GameCanvas.tsx` |
| 장면 바꾸기 (마당 ↔ 집 · 마굿간 · 시장) | `src/world/state/scenes.ts` (지붕 아래 장면 목록: `sceneStore.ts` 의 `isIndoorScene`) |

### React 화면

| 하고 싶은 것 | 파일 |
| --- | --- |
| 반 고르기 → 반 비밀번호(숫자 4자리, 있으면) → 이름 고르기 → 연습할 것 고르기(구구단 · 나눗셈 · 뺄셈) → 게임 (학급이 없으면 반 고르기를 건너뜀) | `src/App.tsx`, `src/ui/screens/` |
| 학생이 이름 · 캐릭터 바꾸기 (연습할 것 고르기 화면) | `src/ui/screens/TableSelectScreen.tsx` |
| 학급 만들기 · 이름 · 비밀번호 바꾸기 · 지우기, 학생 반 옮기기 (선생님 화면) | `src/teacher/ClassBar.tsx`, `src/teacher/StudentDetail.tsx` |
| 위쪽 HUD (돈 · 레벨) | `src/ui/hud/GameHUD.tsx` |
| 조이스틱 · 행동 버튼 | `src/ui/hud/TouchControls.tsx` |
| 문제 팝업 | `src/ui/overlays/MathQuestionOverlay.tsx` |
| 농장 가게 · 가구 가게 · 가방 · 꾸미기 · 설정 창 | `src/ui/overlays/` 의 같은 이름 파일 |
| 낚시 창 (막대 멈추기 · 잡은 물고기 카드) · 물고기 도감(가방 안) | `src/ui/overlays/FishingOverlay.tsx` · `InventoryOverlay.tsx` |
| 알림(토스트) | `src/ui/overlays/ToastLayer.tsx` |
| 공통 버튼 · 창 틀 | `src/ui/common/ui.tsx` |
| 아이콘 고르기 | `src/ui/common/icons.ts` |
| 전체화면 | `src/ui/fullscreen.ts` |
| 효과음 · 배경음 · 음량 | `src/audio/sfx.ts` |
| 3D ↔ UI 사이 이벤트 종류 | `src/bridge/events.ts` |

## 새로 더할 때

- **새 나무 · 동물 · 가구**: `config/catalog.ts` 에 항목 → `config/models.ts` 에 모델 → `npm run model -- --only 키` → (가구면) `config/furniture3d.ts` 에 크기.
- **새 장면**: `src/world/scenes/새장면/` 폴더를 만들고, 장면 이름을 `bridge/events.ts` 의 `SceneKey` · `world/state/sceneStore.ts` 에, 그리기를 `world/WorldRoot.tsx` 에 더한다.
- **새 게임 상태**: 주제에 맞는 `state/game/*Slice.ts` 에 더한다. 저장해야 하면 `types/game.ts` 의 `GameSaveData`, `state/game/saveData.ts`, `sessionSlice.ts` 의 불러오기 · `toSaveData` 를 함께 고친다.
- **서버 저장 (Firebase)**: 2D 판과 같은 프로젝트(googoodan-bada)를 쓴다. 컬렉션 이름은 `src/data/firebase/collections.ts`, 보안 규칙은 `firestore.rules` (이 파일이 기준. 2D 저장소의 옛 사본에는 학급 `classes3d` 가 없어 그걸로 올리면 안 된다). 학급은 `classes3d`, 학생 문서의 `classId` 가 반을 가리킨다. 설정 값은 `.env.local` 과 Netlify 환경변수의 `VITE_FIREBASE_*`. 다른 저장 방식으로 바꾸려면 `src/data/repositories.ts` 를 구현해 `src/data/index.ts` 에서 바꿔 끼운다.

## 명령

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버 (5173). 고치면 바로 반영 |
| `npm run dev:offline` | 서버 저장 없이 이 브라우저에만 저장하는 개발 서버 (5174). 실제 수업 서버의 학생 · 진행도를 건드리지 않고 시험할 때 |
| `npm run preview:lan` | 배포본을 만들어 같은 와이파이의 태블릿에서 열기 (4173) |
| `npm run build` | 타입 검사 + 배포본 만들기 (`dist/`) |
| `npm run art` | 그림 만들기 (Codex) |
| `npm run model` | 3D 모델 만들기 (Hunyuan3D 서버를 먼저 켠다: `F:\ai\hunyuan21\run-googoo-api.bat`) |
| `npm run model -- --reoptimize` | 변환 원본으로 경량화만 다시 (서버 없이) |
| `npm run audio` | 소리 다시 만들기 (`art-src/audio-src` → `public/assets/audio`) |

## 주소 옵션

| 주소 끝에 | 하는 일 | 어디서 |
| --- | --- | --- |
| `?fps` | fps 표시 | 모두 |
| `?noshadow` `?noaa` `?pbrground` `?cap30` | 성능 비교용으로 하나씩 끄거나 바꾸기 | 모두 |
| `?debug` | 오류 자세히 보기, 콘솔 손잡이 | 모두 |
| `?dev-animals` `?dev-furniture` `?dev-ready` | 동물 · 가구 · 다 자란 나무를 바로 받기 | 개발 서버만 |
| `?dev-fish=crown` | 낚시할 때 늘 그것이 문다 (물고기 id: `config/fishing.ts`. 막대 빠르기 시험용) | 개발 서버만 |
| `?daytime=day` / `sunset` / `night` | 시간대 고정 | 개발 서버만 |
| `?fastday=20` | 밤낮을 20배 빠르게 | 개발 서버만 |

정의: `src/world/debug/testFlags.ts`, `src/world/debug/devSetup.ts`.

## 백업

- **코드**: git. 작업 한 덩어리마다 커밋한다. `git log` 로 이력을 본다.
- **생성 원본 `art-src/`**: git 에 넣지 않는다 (크다). 원본 그림 · 3D 변환 원본(`*.raw.glb`) · 원본 소리 · 생성 기록(`log.jsonl`)이 있어서, 지우면 모델을 다시 만들 때 그림 생성 · 3D 변환부터 다시 해야 한다 (몇 시간 걸리고 결과도 달라진다). **지우지 않는다.** `art-src/models/old/` 는 바꾸기 전 원본 그림.
- **`.env.local`**: 열쇠가 들어 있다. git 에 안 들어가고, `VITE_` 를 붙이지 않는다.

## 지켜 온 결정 (다시 바꾸기 전에 확인)

- 화질은 항상 "보통"(해상도 배율 1). 화질 고르기 · 자동 조절은 없앴다.
- 그림자는 매 프레임 갱신한다. 2프레임마다 갱신하면 걷는 캐릭터가 겹쳐 보인다.
- 물체 재질(MeshStandard)과 환경맵은 유지한다. 가볍게 바꾸면 물체 품질이 눈에 띄게 떨어진다. 땅 · 길만 가벼운 재질.
- 시간대 안내 문구 · 열매 맺음 안내와 "열매 맺음" 글자 · 흙먼지 · 나뭇잎 효과는 일부러 뺐다.
- 노을은 "붉은 노을" 시안(`config/dayNight.ts` 의 `SUNSET` · `SUNSET_LIGHT`). 진하기 0.3 을 넘기면 달빛이 섞여 붉은 기운이 빠진다.
- 미니게임(6단계)은 보류. 낚시는 따로 만들었다: 곱셈 문제를 맞혀 찌를 던지고, 잡기는 막대 멈추기(문제 아님). 하루 20번.
