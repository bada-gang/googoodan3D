/** 가방과 가게: 아이템 넣고 빼기, 사기(씨앗 · 가구 · 동물 · 벽지/바닥 · 물/먹이), 팔기. */
import {
  ANIMAL_SPECIES,
  FURNITURE_BY_ID,
  SELL_PRICE,
  SUPPLIES,
  SURFACE_BY_ID,
  TREE_SPECIES,
  seedIdOf,
} from '@/config/catalog';
import type { AnimalSpeciesId, Inventory, SellableId, SupplyId, TreeSpeciesId } from '@/types/game';
import type { GameSlice } from './types';

export interface InventorySlice {
  inventory: Inventory;

  /* ---- 가방 ---- */
  itemCount: (itemId: string) => number;
  addItem: (itemId: string, count?: number) => void;
  consumeItem: (itemId: string, count?: number) => boolean;

  /* ---- 상점 / 판매 ---- */
  buySeed: (species: TreeSpeciesId) => boolean;
  buyFurniture: (itemId: string) => boolean;
  buyAnimal: (species: AnimalSpeciesId) => boolean;
  buySurface: (surfaceId: string) => boolean;
  /** 물·먹이를 한 묶음 산다. */
  buySupply: (supplyId: SupplyId) => boolean;
  sellItem: (itemId: SellableId, count: number) => number;
  sellableTotal: () => number;
}

export const createInventorySlice: GameSlice<InventorySlice> = (set, get) => ({
  inventory: {},

  /* -------------------------------- 가방 -------------------------------- */

  itemCount: (itemId) => get().inventory[itemId] ?? 0,

  addItem: (itemId, count = 1) =>
    set((s) => ({
      inventory: { ...s.inventory, [itemId]: (s.inventory[itemId] ?? 0) + count },
    })),

  consumeItem: (itemId, count = 1) => {
    const have = get().inventory[itemId] ?? 0;
    if (have < count) return false;
    set((s) => {
      const next = { ...s.inventory };
      const left = (next[itemId] ?? 0) - count;
      if (left > 0) next[itemId] = left;
      else delete next[itemId];
      return { inventory: next };
    });
    return true;
  },

  /* ------------------------------ 상점 / 판매 ----------------------------- */

  buySeed: (species) => {
    const def = TREE_SPECIES[species];
    if (!get().spendMoney(def.seedPrice)) return false;
    get().addItem(seedIdOf(species));
    return true;
  },

  buyFurniture: (itemId) => {
    const def = FURNITURE_BY_ID[itemId];
    if (!def) return false;
    if (!get().spendMoney(def.price)) return false;
    get().addItem(itemId);
    return true;
  },

  buyAnimal: (species) => {
    const def = ANIMAL_SPECIES[species];
    if (!get().spendMoney(def.price)) return false;
    get().addAnimal(species);
    return true;
  },

  buySupply: (supplyId) => {
    const def = SUPPLIES[supplyId];
    if (!def) return false;
    if (!get().spendMoney(def.price)) return false;
    get().addItem(supplyId, def.packSize);
    return true;
  },

  buySurface: (surfaceId) => {
    const def = SURFACE_BY_ID[surfaceId];
    if (!def) return false;
    if (get().unlocked.includes(`surface_${surfaceId}`)) return true;
    if (def.price > 0 && !get().spendMoney(def.price)) return false;
    set((s) => ({ unlocked: [...new Set([...s.unlocked, `surface_${surfaceId}`])] }));
    return true;
  },

  sellItem: (itemId, count) => {
    const available = get().itemCount(itemId);
    const amount = Math.min(available, count);
    if (amount <= 0) return 0;
    get().consumeItem(itemId, amount);
    const gain = SELL_PRICE[itemId] * amount;
    get().addMoney(gain);
    return gain;
  },

  sellableTotal: () => {
    const inv = get().inventory;
    return (Object.keys(SELL_PRICE) as SellableId[]).reduce(
      (sum, id) => sum + (inv[id] ?? 0) * SELL_PRICE[id],
      0,
    );
  },
});
