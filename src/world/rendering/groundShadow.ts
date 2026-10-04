/**
 * 미리 그린 그림자(rendering/bakedShadows)를 땅 · 길 재질 안에서 칠한다.
 *
 * 예전에는 그림자 그림을 땅 위에 반투명 판으로 한 겹 더 깔았는데, 태블릿 GPU 는 화면 대부분을
 * 반투명으로 한 번 더 칠하는 일이 비싸다. 땅을 칠할 때 같이 칠하면 추가로 칠할 것이 없다.
 *
 * 땅 · 길 재질에 applyGroundShadow 를 걸면, BakedShadows 가 채우는 값(그림 · 범위 · 진하기)을 읽는다.
 * 섞는 방식은 반투명 판과 같다 (화면 색에 그림자 색을 진하기만큼 섞는다).
 */
import { Color, DataTexture, Vector4, type Material, type Texture } from 'three';

/** 그림자 그림이 아직 없을 때 쓰는 빈 그림 (그림자 없음) */
const EMPTY = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
EMPTY.needsUpdate = true;

export const groundShadowUniforms = {
  uBakedMask: { value: EMPTY as Texture },
  /** minX, maxX, minZ, maxZ */
  uBakedBounds: { value: new Vector4(0, 1, 0, 1) },
  uBakedOpacity: { value: 0 },
  /** 화면 색(sRGB)으로 바꿔 둔 그림자 색 */
  uBakedColor: { value: new Color() },
};

const VERTEX_HEAD = /* glsl */ `
varying vec3 vBakedWorld;
`;

const FRAGMENT_HEAD = /* glsl */ `
uniform sampler2D uBakedMask;
uniform vec4 uBakedBounds;
uniform float uBakedOpacity;
uniform vec3 uBakedColor;
varying vec3 vBakedWorld;
`;

const FRAGMENT_APPLY = /* glsl */ `
if (uBakedOpacity > 0.0) {
  // 그림자 그림의 (0,0) 은 (minX, maxZ)
  vec2 bakedUv = vec2(
    (vBakedWorld.x - uBakedBounds.x) / (uBakedBounds.y - uBakedBounds.x),
    (uBakedBounds.w - vBakedWorld.z) / (uBakedBounds.w - uBakedBounds.z)
  );
  if (bakedUv.x > 0.0 && bakedUv.x < 1.0 && bakedUv.y > 0.0 && bakedUv.y < 1.0) {
    float bakedShadow = texture2D(uBakedMask, bakedUv).g;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uBakedColor, bakedShadow * uBakedOpacity);
  }
}
`;

/** 땅 · 길 재질에 미리 그린 그림자를 칠하게 한다 */
export function applyGroundShadow(material: Material): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, groundShadowUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_HEAD}`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvBakedWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_HEAD}`)
      .replace('#include <dithering_fragment>', `${FRAGMENT_APPLY}\n#include <dithering_fragment>`);
  };
  material.customProgramCacheKey = () => 'ground-baked-shadow';
}
