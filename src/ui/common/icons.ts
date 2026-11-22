/**
 * React UI 용 아이콘 소스.
 * 3D 장면과 같은 에셋 키를 쓰므로, 생성한 그림이 준비되면 UI 도 자동으로 따라간다.
 * 그림이 아직 없으면 fallbackArt 의 임시 그림을 쓴다.
 * 이모지는 쓰지 않는다. (명세 5, 75-1)
 */
import { ASSETS, avatarTextureKey, furnitureTextureKey, surfaceTextureKey } from '@/config/assets';
import { isArtReady, realAssetUrl } from '@/config/artReady';
import { PALETTE } from '@/config/artTokens';
import type { SurfaceDef } from '@/config/catalog';
import {
  ANIMAL_SPECIES,
  FURNITURE,
  FURNITURE_BY_ID,
  SELLABLE_NAME,
  SUPPLIES,
  TREE_SPECIES,
  speciesOfSeed,
} from '@/config/catalog';
import { FISH, FISH_ORDER, isFishId } from '@/config/fishing';
import { AVATARS } from '@/config/strings';
import type {
  AnimalSpeciesId,
  AvatarId,
  CharacterId,
  SellableId,
  SupplyId,
  TreeSpeciesId,
} from '@/types/game';
import { fallbackCharacter, fallbackIcon, fallbackSwatch } from './fallbackArt';

const cache = new Map<string, string>();

/** 키 -> 임시 그림에 쓸 글자와 색 */
let fallbackInfo: Map<string, { label: string; color: string }> | null = null;

function fallbackInfoOf(assetKey: string): { label: string; color: string } {
  if (!fallbackInfo) {
    const info = new Map<string, { label: string; color: string }>();
    const put = (key: string, label: string, color: string) => info.set(key, { label, color });
    const fruitColor: Record<SellableId, string> = {
      apple: PALETTE.apple,
      orange: PALETTE.orange,
      peach: PALETTE.peach,
      cherry: PALETTE.cherry,
      grape: '#8f6fc4',
      persimmon: '#ea8034',
      banana: '#f6d24a',
      blueberry: '#4f6fc4',
      egg: '#fdfaf2',
      goatMilk: '#f4ecd8',
      wool: '#fbf7ef',
      milk: '#ffffff',
      ...Object.fromEntries(FISH_ORDER.map((fish) => [fish, FISH[fish].color])),
    } as Record<SellableId, string>;
    for (const [id, key] of Object.entries(ASSETS.crops)) {
      put(key, SELLABLE_NAME[id as SellableId], fruitColor[id as SellableId]);
    }
    for (const [id, key] of Object.entries(ASSETS.seeds)) {
      put(key, '씨' + TREE_SPECIES[id as TreeSpeciesId].fruitName, PALETTE.woodLight);
    }
    for (const [id, key] of Object.entries(ASSETS.icons)) {
      put(key, ANIMAL_SPECIES[id as AnimalSpeciesId].name, PALETTE.grassLight);
    }
    for (const avatar of AVATARS) put(avatarTextureKey(avatar.id), avatar.name, '#fff6e2');
    for (const f of FURNITURE) put(furnitureTextureKey(f.id), f.name, f.tint);
    put(ASSETS.ui.coin, '돈', '#f6c453');
    put(ASSETS.ui.star, '별', '#f6c453');
    put(ASSETS.ui.basket, '가방', PALETTE.woodLight);
    put(ASSETS.ui.waterCan, '물', '#7fb8e6');
    put(ASSETS.ui.feedBag, '먹이', PALETTE.woodLight);
    put(ASSETS.ui.chest, '상자', PALETTE.wood);
    put(ASSETS.ui.chestOpen, '상자', PALETTE.wood);
    fallbackInfo = info;
  }
  return fallbackInfo.get(assetKey) ?? { label: '?', color: '#fff6e2' };
}

/** 에셋 키 -> <img src> */
export function iconUrl(assetKey: string): string {
  const cached = cache.get(assetKey);
  if (cached) return cached;

  const real = isArtReady(assetKey) ? realAssetUrl(assetKey) : null;
  let url = real;
  if (!url) {
    const { label, color } = fallbackInfoOf(assetKey);
    url = fallbackIcon(label, color);
  }
  cache.set(assetKey, url);
  return url;
}

/** 실제 그림이 있을 때만 URL. 배경처럼 임시 그림을 띄우면 이상한 자리에 쓴다. */
export function realImageUrl(assetKey: string): string | null {
  return isArtReady(assetKey) ? realAssetUrl(assetKey) : null;
}

export function avatarIcon(id: AvatarId): string {
  return iconUrl(avatarTextureKey(id));
}

/**
 * 벽지·바닥 미리보기.
 *
 * 방에서 하는 것과 같은 계산(고른 색 × 흰 바탕 무늬 질감)을 CSS 로 그대로 한다.
 * 상점 그림과 방에 깔았을 때가 다르면 아이가 사고 나서 "이거 아닌데" 하게 된다.
 * 반환값은 <img src> 가 아니라 style 로 쓴다.
 */
export function surfaceStyle(surface: SurfaceDef, kind: 'wall' | 'floor'): React.CSSProperties {
  const texture = realImageUrl(surfaceTextureKey(surface, kind));
  if (!texture) {
    return { backgroundImage: `url(${fallbackSwatch(surface.color)})`, backgroundSize: 'cover' };
  }
  return {
    backgroundColor: surface.color,
    backgroundImage: `url(${texture})`,
    backgroundSize: 'cover',
    // 흰 부분은 고른 색 그대로, 어두운 무늬만 진해진다.
    backgroundBlendMode: 'multiply',
  };
}

export function seedIcon(species: TreeSpeciesId): string {
  return iconUrl(ASSETS.seeds[species]);
}

export function cropIcon(id: SellableId): string {
  return iconUrl(ASSETS.crops[id]);
}

export function animalIcon(species: AnimalSpeciesId): string {
  return iconUrl(ASSETS.icons[species]);
}

export function furnitureIcon(itemId: string): string {
  return iconUrl(furnitureTextureKey(itemId));
}

export const coinIcon = () => iconUrl(ASSETS.ui.coin);
export const starIcon = () => iconUrl(ASSETS.ui.star);
export const basketIcon = () => iconUrl(ASSETS.ui.basket);
export const chestIcon = () => iconUrl(ASSETS.ui.chest);

const SUPPLY_ICON_KEY: Record<SupplyId, string> = {
  water: ASSETS.ui.waterCan,
  feed: ASSETS.ui.feedBag,
};

export function supplyIcon(id: SupplyId): string {
  return iconUrl(SUPPLY_ICON_KEY[id]);
}

/** 인벤토리에 들어 있는 임의의 아이템 id 에 대한 아이콘 */
export function itemIcon(itemId: string): string {
  const seedSpecies = itemId.startsWith('seed_') ? speciesOfSeed(itemId) : null;
  if (seedSpecies) return seedIcon(seedSpecies);
  if (itemId in SUPPLIES) return supplyIcon(itemId as SupplyId);
  if (itemId in ASSETS.crops) return iconUrl(ASSETS.crops[itemId as SellableId]);
  return furnitureIcon(itemId);
}

/** 인벤토리 아이템 이름 */
export function itemName(itemId: string): string {
  const seedSpecies = itemId.startsWith('seed_') ? speciesOfSeed(itemId) : null;
  if (seedSpecies) return TREE_SPECIES[seedSpecies].seedName;
  if (itemId in SUPPLIES) return SUPPLIES[itemId as SupplyId].name;
  if (itemId in SELLABLE_NAME) return SELLABLE_NAME[itemId as SellableId];
  return FURNITURE_BY_ID[itemId]?.name ?? itemId;
}

/** 인벤토리 아이템 분류 */
export function itemCategory(itemId: string): 'seed' | 'harvest' | 'fish' | 'supply' | 'furniture' {
  if (itemId.startsWith('seed_')) return 'seed';
  if (isFishId(itemId)) return 'fish';
  if (itemId in SUPPLIES) return 'supply';
  if (itemId in SELLABLE_NAME) return 'harvest';
  return 'furniture';
}

/** 캐릭터 고르기 그림. 캐릭터 3D 모델의 원본 그림으로 만든다 (npm run model) */
export function characterIcon(id: CharacterId): string {
  const key = 'preview_character_' + id;
  const cached = cache.get(key);
  if (cached) return cached;
  const url = realImageUrl(ASSETS.portraits[id]) ?? fallbackCharacter(id);
  cache.set(key, url);
  return url;
}
