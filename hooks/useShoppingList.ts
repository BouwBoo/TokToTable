import { useEffect, useState } from 'react';
import { PlannerData, Recipe, ShoppingList } from '../types';
import { loadShoppingList, saveShoppingList, clearShoppingList } from '../services/storage';
import { buildShoppingListFromPlanner, clearList, resetChecks, toggleItem } from '../services/shoppingListService';

export function useShoppingList() {
  const [shoppingList, setShoppingList] = useState<ShoppingList | null>(() => loadShoppingList());

  useEffect(() => {
    if (shoppingList) saveShoppingList(shoppingList);
  }, [shoppingList]);

  const generateFromPlanner = (planner: PlannerData, recipes: Recipe[]) => {
    const list = buildShoppingListFromPlanner(planner, recipes);
    setShoppingList(list);
  };

  const toggle = (itemId: string) => {
    if (!shoppingList) return;
    setShoppingList(toggleItem(shoppingList, itemId));
  };

  const reset = () => {
    if (!shoppingList) return;
    setShoppingList(resetChecks(shoppingList));
  };

  const clear = () => {
    clearShoppingList();
    setShoppingList(clearList());
  };

  return {
    shoppingList,
    setShoppingList,

    generateFromPlanner,
    toggle,
    reset,
    clear,
  };
}
