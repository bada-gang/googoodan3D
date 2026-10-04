/** 동물: 들이기, 먹이 주기, 생산물 받기. */
import { produceAmount } from '@/config/balance';
import { ANIMAL_SPECIES } from '@/config/catalog';
import type { AnimalInstance, AnimalSpeciesId, SellableId } from '@/types/game';
import type { GameSlice } from './types';

export interface ProduceResult {
  produce: SellableId;
  /** 실제로 받은 개수. 세 번 틀리면 0 일 수 있다. */
  count: number;
}

export interface AnimalSlice {
  animals: AnimalInstance[];

  addAnimal: (species: AnimalSpeciesId) => AnimalInstance | null;
  feedAnimal: (animalId: string) => boolean;
  /** @param wrongAttempts 정답까지 틀린 횟수. 적을수록 많이 받는다. */
  collectProduce: (animalId: string, wrongAttempts?: number) => ProduceResult | null;
}

export const createAnimalSlice: GameSlice<AnimalSlice> = (set, get) => ({
  animals: [],

  addAnimal: (species) => {
    const animal: AnimalInstance = {
      id: `animal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      species,
      care: 0,
      produceReady: false,
      spot: Math.random(),
    };
    set((s) => ({ animals: [...s.animals, animal] }));
    return animal;
  },

  feedAnimal: (animalId) => {
    const animal = get().animals.find((a) => a.id === animalId);
    if (!animal || animal.produceReady) return false;
    // 먹이를 하나 쓴다. 없으면 줄 수 없다.
    if (!get().consumeItem('feed')) return false;
    const goal = ANIMAL_SPECIES[animal.species].careGoal;
    const care = animal.care + 1;
    set((s) => ({
      animals: s.animals.map((a) =>
        a.id === animalId
          ? { ...a, care: care >= goal ? 0 : care, produceReady: care >= goal }
          : a,
      ),
    }));
    return true;
  },

  collectProduce: (animalId, wrongAttempts = 0) => {
    const animal = get().animals.find((a) => a.id === animalId);
    if (!animal?.produceReady) return null;
    const produce = ANIMAL_SPECIES[animal.species].produceId;
    // 한 번에 맞힐수록 많이 받는다. (요청 6)
    const count = produceAmount(wrongAttempts);
    if (count > 0) get().addItem(produce, count);
    set((s) => ({
      animals: s.animals.map((a) => (a.id === animalId ? { ...a, produceReady: false } : a)),
    }));
    return { produce, count };
  },
});
