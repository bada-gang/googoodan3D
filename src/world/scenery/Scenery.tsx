/**
 * 맵 가장자리 풍경: 평평한 잔디 · 솟아오르는 숲 언덕(지형) · 숲과 덤불(사진 판).
 * 마당과 시장이 같이 쓴다. 예전의 둥근 언덕 · 덤불(props/Ground Surroundings)을 대신한다.
 *
 * 실행 중 비용을 거의 쓰지 않게 했다:
 *  - 지형 모양 · 색은 장면에 들어갈 때 한 번 계산한다 (그리기 1번, 실시간 그림자 없음)
 *  - 나무는 3D 모델을 처음 한 번 사진으로 찍어(impostors) 판으로 세운다 (종류마다 그리기 1번, 빛 계산 없음)
 *  - 매 프레임 하는 일은 밤낮에 맞춰 판 색 하나를 바꾸는 것뿐
 */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  Color,
  ConeGeometry,
  DoubleSide,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
  type InstancedMesh,
  type MeshBasicMaterial,
  type Object3D,
} from 'three';
import { ASSETS } from '@/config/assets';
import { PALETTE } from '@/config/artTokens';
import { MODELS } from '@/config/models';
import { modelUrl } from '@/config/modelReady';
import { ArtTexture } from '../rendering/assets';
import { daylight } from '../rendering/dayNight';
import { SUN_OFFSET } from '../rendering/lighting';
import { CAMERA_VIEW_DIR } from '../systems/CameraRig';
import { GrassGround } from '../props/Ground';
import { bakeImpostor, impostorQuaternion, type Impostor } from './impostors';
import { buildTerrain, flatRect, sceneryItems, type Bounds, type SceneryItem, type SceneryKind } from './terrain';

/** 사진 해상도 (px). 큰 나무는 가까이서도 보여 크게 */
const RESOLUTION: Record<SceneryKind, number> = { tree: 512, pine: 512, bush: 256 };
const KINDS: SceneryKind[] = ['tree', 'pine', 'bush'];

export function Scenery({ bounds }: { bounds: Bounds }): React.ReactElement {
  const flat = flatRect(bounds);
  return (
    <group>
      {/* 걸어 다니는 곳 + 둘레 1.5m 의 평평한 잔디 (카메라 쪽은 넉넉히) */}
      <group position={[(flat.minX + flat.maxX) / 2, 0, (flat.minZ + flat.maxZ) / 2]}>
        <GrassGround width={flat.maxX - flat.minX} depth={flat.maxZ - flat.minZ} />
      </group>
      <Terrain bounds={bounds} />
      <Forest bounds={bounds} />
    </group>
  );
}

/* --------------------------------- 지형 --------------------------------- */

function Terrain({ bounds }: { bounds: Bounds }): React.ReactElement {
  const geometry = useMemo(() => buildTerrain(bounds), [bounds]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      {/* 잔디 질감 × 땅 색. 질감 좌표는 이미 m 단위로 잡혀 있어 반복 1 */}
      <ArtTexture assetKey={ASSETS.textures.grass} repeat={[1, 1]}>
        {(map) => <meshLambertMaterial map={map} color={map ? '#ffffff' : PALETTE.grass} vertexColors />}
      </ArtTexture>
    </mesh>
  );
}

/* ---------------------------------- 숲 ---------------------------------- */

function Forest({ bounds }: { bounds: Bounds }): React.ReactElement {
  const items = useMemo(() => sceneryItems(bounds), [bounds]);
  return (
    <group>
      {KINDS.map((kind) => (
        <Suspense key={kind} fallback={null}>
          <ImpostorLayer kind={kind} items={items.filter((item) => item.kind === kind)} />
        </Suspense>
      ))}
    </group>
  );
}

/** 모델이 아직 없을 때 찍을 임시 모양 (나무: 줄기 + 둥근 잎, 침엽수: 원뿔, 덤불: 둥근 덩어리) */
function fallbackModel(kind: SceneryKind): Object3D {
  const group = new Group();
  const leaf = new MeshStandardMaterial({ color: kind === 'pine' ? '#2f6b45' : PALETTE.leafShade, roughness: 0.9, flatShading: true });
  const trunk = new MeshStandardMaterial({ color: PALETTE.trunk, roughness: 0.9 });
  if (kind === 'bush') {
    const mesh = new Mesh(new IcosahedronGeometry(0.6, 1), leaf);
    mesh.position.y = 0.45;
    mesh.scale.set(1.3, 0.85, 1.2);
    group.add(mesh);
    return group;
  }
  const stem = new Mesh(new CylinderGeometry(0.15, 0.22, kind === 'pine' ? 1.2 : 1.8, 8), trunk);
  stem.position.y = kind === 'pine' ? 0.6 : 0.9;
  group.add(stem);
  const crown =
    kind === 'pine' ? new Mesh(new ConeGeometry(1.2, 3.8, 9), leaf) : new Mesh(new IcosahedronGeometry(1.4, 1), leaf);
  crown.position.y = kind === 'pine' ? 3 : 2.9;
  group.add(crown);
  return group;
}

function ImpostorLayer({ kind, items }: { kind: SceneryKind; items: SceneryItem[] }): React.ReactElement | null {
  const url = modelUrl(MODELS.scenery[kind]);
  return url ? <LoadedImpostorLayer url={url} kind={kind} items={items} /> : <BakedLayer model={null} kind={kind} items={items} />;
}

function LoadedImpostorLayer({ url, kind, items }: { url: string; kind: SceneryKind; items: SceneryItem[] }): React.ReactElement {
  const { scene } = useGLTF(url);
  return <BakedLayer model={scene} kind={kind} items={items} />;
}

const SUN_DIRECTION = SUN_OFFSET.clone().normalize();
const QUATERNION = impostorQuaternion(CAMERA_VIEW_DIR);
const night = new Color();

function BakedLayer({ model, kind, items }: { model: Object3D | null; kind: SceneryKind; items: SceneryItem[] }): React.ReactElement | null {
  const gl = useThree((s) => s.gl);
  // 사진은 이 층이 처음 보일 때 한 번만 찍는다
  // 사진은 화면에 붙은 뒤 한 번 찍고, 떠날 때 버린다. 찍기와 버리기를 같은 effect 에 두어야
  // 개발 모드에서 effect 가 두 번 돌 때도 버린 사진을 쓰지 않는다 (렌더 중에 찍으면 사진이 비어 나왔다)
  const [impostor, setImpostor] = useState<(Impostor & { quad: PlaneGeometry }) | null>(null);
  useEffect(() => {
    const source = model ?? fallbackModel(kind);
    const baked = bakeImpostor(gl, source, CAMERA_VIEW_DIR, SUN_DIRECTION, RESOLUTION[kind]);
    // 임시 모양은 찍고 나면 필요 없다
    if (!model) {
      source.traverse((node) => {
        const m = node as Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        (m.material as MeshStandardMaterial).dispose();
      });
    }
    const quad = new PlaneGeometry(baked.size, baked.size);
    setImpostor({ ...baked, quad });
    return () => {
      baked.target.dispose();
      quad.dispose();
      setImpostor(null);
    };
  }, [gl, model, kind]);

  const mesh = useRef<InstancedMesh>(null);
  const material = useRef<MeshBasicMaterial>(null);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target || !impostor) return;
    const matrix = new Matrix4();
    const position = new Vector3();
    const scale = new Vector3();
    items.forEach((item, i) => {
      // 판 가운데 = 나무 바닥 + (모델 원점에서 판 가운데까지) × 크기
      position.set(item.x, item.y, item.z).addScaledVector(impostor.center, item.scale);
      scale.set(item.flip ? -item.scale : item.scale, item.scale, item.scale);
      target.setMatrixAt(i, matrix.compose(position, QUATERNION, scale));
    });
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere();
  }, [items, impostor]);

  // 사진은 낮 빛으로 찍었다. 노을 · 밤에는 판 색을 해 빛에 맞춰 어둡게 한다 (지형 · 사물과 같이 저물게)
  useFrame(() => {
    if (!material.current) return;
    const d = daylight.darkness;
    night.set('#ffffff').lerp(daylight.sunColor, 0.6).multiplyScalar(1 - 0.55 * d);
    material.current.color.copy(night);
  });

  if (!impostor) return null;
  return (
    <instancedMesh key={impostor.target.texture.uuid} ref={mesh} args={[impostor.quad, undefined, items.length]} frustumCulled={false}>
      {/* 좌우로 뒤집은 판도 보이게 양면 */}
      <meshBasicMaterial ref={material} map={impostor.target.texture} alphaTest={0.45} side={DoubleSide} />
    </instancedMesh>
  );
}
