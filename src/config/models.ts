/**
 * 3D 모델 매니페스트.
 *
 * 모델은 생성 그림을 Hunyuan3D 로 3D 로 바꾸고(scripts/gen-model.ts) 태블릿용으로 줄여 만든다.
 * 게임 로직에서는 파일 경로를 직접 쓰지 않고 MODELS 의 키만 쓴다.
 * 준비된 모델은 public/assets/model-manifest.json 의 `ready` 에 들어간다.
 * 준비되지 않은 키는 3D 월드가 코드로 만든 임시 모양을 쓴다.
 */
import type { CharacterId, PenAnimalId, TreeSpeciesId } from '@/types/game';
import { ASSETS, furnitureTextureKey } from './assets';
import { FURNITURE } from './catalog';
import { FURNITURE_3D, WALL_ITEM_DEPTH } from './furniture3d';

export const MODELS = {
  /** 학생이 고르는 내 캐릭터. 뼈대 없이 통째로 움직인다(튀며 걷기·숨쉬기) */
  characters: {
    boy: 'model_character_boy',
    girl: 'model_character_girl',
    farmer: 'model_character_farmer',
    dino: 'model_character_dino',
    bunny: 'model_character_bunny',
    astro: 'model_character_astro',
  },
  buildings: {
    house: 'model_building_house',
    barn: 'model_building_barn',
    trough: 'model_building_trough',
    waterTrough: 'model_building_water_trough',
    seedShop: 'model_building_seed_shop',
    furnitureShop: 'model_building_furniture_shop',
    /** 꿀벌 양봉 통 (yard/apiary). 꿀벌 자체는 코드로 그린다 */
    beehive: 'model_building_beehive',
  },
  /** 밭의 나무. 열매 없이 만들고, 열매 모델을 따로 단다 (어린나무는 같은 모델을 작게) */
  trees: {
    apple: 'model_tree_apple',
    orange: 'model_tree_orange',
    peach: 'model_tree_peach',
    cherry: 'model_tree_cherry',
    grape: 'model_tree_grape',
    persimmon: 'model_tree_persimmon',
    banana: 'model_tree_banana',
    blueberry: 'model_tree_blueberry',
    tangerine: 'model_tree_tangerine',
    kiwi: 'model_tree_kiwi',
  },
  /** 맵 가장자리 숲의 앞줄 (world/props/Ground 의 Surroundings). 놓을 때마다 방향 · 크기를 달리한다 */
  scenery: {
    tree: 'model_scenery_tree',
    pine: 'model_scenery_pine',
    bush: 'model_scenery_bush',
  },
  /** 씨앗을 심은 뒤 첫 싹 (모든 나무 공통) */
  sprout: 'model_plant_sprout',
  /** 마굿간 안 장식 (world/scenes/barn). 놓기만 하고 상호작용은 없다 */
  barnProps: {
    hayBale: 'model_barn_hay_bale',
    hayPile: 'model_barn_hay_pile',
    toolRack: 'model_barn_tool_rack',
    bucket: 'model_barn_bucket',
    appleCrate: 'model_barn_apple_crate',
    wheelbarrow: 'model_barn_wheelbarrow',
    lantern: 'model_barn_lantern',
    milkCan: 'model_barn_milk_can',
  },
  /** 동물 우리의 동물. 뼈대 없이 통째로 움직인다(통통 걷기·고개 숙여 먹기) */
  animals: {
    chicken: 'model_animal_chicken',
    goat: 'model_animal_goat',
    sheep: 'model_animal_sheep',
    cow: 'model_animal_cow',
  },
  /** 나무에 달리는 열매. 수확 연출에도 쓴다 */
  fruits: {
    apple: 'model_fruit_apple',
    orange: 'model_fruit_orange',
    peach: 'model_fruit_peach',
    cherry: 'model_fruit_cherry',
    grape: 'model_fruit_grape',
    persimmon: 'model_fruit_persimmon',
    banana: 'model_fruit_banana',
    blueberry: 'model_fruit_blueberry',
    tangerine: 'model_fruit_tangerine',
    kiwi: 'model_fruit_kiwi',
  },
} as const;

/**
 * 태블릿에서 버틸 수 있는 크기. 화면에 여러 개 깔리는 것일수록 작게 잡는다.
 *
 * small   열매·작은 소품. 한 화면에 수십 개
 * medium  가구·동물
 * large   캐릭터·건물. 한 화면에 몇 개
 */
export type ModelBudget = 'tiny' | 'small' | 'medium' | 'large';

export const MODEL_BUDGET: Record<ModelBudget, { triangles: number; texture: number }> = {
  /** 열매처럼 한 화면에 수십 개 나오는 작은 것. 0.3m 짜리라 900 면이면 충분하다 */
  tiny: { triangles: 900, texture: 256 },
  small: { triangles: 3000, texture: 512 },
  medium: { triangles: 8000, texture: 1024 },
  large: { triangles: 16000, texture: 1024 },
};

export interface ModelSpec {
  key: string;
  /** public/assets/ 기준 상대 경로 */
  path: string;
  budget: ModelBudget;
  /** 맞출 높이 (m). 캐릭터 키가 1.2 */
  height: number;
  /**
   * 원본 그림으로 쓸 이미 만든 이미지 키 (art-src/<키>.png).
   * 없으면 scripts/model-prompts.ts 의 프롬프트로 원본 그림을 새로 만든다.
   */
  fromArt?: string;
  /** 걷기용 뼈대를 자동으로 단다 (scripts/lib/autorig.ts). 사람 모양 캐릭터만 */
  rig?: boolean;
  /** 모델을 y 축으로 돌려 앞(+z)을 맞춘다 (라디안) */
  yaw?: number;
  /** 높이 대신 가로 폭(m)으로 크기를 맞춘다. 납작한 물건(카펫 · 돌길)용 */
  width?: number;
  /**
   * 앞뒤 두께(m) 상한. 이보다 두꺼우면 앞뒤로만 눌러 납작하게 만든다.
   * 정면 그림 한 장으로 3D 를 만들면 네모난 액자가 그림 붙은 상자가 되기도 해서다 (벽 장식용).
   */
  depth?: number;
  /**
   * 색 질감 고치기. 밝기 · 채도 배율 (1 = 그대로), warmHue 는 빨강~노랑 부분을 맞출 색조(도).
   * 3D 변환이 색을 칙칙하거나 얼룩지게 구웠을 때 (scripts/gen-model.ts adjustColor)
   */
  color?: { brightness?: number; saturation?: number; warmHue?: number };
  /**
   * 원본 그림으로 이 아이콘을 만든다 (assets.ts 의 thumbnail 키).
   * 상점 · 가방 · 캐릭터 고르기 그림이 실제 3D 모델과 같아 보이게 하려는 것이다.
   */
  thumbnail?: string;
  /**
   * 앞을 모양으로 찾아 맞춘다 (yaw 대신). 몸이 앞뒤로 긴 동물용 — 가장 길게 뻗은 방향을 앞뒤로,
   * 더 높이 솟은 쪽(머리)을 앞(+z)으로. 옆모습 그림을 3D 로 바꾸면 몸이 비스듬히 놓이는 일이 있어서다.
   */
  orient?: boolean;
}

function model(key: string, path: string, budget: ModelBudget, height: number, fromArt?: string): ModelSpec {
  return { key, path, budget, height, fromArt };
}

/** 가구 모델 키. 가구는 catalog.ts 의 목록을 그대로 따른다 */
export function furnitureModelKey(itemId: string): string {
  return `model_furniture_${itemId}`;
}

/** 나무 키 (m). 기본 2.9. 실제 모양을 따른 나무는 다르게: 바나나는 키가 크고, 블루베리는 낮은 덤불이다 */
const TREE_HEIGHT: Partial<Record<TreeSpeciesId, number>> = {
  banana: 3.3,
  blueberry: 2.0,
};

/** 동물 키 (m). 캐릭터 키가 1.2 — 2학년 아이 옆에 섰을 때 그럴듯하게 */
const ANIMAL_HEIGHT: Record<PenAnimalId, number> = {
  chicken: 0.55,
  goat: 0.95,
  sheep: 0.9,
  cow: 1.35,
};

export const MODEL_MANIFEST: ModelSpec[] = [
  ...(Object.entries(MODELS.characters) as [CharacterId, string][]).map(([id, key]) => ({
    ...model(key, `models/characters/${id}.glb`, 'large', 1.2),
    rig: true,
    thumbnail: ASSETS.portraits[id],
  })),
  model(MODELS.buildings.house, 'models/buildings/house.glb', 'large', 4.2),
  model(MODELS.buildings.barn, 'models/buildings/barn.glb', 'large', 3.4),
  model(MODELS.buildings.trough, 'models/buildings/trough.glb', 'medium', 0.55),
  model(MODELS.buildings.waterTrough, 'models/buildings/water_trough.glb', 'medium', 0.55),
  model(MODELS.buildings.seedShop, 'models/buildings/seed_shop.glb', 'large', 3.6),
  model(MODELS.buildings.furnitureShop, 'models/buildings/furniture_shop.glb', 'large', 3.8),
  // 양봉 통: 가게 · 가방의 꿀벌 그림도 이 원본 그림으로 만든다
  // 작은 물건이라 small 예산 (medium 으로 만들었더니 한 통이 나무 한 그루만큼 무거웠다)
  { ...model(MODELS.buildings.beehive, 'models/buildings/beehive.glb', 'small', 1.05), thumbnail: ASSETS.icons.bee },

  ...(Object.entries(MODELS.trees) as [TreeSpeciesId, string][]).map(([id, key]) =>
    model(key, `models/trees/${id}.glb`, 'medium', TREE_HEIGHT[id] ?? 2.9),
  ),
  model(MODELS.sprout, 'models/trees/sprout.glb', 'small', 0.45),
  model(MODELS.scenery.tree, 'models/scenery/tree.glb', 'small', 4.2),
  model(MODELS.scenery.pine, 'models/scenery/pine.glb', 'small', 5),
  model(MODELS.scenery.bush, 'models/scenery/bush.glb', 'small', 1.1),

  // 마굿간 안 장식 (키 m). 한 장면에 열 개 남짓이라 small
  model(MODELS.barnProps.hayBale, 'models/barn/hay_bale.glb', 'small', 0.72),
  model(MODELS.barnProps.hayPile, 'models/barn/hay_pile.glb', 'small', 1.25),
  model(MODELS.barnProps.toolRack, 'models/barn/tool_rack.glb', 'small', 2.0),
  model(MODELS.barnProps.bucket, 'models/barn/bucket.glb', 'small', 0.55),
  model(MODELS.barnProps.appleCrate, 'models/barn/apple_crate.glb', 'small', 0.65),
  model(MODELS.barnProps.wheelbarrow, 'models/barn/wheelbarrow.glb', 'small', 0.95),
  { ...model(MODELS.barnProps.lantern, 'models/barn/lantern.glb', 'small', 0.65), depth: 0.4 },
  model(MODELS.barnProps.milkCan, 'models/barn/milk_can.glb', 'small', 0.8),

  ...(Object.entries(ANIMAL_HEIGHT) as [PenAnimalId, number][]).map(([id, height]) => ({
    ...model(MODELS.animals[id], `models/animals/${id}.glb`, 'medium', height),
    orient: true,
    thumbnail: ASSETS.icons[id],
  })),

  // 가구 · 장식. 크기는 furniture3d.ts
  ...FURNITURE.map((item) => {
    const size = FURNITURE_3D[item.id];
    return {
      ...model(furnitureModelKey(item.id), `models/furniture/${item.id}.glb`, 'medium', size.height ?? 0.1),
      width: size.width,
      depth: size.wall ? WALL_ITEM_DEPTH : undefined,
      thumbnail: furnitureTextureKey(item.id),
    };
  }),

  model(MODELS.fruits.apple, 'models/fruits/apple.glb', 'tiny', 0.22, ASSETS.crops.apple),
  // 아이콘 그림은 껍질 잔굴곡과 얇은 잎 때문에 면이 줄지 않아, 3D 용 그림을 따로 만든다
  { ...model(MODELS.fruits.orange, 'models/fruits/orange.glb', 'tiny', 0.22), color: { warmHue: 23 } },
  model(MODELS.fruits.peach, 'models/fruits/peach.glb', 'tiny', 0.22, ASSETS.crops.peach),
  model(MODELS.fruits.cherry, 'models/fruits/cherry.glb', 'tiny', 0.2, ASSETS.crops.cherry),
  model(MODELS.fruits.grape, 'models/fruits/grape.glb', 'tiny', 0.26, ASSETS.crops.grape),
  model(MODELS.fruits.persimmon, 'models/fruits/persimmon.glb', 'tiny', 0.2, ASSETS.crops.persimmon),
  model(MODELS.fruits.banana, 'models/fruits/banana.glb', 'tiny', 0.26, ASSETS.crops.banana),
  model(MODELS.fruits.blueberry, 'models/fruits/blueberry.glb', 'tiny', 0.2, ASSETS.crops.blueberry),
  // 귤 · 키위: 아이콘 그림(잎 · 단면)이 아니라 3D 용 통 열매 그림을 따로 만든다
  // 귤은 오렌지처럼 껍질을 선명한 주황으로 맞춘다 (사용자: 더 쨍하고 먹음직스럽게)
  { ...model(MODELS.fruits.tangerine, 'models/fruits/tangerine.glb', 'tiny', 0.2), color: { warmHue: 27, saturation: 1.1, brightness: 1.05 } },
  // 키위는 껍질을 더 진한 갈색으로 (사용자 요청)
  { ...model(MODELS.fruits.kiwi, 'models/fruits/kiwi.glb', 'tiny', 0.2), color: { brightness: 0.68, saturation: 1.25 } },
];

export const MODEL_SPEC_BY_KEY: Record<string, ModelSpec> = Object.fromEntries(
  MODEL_MANIFEST.map((m) => [m.key, m]),
);

export const MODEL_MANIFEST_URL = 'assets/model-manifest.json';
