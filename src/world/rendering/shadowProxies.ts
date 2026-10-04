/**
 * 그림자 전용 사본: 모델 파일 안에 든 저해상도 모양으로 그림자를 만든다.
 * (모델 불러오기는 rendering/assets, 사본을 만드는 쪽은 scripts/lib/shadowProxy.ts)
 */
import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, type Object3D } from 'three';

/**
 * 그림자 전용 사본. 그림자는 흐릿해서 모양이 조금 거칠어도 티가 안 나는데, 그리는 비용은 면 수에 비례한다.
 * 모델 파일 안에 면 수를 15% 로 줄인 사본(이름 SHADOW_PROXY_NAME)이 함께 들어 있다 (scripts/gen-model.ts).
 * 그림자는 사본으로 만들고, 화면에는 원래 모양을 그린다.
 *
 * 사본은 화면에 그리면 안 된다. 레이어로 나눌 수는 없어서(three.js 는 그림자도 화면 카메라 레이어로 고른다)
 * 재질을 평소엔 숨겨 두고, 그림자를 그리는 동안만 보이게 한다 (useShadowProxyGate).
 */
export const SHADOW_PROXY_NAME = 'shadow_proxy';
const PROXY_MATERIAL = new MeshBasicMaterial({ colorWrite: false, depthWrite: false, visible: false });

/** 사본 재질을 보이게/숨기게. 그림자를 그리는 동안만 켠다 */
export function setShadowProxiesVisible(visible: boolean): void {
  PROXY_MATERIAL.visible = visible;
}

/**
 * 사본이 대신하는 원래 모양들. 사본은 원래 모양의 노드 아래에 들어 있는데, three.js 로 불러오면 그 노드가
 * 모양 자체(Mesh)일 수도, 모양을 감싼 묶음(Group)일 수도 있다. 묶음이면 그 안의 다른 모양이 원래 모양이다.
 */
export function proxiedMeshes(proxy: Object3D): Mesh[] {
  const parent = proxy.parent;
  if (!parent) return [];
  if ((parent as Mesh).isMesh) return [parent as Mesh];
  return parent.children.filter((child) => (child as Mesh).isMesh && child.name !== SHADOW_PROXY_NAME) as Mesh[];
}

/** 모델 안의 그림자 사본을 준비하고, 사본이 있는 원래 모양은 그림자를 만들지 않게 한다 */
export function setupShadowProxies(root: Object3D, castShadow: boolean): void {
  const proxies: Mesh[] = [];
  root.traverse((node) => {
    if ((node as Mesh).isMesh && node.name === SHADOW_PROXY_NAME) proxies.push(node as Mesh);
  });
  for (const proxy of proxies) {
    proxy.material = PROXY_MATERIAL;
    proxy.userData.shadowProxy = true;
    proxy.castShadow = castShadow;
    proxy.receiveShadow = false;
    for (const real of proxiedMeshes(proxy)) real.castShadow = false;
  }
}

/**
 * 그림자 사본을 그림자를 그리는 동안만 켜는 작은 물체(gate). 해(Sun)가 장면 맨 앞에 둔다.
 * 장면에서 가장 먼저 그림자를 그리므로 이 물체가 사본을 켜고, 다음 프레임이 시작될 때(setShadowProxiesVisible(false)) 끈다.
 * 화면을 그릴 목록은 그림자보다 먼저 정해지므로 사본은 화면 목록에 들어가지 않는다
 * (예전에는 투명하게 화면에도 그려 그리기 호출을 낭비했다).
 */
export function useShadowProxyGate(): Mesh {
  const gate = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
    const mesh = new Mesh(geometry, new MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    mesh.onBeforeShadow = () => setShadowProxiesVisible(true);
    return mesh;
  }, []);
  useEffect(
    () => () => {
      gate.geometry.dispose();
      (gate.material as MeshBasicMaterial).dispose();
    },
    [gate],
  );
  return gate;
}
