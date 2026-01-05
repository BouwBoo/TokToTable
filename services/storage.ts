// src/services/storage.ts
import { PlannerData, Recipe, ShoppingList } from '../types';
import { MOCK_RECIPES } from '../constants';

const RECIPES_KEY = 'tokchef_recipes';
const PLANNER_KEY = 'tokchef_planner';
const SHOPPING_KEY = 'tokchef_shopping_list';

export function loadRecipes(): Recipe[] {
  try {
    const saved = localStorage.getItem(RECIPES_KEY);
    const initialRecipes: Recipe[] = saved ? JSON.parse(saved) : MOCK_RECIPES;

    // Zorg dat thumbnails uit mocks altijd up-to-date blijven
    return initialRecipes.map((r: Recipe) => {
      const latestMock = MOCK_RECIPES.find(m => m.id === r.id);
      if (latestMock) {
        return { ...r, thumbnail_url: latestMock.thumbnail_url };
      }
      return r;
    });
  } catch {
    return MOCK_RECIPES;
  }
}

export function saveRecipes(recipes: Recipe[]): void {
  localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes));
}

export function loadPlanner(): PlannerData {
  try {
    const saved = localStorage.getItem(PLANNER_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

export function savePlanner(planner: PlannerData): void {
  localStorage.setItem(PLANNER_KEY, JSON.stringify(planner));
}

export function loadShoppingList(): ShoppingList | null {
  try {
    const saved = localStorage.getItem(SHOPPING_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function saveShoppingList(list: ShoppingList): void {
  localStorage.setItem(SHOPPING_KEY, JSON.stringify(list));
}

export function clearShoppingList(): void {
  localStorage.removeItem(SHOPPING_KEY);
}

export function clearAllStorage(): void {
  localStorage.removeItem(RECIPES_KEY);
  localStorage.removeItem(PLANNER_KEY);
  localStorage.removeItem(SHOPPING_KEY);
}
