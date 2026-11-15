/**
 * 사진 판(임포스터): 3D 나무 모델을 처음 한 번 게임 카메라 각도에서 찍어 그림으로 만들고,
 * 그 그림을 붙인 판을 수백 장 세운다.
 *
 * 카메라는 늘 같은 방향(남쪽 위에서 비스듬히)만 보므로, 같은 각도에서 찍은 판은 3D 나무와 똑같이 보인다.
 * 나무 수백 그루가 판 몇백 장(면 2개씩) · 그리기 1번이 되고, 빛 계산 없이 그림만 붙인다.
 * 그림은 장면에 들어갈 때 한 번 찍고 끝 — 그 뒤로는 그리기만 한다.
 */
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  LinearMipmapLinearFilter,
  Matrix4,
  MeshBasicMaterial,
  type Mesh,
  type Object3D,
  OrthographicCamera,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Sphere,
  Vector3,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three';
import { PALETTE } from '@/config/artTokens';
import { SHADOW_PROXY_NAME } from '../rendering/shadowProxies';

/** 그림자 사본을 찍지 않게 하는 보이지 않는 재질 */
const HIDDEN = new MeshBasicMaterial({ visible: false });

export interface Impostor {
  target: WebGLRenderTarget;
  /** 판 한 변 길이 (m). 모델을 감싼 구의 지름 */
  size: number;
  /** 모델 원점(바닥 중앙)에서 판 가운데까지 */
  center: Vector3;
}

/** 판이 바라보는 방향: 카메라 쪽. 카메라가 보는 방향의 반대 */
export function impostorQuaternion(viewDir: Vector3): Quaternion {
  // 판(PlaneGeometry)은 +Z 를 본다. +Z 를 카메라 쪽(-viewDir)으로, 위쪽은 카메라 위쪽과 같게
  const forward = viewDir.clone().negate().normalize();
  const right = new Vector3(0, 1, 0).cross(forward).normalize();
  const up = forward.clone().cross(right).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right, up, forward));
}

/**
 * 모델 하나를 카메라 각도에서 찍는다. 빛은 게임의 해 · 하늘빛과 비슷하게 맞췄다 (그림에 구워진다).
 * 모델 안의 그림자 사본은 찍지 않는다.
 */
export function bakeImpostor(
  gl: WebGLRenderer,
  model: Object3D,
  viewDir: Vector3,
  sunDirection: Vector3,
  resolution: number,
): Impostor {
  const object = model.clone(true);
  object.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    // 그림자 사본은 재질만 숨긴다. 노드를 숨기면 그 아래 매달린 진짜 모양까지 사라지는 모델이 있다
    if (node.name === SHADOW_PROXY_NAME) mesh.material = HIDDEN;
  });

  const scene = new Scene();
  scene.add(object);
  scene.add(new HemisphereLight(PALETTE.skyTop, PALETTE.grassShade, 1.1));
  scene.add(new AmbientLight('#ffffff', 0.35));
  const sun = new DirectionalLight('#ffffff', 2.2);
  sun.position.copy(sunDirection).multiplyScalar(20);
  scene.add(sun);

  // 그림자 사본을 뺀 실제 모양으로 크기를 잰다
  const box = new Box3();
  object.updateMatrixWorld(true);
  object.traverse((node) => {
    const mesh = node as Mesh;
    if (mesh.isMesh && node.name !== SHADOW_PROXY_NAME) {
      mesh.geometry.computeBoundingBox();
      box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
    }
  });
  const sphere = box.getBoundingSphere(new Sphere());
  const radius = sphere.radius * 1.02;

  const camera = new OrthographicCamera(-radius, radius, radius, -radius, 0.1, radius * 4 + 10);
  camera.position.copy(sphere.center).addScaledVector(viewDir, -(radius * 2 + 5));
  camera.up.set(0, 1, 0);
  camera.lookAt(sphere.center);

  const target = new WebGLRenderTarget(resolution, resolution, { depthBuffer: true });
  target.texture.colorSpace = SRGBColorSpace;
  target.texture.generateMipmaps = true;
  target.texture.minFilter = LinearMipmapLinearFilter;

  const previousTarget = gl.getRenderTarget();
  const previousClear = gl.getClearColor(new Color());
  const previousAlpha = gl.getClearAlpha();
  gl.setRenderTarget(target);
  gl.setClearColor(0x000000, 0);
  gl.clear(true, true, true);
  gl.render(scene, camera);
  gl.setRenderTarget(previousTarget);
  gl.setClearColor(previousClear, previousAlpha);

  // 찍은 뒤에는 복제본을 버린다 (모양 · 재질은 원본과 같이 쓰므로 정리하지 않는다)
  scene.clear();
  return { target, size: radius * 2, center: sphere.center.clone() };
}
