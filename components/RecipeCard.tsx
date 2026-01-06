
import React, { useState } from 'react';
import { Recipe } from '../types';

interface RecipeCardProps {
  recipe: Recipe;
  onClick: (recipe: Recipe) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

const RecipeCard: React.FC<RecipeCardProps> = ({ recipe, onClick, onDelete }) => {
  const [showShareFeedback, setShowShareFeedback] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(recipe.isLiked || false);
  const [likes, setLikes] = useState(recipe.likes || 0);

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ingredients = recipe.ingredients.map(i => `- ${i.quantity} ${i.unit} ${i.name}`).join('\n');
    const steps = recipe.steps.map(s => `${s.step_number}. ${s.instruction}`).join('\n');
    const shareText = `Check out this recipe I extracted with TokToTable AI!\n\n${recipe.title}\nBy ${recipe.creator}\n\nIngredients:\n${ingredients}\n\nSteps:\n${steps}`;
    
    navigator.clipboard.writeText(shareText);
    setShowShareFeedback(true);
    setTimeout(() => setShowShareFeedback(false), 2000);
  };

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
    setLikes(prev => isLiked ? prev - 1 : prev + 1);
  };

  return (
    <div 
      onClick={() => onClick(recipe)}
      className="group relative glass-panel rounded-2xl overflow-hidden cursor-pointer hover:border-pink-500/50 transition-all hover:shadow-2xl hover:shadow-pink-500/10 h-full flex flex-col"
    >
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
        <button 
          onClick={(e) => onDelete(recipe.id, e)}
          className="w-9 h-9 rounded-full bg-black/60 hover:bg-red-500 text-white flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all backdrop-blur-md border border-white/10"
          title="Delete recipe"
        >
          <i className="fa-solid fa-trash-can text-sm"></i>
        </button>
        <button 
          onClick={handleLike}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all backdrop-blur-md border border-white/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 ${isLiked ? 'bg-pink-500 text-white' : 'bg-black/60 hover:text-pink-400'}`}
          title="Like recipe"
        >
          <i className="fa-solid fa-heart text-sm"></i>
        </button>
        <button 
          onClick={handleShare}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all backdrop-blur-md border border-white/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 ${showShareFeedback ? 'bg-emerald-500 text-white' : 'bg-black/60 hover:text-cyan-400'}`}
          title="Share recipe"
        >
          <i className={`fa-solid ${showShareFeedback ? 'fa-check' : 'fa-share-nodes'} text-sm`}></i>
        </button>
      </div>

      <div className="relative aspect-[3/4] overflow-hidden bg-slate-900 flex items-center justify-center">
        {imgLoading && !imgError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <i className="fa-solid fa-spinner fa-spin text-slate-700"></i>
          </div>
        )}
        
{imgError ? (
  <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 text-center">
    <i className="fa-solid fa-utensils text-4xl text-slate-700 mb-3"></i>
    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
      Image Unavailable
    </span>
  </div>
) : (
  <img
    src={recipe.thumbnail_url}
    alt={recipe.title}
    onLoad={() => setImgLoading(false)}
    onError={() => {
      setImgError(true);
      setImgLoading(false);
    }}
    style={{ objectPosition: "center 80%" }}
    className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${
      imgLoading ? "opacity-0" : "opacity-100"
    }`}
  />
)}


        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80"></div>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-1 mb-1">
            <div className="flex text-amber-400 text-[10px]">
              {[...Array(5)].map((_, i) => (
                <i key={i} className={`fa-solid fa-star ${i < Math.floor(recipe.rating || 4) ? 'opacity-100' : 'opacity-30'}`}></i>
              ))}
            </div>
            <span className="text-[9px] text-slate-400 font-bold">({recipe.rating || '4.0'})</span>
          </div>
          <p className="text-[10px] font-bold text-pink-400 uppercase tracking-widest mb-1">
            {recipe.creator || '@creator'}
          </p>
          <h3 className="text-lg font-bold leading-tight group-hover:text-pink-300 transition-colors line-clamp-2">
            {recipe.title}
          </h3>
        </div>
        <div className="absolute top-3 right-3">
          <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-lg ${
            recipe.status === 'validated' ? 'bg-emerald-500 text-white border border-emerald-400' : 'bg-amber-500 text-white border border-amber-400'
          }`}>
            {recipe.status}
          </span>
        </div>
      </div>
      <div className="p-4 flex justify-between items-center text-slate-400 text-xs border-t border-white/5 mt-auto bg-slate-900/40">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><i className="fa-solid fa-heart text-pink-500"></i> {likes}</span>
          <span className="flex items-center gap-1"><i className="fa-solid fa-comment text-cyan-500"></i> {recipe.comments?.length || 0}</span>
          <span className="flex items-center gap-1"><i className="fa-solid fa-list-check text-slate-500"></i> {recipe.ingredients.length}</span>
        </div>
        <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
      </div>
    </div>
  );
};

export default RecipeCard;
