import React, { useState, useEffect, useMemo } from 'react';
import { Recipe, PlannerData } from './types';
import Navbar from './components/Navbar';
import UrlInput from './components/UrlInput';
import RecipeCard from './components/RecipeCard';
import RecipeEditor from './components/RecipeEditor';
import Settings from './components/Settings';
import ProcessingVisualizer from './components/ProcessingVisualizer';
import { extractRecipeFromUrl } from './services/geminiService';
import {
  loadRecipes,
  saveRecipes,
  loadPlanner,
  savePlanner,
  clearAllStorage
} from './services/storage';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const App: React.FC = () => {
  const [currentView, setCurrentView] =
    useState<'dashboard' | 'planner' | 'settings'>('dashboard');

  const [recipes, setRecipes] = useState<Recipe[]>(loadRecipes);
  const [planner, setPlanner] = useState<PlannerData>(loadPlanner);

  const [processingState, setProcessingState] = useState<'idle' | 'fetching' | 'analyzing' | 'synthesizing' | 'error'>('idle');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showPickerForDay, setShowPickerForDay] = useState<string | null>(null);

  const [filter, setFilter] = useState<'all' | 'extracted' | 'validated'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'status'>('date');

  useEffect(() => {
    saveRecipes(recipes);
  }, [recipes]);

  useEffect(() => {
    savePlanner(planner);
  }, [planner]);

  const filteredAndSortedRecipes = useMemo(() => {
    return recipes
      .filter(r => filter === 'all' || r.status === filter)
      .sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'status') return a.status.localeCompare(b.status);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [recipes, filter, sortBy]);

  const handleExtract = async (url: string) => {
    if (!url.includes('tiktok.com')) {
      alert('Please enter a valid TikTok URL');
      return;
    }

    setProcessingState('fetching');

    try {
      const result = await extractRecipeFromUrl(url);

      if (!result || !result.title) {
        setProcessingState('error');
        return;
      }

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
          timestamp_end: s.timestamp_end || 0
        })),
        sources: result.sources || [],
        status: 'extracted',
        created_at: new Date().toISOString()
      };

      setRecipes(prev => [newRecipe, ...prev]);
      setSelectedRecipe(newRecipe);
      setProcessingState('idle');
    } catch (err) {
      console.error(err);
      setProcessingState('error');
    }
  };

  const handleSaveRecipe = (updated: Recipe) => {
    setRecipes(prev => prev.map(r => (r.id === updated.id ? updated : r)));
    setSelectedRecipe(null);
  };

  const handleDeleteRecipe = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Wil je dit recept definitief verwijderen uit je kluis?')) return;

    setRecipes(prev => prev.filter(r => r.id !== id));
    setPlanner(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(day => {
        next[day] = next[day]?.filter(rid => rid !== id) || [];
      });
      return next;
    });
  };

  const addToPlanner = (day: string, recipeId: string) => {
    setPlanner(prev => ({
      ...prev,
      [day]: [...(prev[day] || []), recipeId]
    }));
    setShowPickerForDay(null);
  };

  const removeFromPlanner = (day: string, recipeId: string) => {
    setPlanner(prev => ({
      ...prev,
      [day]: (prev[day] || []).filter(id => id !== recipeId)
    }));
  };

  const handleClearRecipes = () => {
    clearAllStorage();
    setRecipes([]);
    setPlanner({});
    alert('Recipe Vault cleared.');
  };

  const handleClearPlanner = () => {
    setPlanner({});
    savePlanner({});
    alert('Meal Planner cleared.');
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-950 text-slate-200">
      <Navbar onSetView={setCurrentView} currentView={currentView} />

      <main className="container mx-auto px-6 pt-12">
        {/* dashboard / planner / settings UI blijft ongewijzigd */}
        {/* je bestaande JSX kan hier 그대로 blijven */}
      </main>

      {selectedRecipe && (
        <RecipeEditor
          recipe={selectedRecipe}
          onSave={handleSaveRecipe}
          onClose={() => setSelectedRecipe(null)}
        />
      )}

      {processingState === 'error' && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-red-500 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 z-[200]">
          <p className="font-bold">Extraction failed</p>
          <button
            onClick={() => setProcessingState('idle')}
            className="bg-white/20 px-4 py-1 rounded-lg text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
