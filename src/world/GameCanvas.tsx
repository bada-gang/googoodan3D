/**
 * 3D 월드 캔버스. React UI 레이어 아래에 깔린다. (명세 68)
 *
 * three.js 는 무거우므로 게임 화면에 들어올 때 불러온다 (React.lazy).
 * 월드는 React UI 를 직접 만지지 않고 bridge/events 의 이벤트만 주고받는다. (명세 71)
 *
 * 3D 쪽에서 오류가 나면 게임 화면 전체가 사라지지 않게 여기서 막고, 다시 불러오기를 안내한다.
 * 그래픽 메모리가 모자라 3D 화면이 끊긴 경우(WebGL context lost)도 같은 안내를 띄운다.
 */
import { Component, Suspense, lazy, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { useQuality } from './core/quality';
import { SCENE_FADE_MS, useWorldScene } from './core/sceneStore';

const WorldRoot = lazy(() => import('./WorldRoot'));

/** 주소에 ?fps 를 붙이면 화면 구석에 초당 프레임 수와 화질 단계를 보인다 (태블릿에서 성능 확인용, 배포본에서도 된다) */
const SHOW_FPS = typeof location !== 'undefined' && new URLSearchParams(location.search).has('fps');
/** 주소에 ?debug 를 붙이면 3D 오류 내용을 보인다 (배포본에서도) */
const SHOW_DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

/** 기기 · 그래픽 정보 (오류 안내에 함께 적는다) */
function deviceInfo(): string {
  let gpu = '알 수 없음';
  try {
    const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      gpu += ` · WebGL${gl instanceof WebGL2RenderingContext ? '2' : '1'} · 최대 질감 ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`;
    }
  } catch {
    gpu = 'WebGL 없음';
  }
  return `${navigator.userAgent}
GPU: ${gpu}
화면: ${screen.width}×${screen.height} · 배율 ${window.devicePixelRatio}`;
}
const QUALITY_NAME = ['낮음', '보통', '높음'] as const;

export function GameCanvas(): React.ReactElement {
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    const onLost = (event: Event) => {
      if (event.type === 'webglcontextlost') setContextLost(true);
    };
    // 캔버스는 나중에 생기므로 문서에서 잡는다 (이 이벤트는 버블링되지 않아 capture 로 받는다)
    document.addEventListener('webglcontextlost', onLost, true);
    return () => document.removeEventListener('webglcontextlost', onLost, true);
  }, []);

  if (contextLost) {
    return <WorldFailure message="그래픽 메모리가 모자라 3D 화면이 멈췄어요." detail="WebGL context lost" />;
  }

  return (
    // isolate: 3D 위에 띄우는 느낌표 · 글자(drei Html)의 z-index 를 이 층 안에 가둔다. 안 그러면 문제 창 위로 올라온다
    <div className="absolute inset-0 isolate" aria-hidden="true">
      <WorldErrorBoundary>
        <Suspense fallback={null}>
          <WorldRoot />
        </Suspense>
      </WorldErrorBoundary>
      <SceneFade />
      {SHOW_FPS && <FpsMeter />}
    </div>
  );
}

/** 문을 지날 때 화면을 잠깐 덮는 크림색 막 (2D 판 fadeOut 과 같은 색) */
function FpsMeter(): React.ReactElement {
  const quality = useQuality((s) => s.level);
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let frames = 0;
    let started = performance.now();
    let id = requestAnimationFrame(function tick(now) {
      frames += 1;
      if (now - started >= 1000) {
        setFps(Math.round((frames * 1000) / (now - started)));
        frames = 0;
        started = now;
      }
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="pointer-events-none absolute top-3 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-black/60 px-3 py-1 font-mono text-sm text-white">
      {fps} fps · 화질 {QUALITY_NAME[quality]}
    </div>
  );
}

function SceneFade(): React.ReactElement {
  const fading = useWorldScene((s) => s.fading);
  return (
    <div
      className="pointer-events-none absolute inset-0 bg-[#fff6e2] transition-opacity"
      style={{ opacity: fading ? 1 : 0, transitionDuration: `${SCENE_FADE_MS}ms` }}
    />
  );
}

class WorldErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[world] 3D 화면 오류', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <WorldFailure
        message="3D 화면을 그리다가 문제가 생겼어요."
        detail={`${error.name}: ${error.message}\n${(error.stack ?? '').split('\n').slice(1, 6).join('\n')}`}
      />
    );
  }
}

/**
 * 3D 화면이 멈췄을 때의 안내. 진행도는 자동 저장되어 있으므로 다시 불러와도 잃지 않는다.
 * 오류 내용은 개발 중이나 주소에 ?debug 를 붙였을 때만 보여 준다 (학생에게는 의미 없는 글자다).
 * 태블릿에서만 나는 오류를 볼 수 있게 기기 · 그래픽 정보도 함께 적는다.
 */
function WorldFailure({ message, detail }: { message: string; detail: string }): React.ReactElement {
  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-[#2b332d]/85 p-6">
      <div className="panel-paper flex max-w-[640px] flex-col items-center gap-3 px-8 py-6 text-center">
        <p className="font-game text-[1.6rem] text-ink">{message}</p>
        <p className="font-game text-[1.1rem] text-ink-soft">지금까지 한 것은 저장되어 있어요.</p>
        <button type="button" className="btn-game btn-leaf mt-1 px-8 text-[1.3rem]" onClick={() => window.location.reload()}>
          다시 불러오기
        </button>
        {(import.meta.env.DEV || SHOW_DEBUG) && (
          <pre className="mt-2 max-h-[240px] w-full overflow-auto rounded-lg bg-ink/10 p-3 text-left text-[0.8rem] whitespace-pre-wrap text-ink">
            {detail}
            {`

${deviceInfo()}`}
          </pre>
        )}
      </div>
    </div>
  );
}
