/**
 * 움직이지 않는 물체(건물 · 울타리 · 밭 테두리 · 덤불 · 표지판 · 시장 장식)의 그림자를 미리 그려 둔다.
 *
 * 실시간 그림자는 그림자를 만드는 물체를 매번 한 번 더 그려서 태블릿에 무겁다 (그림자를 끄면 32 → 42fps).
 * 해는 늘 같은 방향(rendering/lighting 의 SUN_OFFSET)이라 움직이지 않는 물체의 그림자는 바뀌지 않는다. 그래서:
 *  1. 장면에 들어오면 해 방향에서 정적 물체만 깊이로 한 번 그리고 (그림자 지도),
 *  2. 땅의 각 점이 그 그림자 안에 있는지 계산해 그림자 그림(마스크)으로 굽고,
 *  3. 땅 · 길을 칠할 때 그 그림을 같이 칠한다 (rendering/groundShadow — 추가로 칠하는 층이 없다).
 * 정적 물체는 실시간 그림자에서 빠진다. 캐릭터 · 동물 · 밭의 나무 · 꾸미기 가구는 실시간 그대로.
 *
 * 한계: 미리 그린 그림자는 땅에만 생긴다 (헛간 그림자가 울타리 위에 지는 것처럼 물체끼리는 없다).
 * 모델은 늦게 불러와지므로, 정적 물체 수가 바뀌면 다시 굽는다.
 */
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Color,
  DepthTexture,
  Mesh,
  MeshDepthMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  UnsignedIntType,
  Vector3,
  WebGLRenderTarget,
  type Group,
  type Object3D,
} from 'three';
import { proxiedMeshes } from './shadowProxies';
import { daylight } from './dayNight';
import { groundShadowUniforms } from './groundShadow';
import { SUN_OFFSET } from './lighting';

/** 미리 그릴 물체만 켜 두는 레이어 (화면 카메라는 0번만 본다) */
const BAKE_LAYER = 5;
/** 해 방향 그림자 지도 해상도 */
const DEPTH_SIZE = 2048;
/** 땅 그림자 그림의 해상도 (1m 에 몇 칸) */
const MASK_PER_METER = 24;
/**
 * 그림자 진하기 (낮). 같은 자리의 실시간 그림자와 화면 밝기를 재서 맞춘 값
 * (햇빛 받는 풀 195 → 실시간 그림자 152 · 이 값일 때 미리 그린 그림자 152)
 */
const SHADOW_OPACITY = 0.29;
/** 그림자 색: 검정보다 풀빛이 도는 어두운 색이 잔디 위에서 자연스럽다 */
const SHADOW_COLOR = new Color('#28351f');
/** 정적 물체가 바뀌었는지 살피는 간격 (초) */
const CHECK_EVERY = 0.5;

/** 미리 그릴 물체 묶음과, 그 표면이 실시간 그림자를 받을지. StaticShadow 가 넣고 뺀다 */
const staticRoots = new Map<Object3D, { receive: boolean }>();

/**
 * 이 안의 물체는 그림자를 미리 그린다 (움직이지 않는 것만 넣는다).
 * 원래 그림자를 만들던(castShadow) 물체만 대상이고, 실시간 그림자에서는 빠진다.
 *
 * 표면도 실시간 그림자를 받지 않는다(receive 를 주면 받는다). 그림자를 받는 표면은 픽셀마다 그림자 지도를
 * 읽어야 해서 태블릿에 무겁다. 캐릭터 · 동물 그림자가 집 벽이나 울타리 위에 지는 일은 드물다.
 * 나무 그림자가 지는 밭 흙처럼 꼭 필요한 곳만 receive 로 둔다.
 */
export function StaticShadow({ children, receive = false }: { children: ReactNode; receive?: boolean }): React.ReactElement {
  const group = useRef<Group>(null);
  useEffect(() => {
    const root = group.current;
    if (!root) return;
    staticRoots.set(root, { receive });
    return () => {
      staticRoots.delete(root);
    };
  }, [receive]);
  return <group ref={group}>{children}</group>;
}

/** 정적 물체를 표시하고(그림자 레이어, 실시간 그림자 끔) 그 수를 센다 */
function markStaticCasters(): string {
  const ids: number[] = [];
  for (const [root, { receive }] of staticRoots) {
    root.traverse((node) => {
      const mesh = node as Mesh;
      if (!mesh.isMesh) return;
      if (!receive) mesh.receiveShadow = false;
      // 그림자 전용 사본(rendering/assets)은 정적 물체에는 필요 없다. 끄고, 원래 모델로 굽는다
      if (mesh.userData.shadowProxy) {
        mesh.visible = false;
        for (const real of proxiedMeshes(mesh)) {
          real.userData.bakedShadow = true;
          real.layers.enable(BAKE_LAYER);
          ids.push(real.id);
        }
        return;
      }
      // 모델을 다시 불러오면 castShadow 가 다시 켜지므로, 한 번 표시한 것도 매번 확인한다
      if (mesh.castShadow || mesh.userData.bakedShadow) {
        mesh.userData.bakedShadow = true;
        mesh.castShadow = false;
        mesh.layers.enable(BAKE_LAYER);
        ids.push(mesh.id);
      }
    });
  }
  return ids.join(',');
}

const MASK_VERTEX = /* glsl */ `
  uniform vec4 bounds; // minX, maxX, minZ, maxZ
  varying vec3 vWorld;
  void main() {
    // 그림자 그림의 (0,0) 은 (minX, maxZ) — 땅에 까는 판의 무늬 좌표와 맞춘다
    vWorld = vec3(mix(bounds.x, bounds.y, uv.x), 0.0, mix(bounds.w, bounds.z, uv.y));
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const MASK_FRAGMENT = /* glsl */ `
  uniform sampler2D depthMap;
  uniform mat4 shadowMatrix;
  uniform float texel;
  varying vec3 vWorld;
  void main() {
    vec4 p = shadowMatrix * vec4(vWorld, 1.0);
    vec3 ndc = p.xyz / p.w;
    vec2 uv = ndc.xy * 0.5 + 0.5;
    float depth = ndc.z * 0.5 + 0.5;
    float shadow = 0.0;
    if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
      // 4x4 칸을 읽어 가장자리를 부드럽게 (실시간 그림자의 PCF Soft 와 비슷하게)
      for (int i = -2; i < 2; i++) {
        for (int j = -2; j < 2; j++) {
          vec2 offset = (vec2(float(i), float(j)) + 0.5) * texel * 1.5;
          float occluder = texture2D(depthMap, uv + offset).r;
          shadow += depth - 0.0015 > occluder ? 1.0 : 0.0;
        }
      }
      shadow /= 16.0;
    }
    gl_FragColor = vec4(vec3(shadow), 1.0);
  }
`;

export interface ShadowBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * 장면에 하나: 이 범위의 땅에 정적 물체 그림자를 구워 깐다.
 * 범위는 정적 물체와 그 그림자가 다 들어가게 넉넉히 준다.
 */
export function BakedShadows({ bounds }: { bounds: ShadowBounds }): null {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;

  const bake = useMemo(() => {
    const depthTarget = new WebGLRenderTarget(DEPTH_SIZE, DEPTH_SIZE);
    depthTarget.depthTexture = new DepthTexture(DEPTH_SIZE, DEPTH_SIZE, UnsignedIntType);
    const maskTarget = new WebGLRenderTarget(Math.ceil(width * MASK_PER_METER), Math.ceil(depth * MASK_PER_METER));
    const sunCamera = new OrthographicCamera();
    sunCamera.layers.set(BAKE_LAYER);
    const depthMaterial = new MeshDepthMaterial();
    const maskMaterial = new ShaderMaterial({
      uniforms: {
        depthMap: { value: depthTarget.depthTexture },
        shadowMatrix: { value: sunCamera.projectionMatrix.clone() },
        bounds: { value: [bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ] },
        texel: { value: 1 / DEPTH_SIZE },
      },
      vertexShader: MASK_VERTEX,
      fragmentShader: MASK_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    const maskScene = new Scene();
    const maskQuad = new Mesh(new PlaneGeometry(2, 2), maskMaterial);
    // 화면 전체를 덮는 판이라 카메라 범위 판정이 필요 없다 (판정하면 잘려 나간다)
    maskQuad.frustumCulled = false;
    maskScene.add(maskQuad);
    const maskCamera = new OrthographicCamera();
    return { depthTarget, maskTarget, sunCamera, depthMaterial, maskMaterial, maskScene, maskQuad, maskCamera };
  }, [bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ, width, depth]);

  useEffect(
    () => () => {
      bake.depthTarget.depthTexture?.dispose();
      bake.depthTarget.dispose();
      bake.maskTarget.dispose();
      bake.depthMaterial.dispose();
      bake.maskMaterial.dispose();
      // 판 모양도 정리한다 (빠뜨렸더니 장면을 오갈 때마다 GPU 에 모양이 하나씩 쌓였다)
      bake.maskQuad.geometry.dispose();
    },
    [bake],
  );

  // 땅 · 길 재질이 읽는 값 (rendering/groundShadow). 장면을 떠나면 그림자를 끈다
  useEffect(() => {
    groundShadowUniforms.uBakedMask.value = bake.maskTarget.texture;
    groundShadowUniforms.uBakedBounds.value.set(bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ);
    groundShadowUniforms.uBakedColor.value.copy(SHADOW_COLOR).convertLinearToSRGB();
    return () => {
      groundShadowUniforms.uBakedOpacity.value = 0;
    };
  }, [bake, bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ]);

  const signature = useRef('');
  const elapsed = useRef(CHECK_EVERY);

  /** 해 방향에서 정적 물체를 깊이로 그리고, 땅 그림자 그림으로 굽는다 */
  const render = () => {
    const { sunCamera, depthTarget, depthMaterial, maskTarget, maskMaterial, maskScene, maskCamera } = bake;
    // 해 카메라: 범위 가운데를 해 방향에서 내려다본다. 범위 네 귀퉁이(높이 0~6m)가 다 들어가게 크기를 정한다
    const center = new Vector3((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
    const direction = SUN_OFFSET.clone().normalize();
    sunCamera.position.copy(center).addScaledVector(direction, 60);
    sunCamera.lookAt(center);
    sunCamera.updateMatrixWorld();
    const view = sunCamera.matrixWorldInverse;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const x of [bounds.minX, bounds.maxX]) {
      for (const z of [bounds.minZ, bounds.maxZ]) {
        for (const y of [0, 6]) {
          const p = new Vector3(x, y, z).applyMatrix4(view);
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
          minZ = Math.min(minZ, p.z);
          maxZ = Math.max(maxZ, p.z);
        }
      }
    }
    Object.assign(sunCamera, { left: minX, right: maxX, top: maxY, bottom: minY, near: -maxZ - 10, far: -minZ + 10 });
    sunCamera.updateProjectionMatrix();

    const previous = {
      target: gl.getRenderTarget(),
      override: scene.overrideMaterial,
      background: scene.background,
      autoClear: gl.autoClear,
      shadowsAuto: gl.shadowMap.autoUpdate,
      shadowsNeed: gl.shadowMap.needsUpdate,
    };
    // 1. 정적 물체만 깊이로
    scene.overrideMaterial = depthMaterial;
    scene.background = null;
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = false;
    gl.autoClear = true;
    gl.setRenderTarget(depthTarget);
    gl.clear();
    gl.render(scene, sunCamera);
    scene.overrideMaterial = previous.override;
    scene.background = previous.background;

    // 2. 땅의 각 점이 그림자 안인지 → 그림자 그림
    maskMaterial.uniforms.shadowMatrix.value.multiplyMatrices(sunCamera.projectionMatrix, sunCamera.matrixWorldInverse);
    gl.setRenderTarget(maskTarget);
    gl.clear();
    gl.render(maskScene, maskCamera);

    gl.setRenderTarget(previous.target);
    gl.autoClear = previous.autoClear;
    gl.shadowMap.autoUpdate = previous.shadowsAuto;
    gl.shadowMap.needsUpdate = previous.shadowsNeed;
  };

  useFrame((_, delta) => {
    // 낮엔 진하게, 밤엔 해(달)빛이 약해 옅게 — 실시간 그림자가 옅어지는 정도에 맞춘다
    groundShadowUniforms.uBakedOpacity.value = SHADOW_OPACITY * (1 - 0.65 * daylight.darkness) * (signature.current ? 1 : 0);
    elapsed.current += delta;
    if (elapsed.current < CHECK_EVERY) return;
    elapsed.current = 0;
    // 모델을 다 불러오기 전에 구우면 빠지는 그림자가 생긴다. 정적 물체가 바뀔 때마다 다시 굽는다
    const next = markStaticCasters();
    if (next === signature.current) return;
    signature.current = next;
    if (next) render();
  });

  return null;
}
