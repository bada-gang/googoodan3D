/**
 * 3D 월드가 쓰는 모델·질감 불러오기.
 *
 * 모델과 그림은 키로만 부른다. 아직 만들지 않은 키는 null 을 돌려주고,
 * 쓰는 쪽이 코드로 만든 임시 모양을 그린다. 그래서 그림이 하나도 없어도 월드는 돈다.
 */
import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { useGLTF, useTexture } from '@react-three/drei';
import {
  RepeatWrapping,
  SRGBColorSpace,
  type Bone,
  type BufferGeometry,
  type Material,
  type Matrix4,
  type Mesh,
  type Object3D,
  type Texture,
} from 'three';
import { clone as cloneWithSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { isArtReady, realAssetUrl } from '@/config/artReady';
import { modelUrl } from '@/config/modelReady';

/* --------------------------------- 모델 --------------------------------- */

/**
 * 생성한 모델. 원점이 바닥 중앙이고 높이가 맞춰져 있어(scripts/gen-model.ts) 그대로 놓으면 된다.
 * 아직 없으면 fallback 을 그린다.
 */
export function GltfModel({
  modelKey,
  fallback,
  castShadow = true,
  onBones,
  onLoaded,
}: {
  modelKey: string;
  fallback: ReactNode;
  castShadow?: boolean;
  /** 뼈대가 있는 모델(캐릭터)이면 뼈를 이름으로 넘겨준다. 모델이 바뀌거나 사라지면 null */
  onBones?: (bones: Record<string, Bone> | null) => void;
  /** 불러온 모델을 넘겨준다 (크기를 재서 열매를 달 때 등). 사라지면 null */
  onLoaded?: (object: Object3D | null) => void;
}): React.ReactElement {
  const url = modelUrl(modelKey);
  if (!url) return <>{fallback}</>;
  return (
    <LoadFailureGuard fallback={fallback} label={url}>
      <Suspense fallback={fallback}>
        <LoadedModel url={url} castShadow={castShadow} onBones={onBones} onLoaded={onLoaded} />
      </Suspense>
    </LoadFailureGuard>
  );
}

/**
 * 파일 하나를 못 불러와도(없는 파일, 깨진 파일, 끊긴 연결) 3D 화면 전체가 멈추지 않게,
 * 그 자리만 임시 모양으로 바꾼다.
 */
class LoadFailureGuard extends Component<
  { fallback: ReactNode; label: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error): void {
    console.warn(`[world] ${this.props.label} 을(를) 불러오지 못해 임시 모양으로 그립니다.`, error);
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function LoadedModel({
  url,
  castShadow,
  onBones,
  onLoaded,
}: {
  url: string;
  castShadow: boolean;
  onBones?: (bones: Record<string, Bone> | null) => void;
  onLoaded?: (object: Object3D | null) => void;
}): React.ReactElement {
  // 압축(meshopt)된 모델이다. drei 의 useGLTF 는 meshopt 해독기를 기본으로 켠다.
  const { scene } = useGLTF(url);
  // 같은 모델을 여러 곳에 놓을 수 있게 복제한다 (열매 여러 개 등).
  // 뼈대가 있는 모델은 그냥 복제하면 복제본이 원본 뼈를 따라 움직인다. SkeletonUtils 로 뼈까지 복제한다.
  const object = useMemo(() => {
    const clone: Object3D = cloneWithSkeleton(scene);
    clone.traverse((node) => {
      if ((node as Mesh).isMesh) {
        node.castShadow = castShadow;
        node.receiveShadow = true;
      }
    });
    return clone;
  }, [scene, castShadow]);

  useEffect(() => {
    if (!onBones) return;
    const bones: Record<string, Bone> = {};
    object.traverse((node) => {
      if ((node as Bone).isBone) bones[node.name] = node as Bone;
    });
    onBones(Object.keys(bones).length ? bones : null);
    return () => onBones(null);
  }, [object, onBones]);

  useEffect(() => {
    if (!onLoaded) return;
    onLoaded(object);
    return () => onLoaded(null);
  }, [object, onLoaded]);

  return <primitive object={object} />;
}

/** 모델 안의 모양 하나: 모양 · 재질과, 모델 원점 기준 위치(노드 변환을 모두 곱한 것) */
export interface ModelPart {
  geometry: BufferGeometry;
  material: Material | Material[];
  matrix: Matrix4;
}

/**
 * 모델을 통째로 놓지 않고 부품(모양 · 재질)으로 꺼내 준다. 같은 모델을 여러 개 한 번에 그릴 때
 * (인스턴싱) 쓴다 — 열매 다섯 개를 따로 그리면 5번, 묶으면 1번이다.
 * 아직 없거나 못 불러오면 fallback 을 그린다.
 */
export function ModelParts({
  modelKey,
  fallback,
  children,
}: {
  modelKey: string;
  fallback: ReactNode;
  children: (parts: ModelPart[]) => ReactNode;
}): React.ReactElement {
  const url = modelUrl(modelKey);
  if (!url) return <>{fallback}</>;
  return (
    <LoadFailureGuard fallback={fallback} label={url}>
      <Suspense fallback={fallback}>
        <LoadedParts url={url}>{children}</LoadedParts>
      </Suspense>
    </LoadFailureGuard>
  );
}

function LoadedParts({ url, children }: { url: string; children: (parts: ModelPart[]) => ReactNode }): React.ReactElement {
  const { scene } = useGLTF(url);
  const parts = useMemo(() => {
    scene.updateMatrixWorld(true);
    const list: ModelPart[] = [];
    scene.traverse((node) => {
      const mesh = node as Mesh;
      if (mesh.isMesh) list.push({ geometry: mesh.geometry, material: mesh.material, matrix: mesh.matrixWorld.clone() });
    });
    return list;
  }, [scene]);
  return <>{children(parts)}</>;
}

/* --------------------------------- 질감 --------------------------------- */

/**
 * 생성한 그림을 질감으로 쓴다. 아직 없으면 children(null) — 쓰는 쪽이 색만 칠한다.
 * repeat 를 주면 반복해서 깐다 (땅·벽).
 */
export function ArtTexture({
  assetKey,
  repeat,
  children,
}: {
  assetKey: string;
  repeat?: [number, number];
  children: (texture: Texture | null) => ReactNode;
}): React.ReactElement {
  const url = isArtReady(assetKey) ? realAssetUrl(assetKey) : null;
  if (!url) return <>{children(null)}</>;
  return (
    <LoadFailureGuard fallback={children(null)} label={url}>
      <Suspense fallback={<>{children(null)}</>}>
        <LoadedTexture url={url} repeat={repeat}>
          {children}
        </LoadedTexture>
      </Suspense>
    </LoadFailureGuard>
  );
}

function LoadedTexture({
  url,
  repeat,
  children,
}: {
  url: string;
  repeat?: [number, number];
  children: (texture: Texture) => ReactNode;
}): React.ReactElement {
  const base = useTexture(url);
  const texture = useMemo(() => {
    // 같은 그림을 다른 반복 횟수로 쓰는 곳이 있어서, 반복할 때는 복제한다
    const t = repeat ? base.clone() : base;
    t.colorSpace = SRGBColorSpace;
    if (repeat) {
      t.wrapS = RepeatWrapping;
      t.wrapT = RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
    }
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  }, [base, repeat?.[0], repeat?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return <>{children(texture)}</>;
}
