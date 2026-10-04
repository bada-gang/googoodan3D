/** 꾸미기: 집 안 · 마당에 가구 놓기 / 옮기기 / 돌리기 / 치우기, 벽지와 바닥. */
import type { HomeState, PlacedItem, PlacementArea, YardState } from '@/types/game';
import type { GameSlice } from './types';

export interface DecorateSlice {
  home: HomeState;
  yard: YardState;

  placeItem: (area: PlacementArea, itemId: string, x: number, z: number, rotation?: number) => PlacedItem | null;
  moveItem: (area: PlacementArea, instanceId: string, x: number, z: number) => void;
  /** 90° 돌린다 (꾸미기의 '돌리기') */
  rotateItem: (area: PlacementArea, instanceId: string) => void;
  retrieveItem: (area: PlacementArea, instanceId: string) => void;
  setWallpaper: (surfaceId: string) => void;
  setFloor: (surfaceId: string) => void;
}

export const createDecorateSlice: GameSlice<DecorateSlice> = (set, get) => ({
  home: { wallpaperId: 'wall_cream', floorId: 'floor_wood', placed: [] },
  yard: { placed: [] },

  placeItem: (area, itemId, x, z, rotation = 0) => {
    if (!get().consumeItem(itemId)) return null;
    const placed: PlacedItem = {
      instanceId: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      itemId,
      x,
      z,
      rotation,
    };
    set((s) =>
      area === 'home'
        ? { home: { ...s.home, placed: [...s.home.placed, placed] } }
        : { yard: { ...s.yard, placed: [...s.yard.placed, placed] } },
    );
    return placed;
  },

  moveItem: (area, instanceId, x, z) =>
    set((s) => {
      const update = (items: PlacedItem[]) =>
        items.map((p) => (p.instanceId === instanceId ? { ...p, x, z } : p));
      return area === 'home'
        ? { home: { ...s.home, placed: update(s.home.placed) } }
        : { yard: { ...s.yard, placed: update(s.yard.placed) } };
    }),

  rotateItem: (area, instanceId) =>
    set((s) => {
      const update = (items: PlacedItem[]) =>
        items.map((p) => (p.instanceId === instanceId ? { ...p, rotation: ((p.rotation ?? 0) + 1) % 4 } : p));
      return area === 'home'
        ? { home: { ...s.home, placed: update(s.home.placed) } }
        : { yard: { ...s.yard, placed: update(s.yard.placed) } };
    }),

  retrieveItem: (area, instanceId) => {
    const list = area === 'home' ? get().home.placed : get().yard.placed;
    const target = list.find((p) => p.instanceId === instanceId);
    if (!target) return;
    get().addItem(target.itemId);
    set((s) => {
      const remove = (items: PlacedItem[]) => items.filter((p) => p.instanceId !== instanceId);
      return area === 'home'
        ? { home: { ...s.home, placed: remove(s.home.placed) } }
        : { yard: { ...s.yard, placed: remove(s.yard.placed) } };
    });
  },

  setWallpaper: (surfaceId) => set((s) => ({ home: { ...s.home, wallpaperId: surfaceId } })),
  setFloor: (surfaceId) => set((s) => ({ home: { ...s.home, floorId: surfaceId } })),
});
