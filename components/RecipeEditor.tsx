
import React, { useState, useEffect, useCallback } from 'react';
import { Recipe, Ingredient, Step, Comment } from '../types';
import { generateRecipeImage } from '../services/aiClient';


interface RecipeEditorProps {
  recipe: Recipe;
  onSave: (updated: Recipe) => void;
  onClose: () => void;
}

const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
  'g': { 'cups': 0.008, 'oz': 0.035, 'lb': 0.0022 },
  'cups': { 'g': 125, 'ml': 236, 'oz': 8 },
  'ml': { 'cups': 0.0042, 'oz': 0.033, 'tbsp': 0.067 },
  'oz': { 'g': 28.35, 'ml': 29.57, 'cups': 0.125 },
};

const COMMON_UNITS = ['g', 'ml', 'cups', 'oz', 'tbsp', 'tsp', 'lb', 'pcs', 'kg', 'can', 'cloves', 'handful', 'pinch'];

const UNIT_ALIASES: Record<string, string> = {
  'gram': 'g', 'grams': 'g', 'grm': 'g',
  'milliliter': 'ml', 'milliliters': 'ml',
  'cup': 'cups', 'cp': 'cups',
  'tablespoon': 'tbsp', 'tablespoons': 'tbsp', 'tbspn': 'tbsp',
  'teaspoon': 'tsp', 'teaspoons': 'tsp', 'tspn': 'tsp',
  'ounce': 'oz', 'ounces': 'oz',
  'pound': 'lb', 'pounds': 'lb',
  'piece': 'pcs', 'pieces': 'pcs',
  'kilogram': 'kg', 'kilograms': 'kg'
};

const RecipeEditor: React.FC<RecipeEditorProps> = ({ recipe, onSave, onClose }) => {
  const [editedRecipe, setEditedRecipe] = useState<Recipe>(recipe);
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [dragOverStepIndex, setDragOverStepIndex] = useState<number | null>(null);
  const [draggedIngIndex, setDraggedIngIndex] = useState<number | null>(null);
  const [dragOverIngIndex, setDragOverIngIndex] = useState<number | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [servings, setServings] = useState(2);
  const [selectedIngredients, setSelectedIngredients] = useState<Set<number>>(new Set());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [newComment, setNewComment] = useState('');
  const [showShareFeedback, setShowShareFeedback] = useState(false);
  
  const [history, setHistory] = useState<Recipe[]>([recipe]);
  const [historyIndex, setHistoryIndex] = useState(0);

  useEffect(() => {
    setEditedRecipe(recipe);
    setHistory([recipe]);
    setHistoryIndex(0);
  }, [recipe]);

  const updateState = useCallback((newRecipe: Recipe) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newRecipe);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setEditedRecipe(newRecipe);
  }, [history, historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      setEditedRecipe(history[prevIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      setEditedRecipe(history[nextIndex]);
    }
  };

  const secondsToTimestamp = (totalSeconds: number) => {
    const safeSecs = Math.max(0, totalSeconds);
    const hrs = Math.floor(safeSecs / 3600);
    const mins = Math.floor((safeSecs % 3600) / 60);
    const secs = safeSecs % 60;
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timestampToSeconds = (val: string) => {
    const clean = val.replace(/[^0-9:]/g, '');
    const parts = clean.split(':').map(p => parseInt(p) || 0);
    let total = 0;
    if (parts.length === 3) total = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    else if (parts.length === 2) total = (parts[0] * 60) + parts[1];
    else if (parts.length === 1) total = parts[0];
    return total;
  };

  const scaleQuantity = (qty: string | number, currentServings: number) => {
    const base = 2;
    const parseQty = (val: string | number) => {
      if (typeof val === 'number') return val;
      const match = val.match(/^(\d+([./]\d+)?)/);
      if (!match) return NaN;
      if (match[1].includes('/')) {
        const [num, den] = match[1].split('/').map(Number);
        return num / den;
      }
      return parseFloat(match[1]);
    };

    const num = parseQty(qty);
    if (isNaN(num)) return qty;

    const scaled = (num / base) * currentServings;
    const formatted = scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(2).replace(/\.?0+$/, "");
    
    if (typeof qty === 'string') {
      return qty.replace(/^(\d+([./]\d+)?)/, formatted);
    }
    return scaled;
  };

  const validateQuantity = (val: string) => {
    const regex = /^(\d+)?(\s+)?(\d+\/\d+)?(\s*-\s*\d+)?(\s+)?(\d+(\.\d+)?)?$/;
    return regex.test(val.trim()) || val === "";
  };

  const normalizeUnit = (unit: string) => {
    const low = unit.toLowerCase().trim();
    return UNIT_ALIASES[low] || unit;
  };

  const convertUnit = (idx: number, targetUnit: string) => {
    const ing = editedRecipe.ingredients[idx];
    const normalizedTarget = normalizeUnit(targetUnit);
    const currentUnit = normalizeUnit(ing.unit);
    
    if (currentUnit === normalizedTarget || !UNIT_CONVERSIONS[currentUnit]?.[normalizedTarget]) {
      handleIngredientChange(idx, 'unit', targetUnit);
      return;
    }

    const factor = UNIT_CONVERSIONS[currentUnit][normalizedTarget];
    const qtyNum = parseFloat(ing.quantity.toString()) || 0;
    const newQty = (qtyNum * factor).toFixed(2).replace(/\.?0+$/, "");
    
    const updatedIngredients = [...editedRecipe.ingredients];
    updatedIngredients[idx] = { ...ing, quantity: newQty, unit: targetUnit };
    updateState({ ...editedRecipe, ingredients: updatedIngredients });
  };

  const handleTitleChange = (value: string) => {
    updateState({ ...editedRecipe, title: value });
  };

  const handleIngredientChange = (index: number, field: keyof Ingredient, value: string) => {
    if (field === 'quantity' && !validateQuantity(value)) return;
    
    const updatedIngredients = [...editedRecipe.ingredients];
    const finalValue = field === 'unit' ? normalizeUnit(value) : value;
    updatedIngredients[index] = { ...updatedIngredients[index], [field]: finalValue };
    updateState({ ...editedRecipe, ingredients: updatedIngredients });
  };

  const fillMissingRawText = () => {
    const updatedIngredients = editedRecipe.ingredients.map(ing => {
      if (!ing.raw_text || ing.raw_text.trim() === '') {
        return { ...ing, raw_text: `${ing.quantity} ${ing.unit} ${ing.name}`.trim() };
      }
      return ing;
    });
    updateState({ ...editedRecipe, ingredients: updatedIngredients });
  };

  const toggleIngredientSelection = (index: number) => {
    const newSelection = new Set(selectedIngredients);
    if (newSelection.has(index)) newSelection.delete(index);
    else newSelection.add(index);
    setSelectedIngredients(newSelection);
  };

  const deleteIngredient = (index: number) => {
    const updatedIngredients = editedRecipe.ingredients.filter((_, i) => i !== index);
    updateState({ ...editedRecipe, ingredients: updatedIngredients });
  };

  const deleteSelectedIngredients = () => {
    const updatedIngredients = editedRecipe.ingredients.filter((_, i) => !selectedIngredients.has(i));
    updateState({ ...editedRecipe, ingredients: updatedIngredients });
    setSelectedIngredients(new Set());
  };

  const handleStepChange = (index: number, field: keyof Step, value: any) => {
    const updatedSteps = [...editedRecipe.steps];
    updatedSteps[index] = { ...updatedSteps[index], [field]: value };
    updateState({ ...editedRecipe, steps: updatedSteps });
  };

  const adjustTimestamp = (idx: number, field: 'timestamp_start' | 'timestamp_end', delta: number) => {
    const updatedSteps = [...editedRecipe.steps];
    const current = updatedSteps[idx][field] || 0;
    updatedSteps[idx] = { ...updatedSteps[idx], [field]: Math.max(0, current + delta) };
    updateState({ ...editedRecipe, steps: updatedSteps });
  };

  const deleteStep = (index: number) => {
    const updatedSteps = editedRecipe.steps
      .filter((_, i) => i !== index)
      .map((step, i) => ({ ...step, step_number: i + 1 }));
    updateState({ ...editedRecipe, steps: updatedSteps });
  };

  const addIngredient = () => {
    updateState({
      ...editedRecipe,
      ingredients: [...editedRecipe.ingredients, { name: '', quantity: '', unit: '', raw_text: '' }]
    });
  };

  const addStep = () => {
    updateState({
      ...editedRecipe,
      steps: [...editedRecipe.steps, { step_number: editedRecipe.steps.length + 1, instruction: '', timestamp_start: 0, timestamp_end: 0 }]
    });
  };

const handleRegenerateImage = async () => {
  setIsGeneratingImage(true);
  try {
    const newImageUrl = await generateRecipeImage(
      editedRecipe.title,
      editedRecipe.ingredients
    );
    if (newImageUrl) {
      updateState({ ...editedRecipe, thumbnail_url: newImageUrl });
    }
  } catch (err) {
    console.error("Image generation failed", err);
  } finally {
    setIsGeneratingImage(false);
  }
};


  const handleStepDrop = (index: number) => {
    if (draggedStepIndex === null) return;
    const updatedSteps = [...editedRecipe.steps];
    const itemToMove = updatedSteps.splice(draggedStepIndex, 1)[0];
    updatedSteps.splice(index, 0, itemToMove);
    const reindexedSteps = updatedSteps.map((s, i) => ({ ...s, step_number: i + 1 }));
    updateState({ ...editedRecipe, steps: reindexedSteps });
    setDraggedStepIndex(null);
    setDragOverStepIndex(null);
  };

  const handleIngDrop = (index: number) => {
    if (draggedIngIndex === null) return;
    const updatedIngredients = [...editedRecipe.ingredients];
    const itemToMove = updatedIngredients.splice(draggedIngIndex, 1)[0];
    updatedIngredients.splice(index, 0, itemToMove);
    updateState({ ...editedRecipe, ingredients: updatedIngredients });
    setDraggedIngIndex(null);
    setDragOverIngIndex(null);
  };

  const copyToClipboard = (text: string, index: number) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    const comment: Comment = {
      id: `c-${Date.now()}`,
      user: 'You',
      text: newComment,
      date: new Date().toISOString()
    };
    updateState({
      ...editedRecipe,
      comments: [...(editedRecipe.comments || []), comment]
    });
    setNewComment('');
  };

  const handleSetRating = (val: number) => {
    updateState({ ...editedRecipe, rating: val });
  };

  const handleToggleLike = () => {
    const isCurrentlyLiked = !!editedRecipe.isLiked;
    updateState({
      ...editedRecipe,
      isLiked: !isCurrentlyLiked,
      likes: (editedRecipe.likes || 0) + (isCurrentlyLiked ? -1 : 1)
    });
  };

  const handleShare = () => {
    const ingredients = editedRecipe.ingredients.map(i => `- ${i.quantity} ${i.unit} ${i.name}`).join('\n');
    const steps = editedRecipe.steps.map(s => `${s.step_number}. ${s.instruction}`).join('\n');
    const shareText = `Check out this recipe I extracted with TokToTable AI!\n\n${editedRecipe.title}\nBy ${editedRecipe.creator}\n\nIngredients:\n${ingredients}\n\nSteps:\n${steps}`;
    
    navigator.clipboard.writeText(shareText);
    setShowShareFeedback(true);
    setTimeout(() => setShowShareFeedback(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 md:p-8 bg-slate-950/95 backdrop-blur-xl animate-fadeIn overflow-hidden">
      <div className="glass-panel w-full max-w-6xl h-full sm:h-[92vh] rounded-none sm:rounded-[32px] overflow-hidden flex flex-col shadow-2xl border-white/10 ring-1 ring-white/10">
        
        <div className="p-4 sm:p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/5 gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button onClick={onClose} className="w-9 h-9 flex-shrink-0 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors text-slate-400">
              <i className="fa-solid fa-arrow-left text-lg"></i>
            </button>
            <div className="flex items-center gap-1 border-r border-white/10 pr-3">
              <button onClick={handleUndo} disabled={historyIndex === 0} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-slate-400 disabled:opacity-20" title="Undo (Ctrl+Z)">
                <i className="fa-solid fa-rotate-left"></i>
              </button>
              <button onClick={handleRedo} disabled={historyIndex === history.length - 1} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/10 text-slate-400 disabled:opacity-20" title="Redo (Ctrl+Y)">
                <i className="fa-solid fa-rotate-right"></i>
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <input 
                value={editedRecipe.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="bg-transparent border-none focus:ring-0 text-lg sm:text-2xl font-black w-full text-white placeholder:text-slate-700 p-0 tracking-tight truncate"
                placeholder="Dish Name"
              />
              <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase tracking-widest font-bold truncate">
                {recipe.creator} • <span className="text-cyan-500">TokToTable Extraction</span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={handleToggleLike}
              className={`px-4 py-2.5 rounded-xl sm:rounded-2xl font-bold transition-all flex items-center gap-2 ${editedRecipe.isLiked ? 'bg-pink-500 text-white' : 'bg-white/5 text-slate-400 hover:text-pink-400'}`}
            >
              <i className="fa-solid fa-heart"></i> {editedRecipe.likes || 0}
            </button>
            <button 
              onClick={handleShare}
              className={`px-4 py-2.5 rounded-xl sm:rounded-2xl font-bold transition-all flex items-center gap-2 ${showShareFeedback ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-400 hover:text-cyan-400'}`}
            >
              <i className={`fa-solid ${showShareFeedback ? 'fa-check' : 'fa-share-nodes'}`}></i>
            </button>
            <button 
              onClick={() => onSave({ ...editedRecipe, status: 'validated' })}
              className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-xl sm:rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-900/40"
            >
              <i className="fa-solid fa-circle-check"></i> Validate
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-10 grid md:grid-cols-2 gap-8 sm:gap-12 custom-scrollbar bg-slate-950/50">
          
          <div className="space-y-8">
            <div className="aspect-video sm:aspect-[16/9] rounded-[24px] bg-black overflow-hidden relative group shadow-2xl border border-white/5">
              <img src={editedRecipe.thumbnail_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Thumbnail" />
              <div className="absolute inset-0 bg-black/40"></div>
              <div className="absolute top-3 right-3 z-20">
                <button 
                  onClick={handleRegenerateImage}
                  disabled={isGeneratingImage}
                  className="bg-black/60 hover:bg-pink-600 text-white p-3 rounded-full backdrop-blur-md border border-white/10 transition-all"
                  title="Regenerate AI Visual"
                >
                  <i className={`fa-solid ${isGeneratingImage ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                </button>
              </div>
            </div>

            <section className="bg-white/5 border border-white/10 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Rate this dish</h4>
                <div className="flex gap-1 text-lg">
                  {[1, 2, 3, 4, 5].map(num => (
                    <button 
                      key={num} 
                      onClick={() => handleSetRating(num)}
                      className={`transition-colors ${num <= (editedRecipe.rating || 0) ? 'text-amber-400' : 'text-slate-700 hover:text-amber-400/50'}`}
                    >
                      <i className="fa-solid fa-star"></i>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                <span className="text-[10px] font-black text-pink-500 uppercase tracking-widest px-3">Servings</span>
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <button
                    key={num}
                    onClick={() => setServings(num)}
                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${servings === num ? 'bg-pink-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center"><i className="fa-solid fa-leaf text-emerald-500 text-sm"></i></span>
                  Ingredients {selectedIngredients.size > 0 && <span className="text-xs text-pink-500">({selectedIngredients.size} selected)</span>}
                </h3>
                <div className="flex gap-2">
                  <button onClick={fillMissingRawText} className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-full hover:bg-amber-400/20 transition-colors" title="Fill missing raw text from fields">
                    Auto-Fill Raw
                  </button>
                  {selectedIngredients.size > 0 && (
                    <button onClick={deleteSelectedIngredients} className="text-[10px] font-bold text-red-400 bg-red-400/10 px-3 py-1.5 rounded-full hover:bg-red-400/20 transition-colors">
                      Delete Selected
                    </button>
                  )}
                  <button onClick={addIngredient} className="text-[10px] font-bold text-cyan-400 bg-cyan-400/10 px-3 py-1.5 rounded-full hover:bg-cyan-400/20 transition-colors">
                    + Add
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                {editedRecipe.ingredients.map((ing, idx) => (
                  <div 
                    key={idx} 
                    draggable
                    onDragStart={() => setDraggedIngIndex(idx)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverIngIndex(idx); }}
                    onDragLeave={() => setDragOverIngIndex(null)}
                    onDrop={() => handleIngDrop(idx)}
                    className={`flex flex-col bg-slate-900/50 p-4 rounded-2xl border transition-all ${
                      draggedIngIndex === idx ? 'opacity-30' : 
                      dragOverIngIndex === idx ? 'border-pink-500/50 bg-pink-500/5' : 
                      selectedIngredients.has(idx) ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-white/5'
                    }`}
                  >
                    <div className="flex gap-3 items-start">
                      <div className="mt-1 flex flex-col gap-2">
                        <input 
                          type="checkbox" 
                          checked={selectedIngredients.has(idx)} 
                          onChange={() => toggleIngredientSelection(idx)}
                          className="rounded border-white/20 bg-slate-800 text-pink-500 focus:ring-pink-500/20 w-4 h-4 cursor-pointer"
                        />
                        <button 
                          onClick={() => deleteIngredient(idx)}
                          className="text-slate-700 hover:text-red-500 transition-colors p-1"
                          title="Delete ingredient"
                        >
                          <i className="fa-solid fa-trash text-[10px]"></i>
                        </button>
                      </div>
                      <div className="flex-1 space-y-3 min-w-0">
                        <div className="grid grid-cols-12 gap-3">
                          <div className="col-span-3">
                            <label className="text-[8px] font-black text-pink-500 uppercase block mb-1">Qty</label>
                            <input 
                              className="bg-white/10 border-none focus:ring-1 focus:ring-pink-500/50 text-[12px] w-full text-white font-bold rounded-lg px-2 py-1.5"
                              value={scaleQuantity(ing.quantity, servings)}
                              onChange={(e) => handleIngredientChange(idx, 'quantity', e.target.value)}
                            />
                          </div>
                          <div className="col-span-3">
                            <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Unit</label>
                            <select 
                              className="bg-white/5 border-none focus:ring-1 focus:ring-pink-500/50 text-[11px] w-full text-slate-400 rounded-lg px-1 py-1.5 cursor-pointer"
                              value={normalizeUnit(ing.unit)}
                              onChange={(e) => convertUnit(idx, e.target.value)}
                            >
                              {COMMON_UNITS.map(u => (
                                <option key={u} value={u} className="bg-slate-900">{u}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-6">
                            <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Ingredient Name</label>
                            <input 
                              className="bg-transparent border-b border-white/5 focus:border-cyan-500/50 focus:ring-0 text-sm font-semibold text-slate-200 w-full"
                              value={ing.name}
                              onChange={(e) => handleIngredientChange(idx, 'name', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="relative">
                          <label className="text-[8px] font-black text-slate-500 uppercase block mb-1">Raw Extracted Text</label>
                          <div className="flex items-center gap-2">
                            <textarea 
                              className="flex-1 bg-black/30 border-none rounded-lg text-[10px] text-slate-500 p-2 min-h-[40px] resize-none italic leading-normal"
                              value={ing.raw_text}
                              onChange={(e) => handleIngredientChange(idx, 'raw_text', e.target.value)}
                              placeholder="Original text from video..."
                            />
                            <button 
                              onClick={() => copyToClipboard(ing.raw_text, idx)} 
                              className={`p-2 rounded-lg transition-all ${copiedIndex === idx ? 'text-emerald-400 bg-emerald-400/10' : 'text-slate-600 hover:text-cyan-400 hover:bg-cyan-400/10'}`}
                              title="Copy raw data"
                            >
                              <i className={`fa-solid ${copiedIndex === idx ? 'fa-check' : 'fa-copy'} text-sm`}></i>
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 cursor-move text-slate-800 hover:text-slate-600 p-2">
                        <i className="fa-solid fa-grip-vertical"></i>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-10">
            <section>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-3">
                   <span className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center"><i className="fa-solid fa-fire text-orange-500 text-sm"></i></span>
                  Cooking Steps
                </h3>
                <button onClick={addStep} className="text-[10px] font-bold text-cyan-400 bg-cyan-400/10 px-3 py-1.5 rounded-full hover:bg-cyan-400/20 transition-colors">
                  + Add Step
                </button>
              </div>

              <div className="space-y-6">
                {editedRecipe.steps.map((step, idx) => (
                  <div 
                    key={idx} 
                    draggable
                    onDragStart={() => setDraggedStepIndex(idx)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverStepIndex(idx); }}
                    onDragLeave={() => setDragOverStepIndex(null)}
                    onDrop={() => handleStepDrop(idx)}
                    className={`group relative flex gap-4 bg-slate-900/40 p-6 rounded-[24px] border transition-all ${
                      draggedStepIndex === idx ? 'opacity-30' : 
                      dragOverStepIndex === idx ? 'border-pink-500/50 bg-pink-500/5 translate-y-1' : 'border-white/5'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-sm font-black text-slate-400 border border-white/5 group-hover:border-pink-500/50 transition-all cursor-move">
                        {idx + 1}
                      </div>
                      <div className="w-px flex-1 bg-white/5"></div>
                    </div>

                    <div className="flex-1 space-y-4">
                      <textarea 
                        className="w-full bg-transparent border-none rounded-xl text-sm focus:ring-0 outline-none min-h-[70px] resize-none text-slate-200 p-0 leading-relaxed font-medium placeholder:text-slate-700"
                        value={step.instruction}
                        onChange={(e) => handleStepChange(idx, 'instruction', e.target.value)}
                        placeholder="Describe what happens in this step..."
                      />
                      
                      <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-white/5">
                        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 bg-black/40 px-4 py-2 rounded-xl border border-white/5">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[7px] uppercase text-slate-600 font-black mb-1">Start Time</span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => adjustTimestamp(idx, 'timestamp_start', -5)} className="text-slate-600 hover:text-white transition-colors"><i className="fa-solid fa-minus"></i></button>
                              <input 
                                type="text"
                                className="bg-transparent border-none p-0 text-cyan-400 font-mono w-20 text-center focus:ring-0 text-xs"
                                value={secondsToTimestamp(step.timestamp_start || 0)}
                                onChange={(e) => handleStepChange(idx, 'timestamp_start', timestampToSeconds(e.target.value))}
                                placeholder="00:00:00"
                              />
                              <button onClick={() => adjustTimestamp(idx, 'timestamp_start', 5)} className="text-slate-600 hover:text-white transition-colors"><i className="fa-solid fa-plus"></i></button>
                            </div>
                          </div>
                          <div className="w-px h-8 bg-white/10"></div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[7px] uppercase text-slate-600 font-black mb-1">End Time</span>
                            <div className="flex items-center gap-2">
                              <button onClick={() => adjustTimestamp(idx, 'timestamp_end', -5)} className="text-slate-600 hover:text-white transition-colors"><i className="fa-solid fa-minus"></i></button>
                              <input 
                                type="text"
                                className="bg-transparent border-none p-0 text-pink-400 font-mono w-20 text-center focus:ring-0 text-xs"
                                value={secondsToTimestamp(step.timestamp_end || 0)}
                                onChange={(e) => handleStepChange(idx, 'timestamp_end', timestampToSeconds(e.target.value))}
                                placeholder="00:00:00"
                              />
                              <button onClick={() => adjustTimestamp(idx, 'timestamp_end', 5)} className="text-slate-600 hover:text-white transition-colors"><i className="fa-solid fa-plus"></i></button>
                            </div>
                          </div>
                        </div>
                        <div className="flex-1"></div>
                        <button 
                          onClick={() => deleteStep(idx)} 
                          className="w-9 h-9 flex items-center justify-center text-slate-700 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                          title="Delete step"
                        >
                          <i className="fa-solid fa-trash-can text-sm"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* NEW COMMENT SECTION */}
            <section className="pt-10 border-t border-white/10">
              <h3 className="text-lg font-bold text-white flex items-center gap-3 mb-6">
                <span className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center"><i className="fa-solid fa-comments text-cyan-500 text-sm"></i></span>
                Community Comments
              </h3>
              
              <div className="space-y-4 mb-6">
                {(editedRecipe.comments || []).length === 0 ? (
                  <p className="text-xs text-slate-500 italic text-center py-4 bg-white/5 rounded-2xl">No comments yet. Be the first to review!</p>
                ) : (
                  editedRecipe.comments?.map((comment) => (
                    <div key={comment.id} className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black text-pink-500 uppercase">{comment.user}</span>
                        <span className="text-[8px] text-slate-500">{new Date(comment.date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{comment.text}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Share your experience..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm focus:ring-1 focus:ring-cyan-500/50 outline-none text-slate-200"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                />
                <button 
                  onClick={handleAddComment}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-cyan-900/20"
                >
                  Post
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecipeEditor;
