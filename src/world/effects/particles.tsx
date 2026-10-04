/**
 * 가벼운 입자 연출: 별 터뜨리기, 물방울, 반짝이(레벨업). (흙먼지 · 나뭇잎은 사용자 요청으로 뺐다)
 *
 * 태블릿을 생각해 이렇게 만든다:
 *  - 입자 그림(sprite) POOL_SIZE 개를 처음에 한 번만 만들고 돌려쓴다. 연출이 아무리 잦아도 새로 만드는 것이 없고,
 *    React 도 다시 그리지 않는다 (spawnParticles 는 배열에 값만 적는다).
 *  - 쉬고 있는 입자는 보이지 않게 해서 그리지 않는다. 모든 입자는 1초 안팎에 사라진다.
 *  - 자리가 모자라면 새 입자를 건너뛴다.
 *  - 그림은 연출마다 한 장을 모든 입자가 같이 쓴다. 물방울은 코드로 그린다 (불러올 것이 없다).
 *  - 그림을 아직 못 불러왔으면 그 연출은 건너뛴다. 빈 그림으로 그리면 네모가 보인다.
 */
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { CanvasTexture, Sprite, SpriteMaterial, SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { ASSETS } from '@/config/assets';
import { isArtReady, realAssetUrl } from '@/config/artReady';

interface Point {
  x: number;
  y: number;
  z: number;
}

export type ParticlePreset = 'stars' | 'water' | 'sparkle';

const POOL_SIZE = 96;

/* --------------------------------- 그림 --------------------------------- */

/** 불러온 그림. 다 불러오기 전에는 null */
const loaded: Partial<Record<ParticlePreset, Texture>> = {};
let loadingStarted = false;

function loadArt(preset: ParticlePreset, key: string): void {
  if (!isArtReady(key)) return;
  const url = realAssetUrl(key);
  if (!url) return;
  new TextureLoader().load(url, (texture) => {
    texture.colorSpace = SRGBColorSpace;
    loaded[preset] = texture;
  });
}

/** 위가 뾰족한 물방울 */
function waterDrop(): CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d')!;
  g.beginPath();
  g.moveTo(32, 6);
  g.bezierCurveTo(44, 26, 52, 36, 52, 44);
  g.arc(32, 44, 20, 0, Math.PI);
  g.bezierCurveTo(12, 36, 20, 26, 32, 6);
  g.fillStyle = 'rgba(120, 190, 240, 0.95)';
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(70, 140, 205, 0.9)';
  g.stroke();
  // 반짝임
  g.beginPath();
  g.ellipse(25, 40, 4, 7, -0.4, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255, 255, 255, 0.85)';
  g.fill();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function startLoading(): void {
  if (loadingStarted) return;
  loadingStarted = true;
  loadArt('stars', ASSETS.particles.star);
  loadArt('sparkle', ASSETS.particles.sparkle);
  loaded.water = waterDrop();
}

/* ------------------------------- 입자 자리 ------------------------------- */

interface Slot {
  active: boolean;
  preset: ParticlePreset;
  age: number;
  life: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  /** 처음 · 마지막 크기 (m) */
  size0: number;
  size1: number;
  spin: number;
}

const slots: Slot[] = Array.from({ length: POOL_SIZE }, () => ({
  active: false,
  preset: 'stars',
  age: 0,
  life: 1,
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  gravity: 0,
  size0: 0,
  size1: 0,
  spin: 0,
}));

/** 빈 자리. 없으면 null (그 입자는 건너뛴다) */
function takeSlot(): Slot | null {
  return slots.find((slot) => !slot.active) ?? null;
}

const random = (min: number, max: number) => min + Math.random() * (max - min);

/** 나무 수관 앞쪽(카메라 쪽, +z)으로 당기는 거리 (m) */
const FRONT = 0.9;

/** 연출마다 처음 움직임 */
function launch(slot: Slot, preset: ParticlePreset, at: Point, i: number, count: number): void {
  slot.active = true;
  slot.preset = preset;
  slot.age = 0;
  slot.spin = 0;
  slot.x = at.x;
  slot.y = at.y;
  slot.z = at.z;
  const angle = (i / count) * Math.PI * 2 + random(-0.3, 0.3);
  switch (preset) {
    case 'stars': {
      // 사방으로 튀어 나갔다가 떨어진다
      const out = random(1.4, 3);
      Object.assign(slot, { vx: Math.cos(angle) * out, vy: random(2.4, 4.2), vz: Math.sin(angle) * out });
      Object.assign(slot, { gravity: 4.5, life: 0.9, size0: 0.38, size1: 0.2 });
      break;
    }
    case 'water': {
      // 나무 위에서 흩뿌려져 아래로 떨어진다. 수관 앞(카메라 쪽)에 뿌려야 잎에 가려지지 않는다
      const r = random(0, 0.7);
      slot.x += Math.cos(angle) * r;
      slot.z += Math.sin(angle) * r * 0.5 + FRONT;
      slot.y += random(0, 0.4);
      Object.assign(slot, { vx: Math.cos(angle) * 0.3, vy: random(-0.5, 0.6), vz: Math.sin(angle) * 0.3 });
      Object.assign(slot, { gravity: 7, life: random(0.5, 0.75), size0: 0.24, size1: 0.2 });
      break;
    }
    case 'sparkle': {
      // 캐릭터를 둘러싸고 반짝이며 올라간다 (레벨업)
      const r = random(0.35, 0.75);
      slot.x += Math.cos(angle) * r;
      slot.z += Math.sin(angle) * r;
      slot.y += random(0, 0.8);
      Object.assign(slot, { vx: Math.cos(angle) * 0.2, vy: random(1.2, 2.2), vz: Math.sin(angle) * 0.2 });
      Object.assign(slot, { gravity: 0, life: random(0.8, 1.2), size0: 0.3, size1: 0.12, spin: random(-4, 4) });
      break;
    }
  }
}

/** 연출마다 개수 배율. 별 · 물방울은 너무 화려해서 20% 줄였다 (사용자 요청) */
const DENSITY: Record<ParticlePreset, number> = { stars: 0.8, water: 0.8, sparkle: 1 };

/** 입자 연출을 띄운다. 그림을 아직 못 불러왔으면 건너뛴다 */
export function spawnParticles(preset: ParticlePreset, at: Point, count: number): void {
  startLoading();
  if (!loaded[preset]) return;
  const n = Math.max(1, Math.round(Math.min(count, 24) * DENSITY[preset]));
  for (let i = 0; i < n; i += 1) {
    const slot = takeSlot();
    if (!slot) return;
    launch(slot, preset, at, i, n);
  }
}

/* --------------------------------- 그리기 --------------------------------- */

/** 입자 그림 POOL_SIZE 개. 장면이 바뀌어도 그대로 둔다 (WorldRoot 에 하나) */
export function ParticleField(): React.ReactElement {
  const sprites = useMemo(() => {
    startLoading();
    return slots.map(() => {
      const sprite = new Sprite(new SpriteMaterial({ transparent: true, depthWrite: false }));
      sprite.visible = false;
      return sprite;
    });
  }, []);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 20);
    slots.forEach((slot, i) => {
      const sprite = sprites[i];
      if (!slot.active) {
        sprite.visible = false;
        return;
      }
      slot.age += dt;
      if (slot.age >= slot.life) {
        slot.active = false;
        sprite.visible = false;
        return;
      }
      slot.vy -= slot.gravity * dt;
      slot.x += slot.vx * dt;
      slot.y += slot.vy * dt;
      slot.z += slot.vz * dt;
      const k = slot.age / slot.life;
      const material = sprite.material;
      const map = loaded[slot.preset] ?? null;
      if (material.map !== map) {
        material.map = map;
        material.needsUpdate = true;
      }
      // 마지막 40% 동안 옅어진다
      material.opacity = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      material.rotation += slot.spin * dt;
      sprite.position.set(slot.x, slot.y, slot.z);
      sprite.scale.setScalar(slot.size0 + (slot.size1 - slot.size0) * k);
      sprite.visible = true;
    });
  });

  return (
    <group>
      {sprites.map((sprite, i) => (
        <primitive key={i} object={sprite} />
      ))}
    </group>
  );
}

/** 장면이 바뀌면 떠 있던 입자를 치운다 (집 안에 마당 먼지가 남지 않게) */
export function clearParticles(): void {
  for (const slot of slots) slot.active = false;
}
