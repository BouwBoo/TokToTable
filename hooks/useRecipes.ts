// hooks/useRecipes.ts
import { useEffect, useMemo, useState } from 'react';
import { Recipe } from '../types';
import { loadRecipes, saveRecipes, clearAllStorage } from '../services/storage';
import { extractRecipeFromUrl } from '../services/geminiService';

type ProcessingState = 'idle' | 'fetching' | 'analyzing' | 'synthesizing' | 'error';

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>(loadRecipes);

  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  const [filter, setFilter] = useState<'all' | 'extracted' | 'validated'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'status'>('date');

  useEffect(() => {
    saveRecipes(recipes);
  }, [recipes]);

  const filteredAndSortedRecipes = useMemo(() => {
    return recipes
      .filter(r => filter === 'all' || r.status === filter)
      .sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'status') return a.status.localeCompare(b.status);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [recipes, filter, sortBy]);

  const extractFromUrl = async (url: string) => {
    if (!url.includes('tiktok.com')) {
      alert('Please enter a valid TikTok URL');
      return;
    }

    setProcessingState('fetching');

    try {
      const result = await extractRecipeFromUrl(url);

      if (result && result.title) {
        setProcessingState('synthesizing');

        const newRecipe: Recipe = {
          id: `recipe-${Date.now()}`,
          title: result.title,
          source_url: url,
          creator: result.creator || '@tiktok_chef',
          thumbnail_url: result.thumbnail_url,
          ingredients: result.ingredients || [],
          steps: (result.steps || []).map((s: any, i: number) => ({
            ...s,
            step_number: s.step_number || i + 1,
            timestamp_start: s.timestamp_start || 0,
            timestamp_end: s.timestamp_end || 0,
          })),
          sources: result.sources || [],
          status: 'extracted',
          created_at: new Date().toISOString(),
        };

        setRecipes(prev => [newRecipe, ...prev]);
        setSelectedRecipe(newRecipe);
        setProcessingState('idle');
      } else {
        setProcessingState('error');
      }
    } catch (err) {
      console.error('Extraction error:', err);
      setProcessingState('error');
    }
  };

  const saveRecipe = (updated: Recipe) => {
    setRecipes(prev => prev.map(r => (r.id === updated.id ? updated : r)));
    setSelectedRecipe(null);
  };

  const deleteRecipe = (id: string) => {
    setRecipes(prev => prev.filter(r => r.id !== id));
  };

  const clearAll = () => {
    clearAllStorage();
    setRecipes([]);
    setSelectedRecipe(null);
    setProcessingState('idle');
  };

  const dismissError = () => setProcessingState('idle');

  return {
    recipes,
    setRecipes,

    processingState,
    setProcessingState,
    dismissError,

    selectedRecipe,
    setSelectedRecipe,

    filter,
    setFilter,
    sortBy,
    setSortBy,
    filteredAndSortedRecipes,

    extractFromUrl,
    saveRecipe,
    deleteRecipe,
    clearAll,
  };
}
