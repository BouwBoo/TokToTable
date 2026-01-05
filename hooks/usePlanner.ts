// hooks/usePlanner.ts
import { useEffect, useState } from 'react';
import { PlannerData } from '../types';
import { loadPlanner, savePlanner } from '../services/storage';

export function usePlanner() {
  const [planner, setPlanner] = useState<PlannerData>(loadPlanner);
  const [showPickerForDay, setShowPickerForDay] = useState<string | null>(null);

  useEffect(() => {
    savePlanner(planner);
  }, [planner]);

  const addToPlanner = (day: string, recipeId: string) => {
    setPlanner(prev => ({
      ...prev,
      [day]: [...(prev[day] || []), recipeId],
    }));
    setShowPickerForDay(null);
  };

  const removeFromPlanner = (day: string, recipeId: string) => {
    setPlanner(prev => ({
      ...prev,
      [day]: (prev[day] || []).filter(id => id !== recipeId),
    }));
  };

  // Handig bij delete recipe: verwijder recipeId uit alle dagen
  const removeRecipeEverywhere = (recipeId: string) => {
    setPlanner(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(day => {
        next[day] = (next[day] || []).filter(id => id !== recipeId);
      });
      return next;
    });
  };

  const clearPlanner = () => {
    setPlanner({});
    savePlanner({});
  };

  return {
    planner,
    setPlanner,
    showPickerForDay,
    setShowPickerForDay,
    addToPlanner,
    removeFromPlanner,
    removeRecipeEverywhere,
    clearPlanner,
  };
}
