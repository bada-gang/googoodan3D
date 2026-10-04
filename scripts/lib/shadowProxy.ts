/** 그림자 전용 사본을 모델 파일에 넣는다. 게임 쪽은 src/world/rendering/shadowProxies.ts 가 읽는다. */
import type { Document, Primitive } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';

/** 그림자 전용 사본의 면 수 (본 모양 대비) */
const SHADOW_PROXY_RATIO = 0.15;
/** 게임이 그림자 사본을 알아보는 이름 (src/world/rendering/shadowProxies.ts 와 같아야 한다) */
const SHADOW_PROXY_NAME = 'shadow_proxy';

/**
 * 그림자 전용 사본을 모델 파일 안에 함께 넣는다. 그림자는 흐릿해서 모양이 조금 거칠어도 티가 안 나는데,
 * 그리는 비용은 면 수에 비례한다. 게임은 이 사본으로 그림자를 만들고 화면에는 원래 모양을 그린다.
 * 예전에는 태블릿이 모델을 불러올 때마다 직접 계산했다 — 장면에 들어갈 때 끊기고 계산 도구도 받아야 했다.
 * 위치만 남기고(무늬 이음매에서 끊긴 꼭짓점은 합친다) 면 수를 SHADOW_PROXY_RATIO 로 줄인다.
 * MeshoptSimplifier.ready 를 기다린 뒤에 부른다.
 */
export function addShadowProxy(document: Document): { before: number; after: number } {
  let before = 0;
  let after = 0;
  const material = document.createMaterial(SHADOW_PROXY_NAME);
  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh || node.getName() === SHADOW_PROXY_NAME) continue;
    for (const primitive of mesh.listPrimitives() as Primitive[]) {
      const position = primitive.getAttribute('POSITION');
      const indices = primitive.getIndices();
      if (!position || !indices) continue;
      // 같은 자리 꼭짓점 합치기 (0.1mm 단위)
      const welded: number[] = [];
      const remap = new Uint32Array(position.getCount());
      const seen = new Map<string, number>();
      const v = [0, 0, 0];
      for (let i = 0; i < position.getCount(); i += 1) {
        position.getElement(i, v);
        const key = v.map((c) => Math.round(c * 1e4)).join(',');
        let id = seen.get(key);
        if (id === undefined) {
          id = welded.length / 3;
          seen.set(key, id);
          welded.push(v[0], v[1], v[2]);
        }
        remap[i] = id;
      }
      const source = new Uint32Array(indices.getCount());
      for (let i = 0; i < source.length; i += 1) source[i] = remap[indices.getScalar(i)];
      const target = Math.max(36, Math.floor((source.length * SHADOW_PROXY_RATIO) / 3) * 3);
      const [simplified] = MeshoptSimplifier.simplify(source, new Float32Array(welded), 3, target, 0.05);
      before += source.length / 3;
      after += simplified.length / 3;
      const proxyPrimitive = document
        .createPrimitive()
        .setAttribute('POSITION', document.createAccessor().setType('VEC3').setArray(new Float32Array(welded)))
        .setIndices(document.createAccessor().setType('SCALAR').setArray(new Uint32Array(simplified)))
        .setMaterial(material);
      const proxyMesh = document.createMesh(SHADOW_PROXY_NAME).addPrimitive(proxyPrimitive);
      // 원래 모양의 노드 아래에 둬서 위치 · 회전 · 크기를 그대로 따라간다
      node.addChild(document.createNode(SHADOW_PROXY_NAME).setMesh(proxyMesh));
    }
  }
  return { before, after };
}
