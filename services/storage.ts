// src/services/storage.ts
import { Recipe, PlannerData } from '../types';
import { MOCK_RECIPES } from '../constants';

const RECIPES_KEY = 'tokchef_recipes';
const PLANNER_KEY = 'tokchef_planner';

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

export function clearAllStorage(): void {
  localStorage.removeItem(RECIPES_KEY);
  localStorage.removeItem(PLANNER_KEY);
}
