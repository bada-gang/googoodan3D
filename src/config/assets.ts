/**
 * 중앙 이미지 매니페스트. (명세 62, 63, 64)
 *
 * 3D 판에서 모양(집·나무·동물·캐릭터)은 코드로 만든 로우폴리 모델이고,
 * 이미지는 아이콘·질감·배경에만 쓴다. 이미지는 OpenAI 이미지 생성으로 만든다.
 *
 * 게임 로직에서는 절대 파일 경로를 직접 쓰지 않고 ASSETS 의 키만 사용한다.
 * 그림이 준비되면 public/assets/ 아래 같은 경로에 PNG 를 두고
 * public/assets/art-manifest.json 의 `ready` 배열에 키를 추가한다.
 * 준비되지 않은 키는 UI 가 임시 그림(fallback)으로 그린다.
 */
import { FURNITURE } from './catalog';
import type { AvatarId, CharacterId } from '@/types/game';

export const CHARACTER_IDS: CharacterId[] = ['boy', 'girl', 'farmer', 'dino', 'bunny', 'astro'];

export const ASSETS = {
  avatars: {
    rabbit: 'avatar_rabbit',
    bear: 'avatar_bear',
    cat: 'avatar_cat',
    fox: 'avatar_fox',
    bird: 'avatar_bird',
    frog: 'avatar_frog',
  },
  crops: {
    apple: 'crop_apple',
    orange: 'crop_orange',
    peach: 'crop_peach',
    cherry: 'crop_cherry',
    grape: 'crop_grape',
    persimmon: 'crop_persimmon',
    banana: 'crop_banana',
    blueberry: 'crop_blueberry',
    egg: 'crop_egg',
    goatMilk: 'crop_goat_milk',
    wool: 'crop_wool',
    milk: 'crop_milk',
    // 물고기 (시장 연못에서 낚는다. config/fishing)
    minnow: 'fish_minnow',
    loach: 'fish_loach',
    crucian: 'fish_crucian',
    catfish: 'fish_catfish',
    trout: 'fish_trout',
    carp: 'fish_carp',
    goldfish: 'fish_goldfish',
    salmon: 'fish_salmon',
  },
  seeds: {
    apple: 'seedbag_apple',
    orange: 'seedbag_orange',
    peach: 'seedbag_peach',
    cherry: 'seedbag_cherry',
    grape: 'seedbag_grape',
    persimmon: 'seedbag_persimmon',
    banana: 'seedbag_banana',
    blueberry: 'seedbag_blueberry',
  },
  /**
   * 목록/상점에서 쓰는 동물 썸네일.
   * 따로 그리지 않고 동물 3D 모델의 원본 그림으로 만든다 — 상점 그림과 우리 안의 동물이 같아야 한다.
   * (가구 썸네일, 캐릭터 고르기 그림도 같다. kind = 'thumbnail')
   */
  icons: {
    chicken: 'icon_chicken',
    goat: 'icon_goat',
    sheep: 'icon_sheep',
    cow: 'icon_cow',
  },
  ui: {
    coin: 'ui_coin',
    star: 'ui_star',
    basket: 'ui_basket',
    waterCan: 'ui_water_can',
    feedBag: 'ui_feed_bag',
    chest: 'ui_chest',
    chestOpen: 'ui_chest_open',
  },
  /** 3D 모델에 입히는 반복(tileable) 질감 */
  textures: {
    grass: 'tex_grass',
    soil: 'tex_soil',
    path: 'tex_path',
    wall: 'tex_wall',
    wallStar: 'tex_wall_star',
    floor: 'tex_floor',
    floorCheck: 'tex_floor_check',
    floorCarpet: 'tex_floor_carpet',
    /** 시장 낚시터 연못 물 (분수대 물과 같은 느낌) */
    water: 'tex_water',
  },
  environment: {
    /** 시작 화면 배경 그림 */
    title: 'env_title',
  },
  /** 캐릭터 고르기 그림. 캐릭터 3D 모델의 원본 그림으로 만든다 */
  portraits: {
    boy: 'portrait_boy',
    girl: 'portrait_girl',
    farmer: 'portrait_farmer',
    dino: 'portrait_dino',
    bunny: 'portrait_bunny',
    astro: 'portrait_astro',
  },
  particles: {
    star: 'particle_star',
    sparkle: 'particle_sparkle',
  },
} as const;

export function avatarTextureKey(id: AvatarId): string {
  return ASSETS.avatars[id];
}

export function furnitureTextureKey(itemId: string): string {
  return `furniture_${itemId}`;
}

/**
 * 벽지·바닥이 쓸 질감 키.
 *
 * 무늬 없는 것은 흰 바탕 질감 하나를 색만 바꿔 쓰고,
 * 이름이 무늬를 약속하는 것("별빛 벽지", "체크 바닥")은 질감 자체를 따로 쓴다.
 * 방과 상점 미리보기가 반드시 같은 키를 봐야 사고 나서 다르게 보이지 않는다.
 */
export function surfaceTextureKey(
  surface: { pattern?: 'star' | 'check' | 'carpet' },
  kind: 'wall' | 'floor',
): string {
  if (surface.pattern === 'star') return ASSETS.textures.wallStar;
  if (surface.pattern === 'check') return ASSETS.textures.floorCheck;
  if (surface.pattern === 'carpet') return ASSETS.textures.floorCarpet;
  return kind === 'wall' ? ASSETS.textures.wall : ASSETS.textures.floor;
}

/* --------------------------- 실제 이미지 파일 매니페스트 -------------------------- */

/**
 * 생성 이미지의 쓰임새. 생성 스크립트(scripts/gen-art.ts)가 크기·배경·후처리를 이것으로 정한다.
 *
 * icon       투명 배경 아이콘. 256×256
 * particle   투명 배경 작은 연출 그림. 128×128
 * texture    3D 모델에 반복해서 입히는 질감. 512×512, 이음매 없이 이어지게 후처리
 * background 화면 전체 배경 그림. 1536×1024
 * thumbnail  3D 모델의 원본 그림으로 만드는 아이콘 (가구 · 동물 · 캐릭터). npm run model 이 만든다
 */
export type AssetKind = 'icon' | 'particle' | 'texture' | 'background' | 'thumbnail';

export interface AssetSpec {
  key: string;
  /** public/assets/ 기준 상대 경로 */
  path: string;
  kind: AssetKind;
}

function img(key: string, path: string, kind: AssetKind): AssetSpec {
  return { key, path, kind };
}

/** 최종 이미지 파일이 놓일 위치. 생성 스크립트도 이 목록을 기준으로 돈다. */
export const ASSET_MANIFEST: AssetSpec[] = [
  ...Object.entries(ASSETS.avatars).map(([id, key]) => img(key, `ui/avatar_${id}.png`, 'icon')),
  ...Object.entries(ASSETS.crops).map(([id, key]) => img(key, `crops/${id}.png`, 'icon')),
  ...Object.entries(ASSETS.seeds).map(([id, key]) => img(key, `crops/seedbag_${id}.png`, 'icon')),
  ...Object.entries(ASSETS.ui).map(([id, key]) => img(key, `ui/${id}.png`, 'icon')),
  ...Object.values(ASSETS.textures).map((key) => img(key, `textures/${key}.png`, 'texture')),
  ...Object.entries(ASSETS.environment).map(([id, key]) =>
    img(key, `environment/${id}.webp`, 'background'),
  ),
  ...Object.entries(ASSETS.particles).map(([id, key]) => img(key, `particles/${id}.png`, 'particle')),

  // 3D 모델 원본 그림에서 만드는 아이콘
  ...FURNITURE.map((f) => img(furnitureTextureKey(f.id), `furniture/${f.id}.png`, 'thumbnail')),
  ...Object.entries(ASSETS.icons).map(([id, key]) => img(key, `ui/icon_${id}.png`, 'thumbnail')),
  ...Object.entries(ASSETS.portraits).map(([id, key]) => img(key, `characters/portrait_${id}.png`, 'thumbnail')),
];

export const ASSET_SPEC_BY_KEY: Record<string, AssetSpec> = Object.fromEntries(
  ASSET_MANIFEST.map((a) => [a.key, a]),
);

/** public/assets/art-manifest.json 의 형태 */
export interface ArtManifestFile {
  /** 실제 이미지가 준비되어 파일에서 로드해야 하는 키 목록 */
  ready: string[];
}

export const ART_MANIFEST_URL = 'assets/art-manifest.json';
export const ASSET_BASE_URL = 'assets/';
