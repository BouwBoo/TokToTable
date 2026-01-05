
import React, { useEffect, useState } from 'react';

const ProcessingVisualizer: React.FC = () => {
  const [stage, setStage] = useState(0);
  const stages = [
    { label: 'Fetching Metadata', icon: 'fa-cloud-arrow-down', color: 'text-blue-400' },
    { label: 'Google Search Grounding', icon: 'fa-earth-americas', color: 'text-cyan-400' },
    { label: 'Recipe LLM Synthesis', icon: 'fa-brain', color: 'text-purple-400' },
    { label: 'AI Dish Visualization', icon: 'fa-camera-retro', color: 'text-pink-400' },
    { label: 'Finalizing Recipe Vault', icon: 'fa-wand-magic-sparkles', color: 'text-emerald-400' }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStage(prev => (prev + 1) % stages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [stages.length]);

  return (
    <div className="max-w-md mx-auto p-8 glass-panel rounded-3xl border border-white/10 animate-pulse">
      <div className="flex flex-col items-center text-center space-y-6">
        <div className={`w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-3xl shadow-2xl ${stages[stage].color}`}>
          <i className={`fa-solid ${stages[stage].icon} animate-bounce`}></i>
        </div>
        <div>
          <h3 className="text-xl font-bold mb-1">Processing Multimodal Data</h3>
          <p className="text-sm text-slate-400 font-medium">Phase {stage + 1} of 5: {stages[stage].label}</p>
        </div>
        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div 
            className="h-full tiktok-gradient transition-all duration-1000 ease-in-out" 
            style={{ width: `${((stage + 1) / stages.length) * 100}%` }}
          ></div>
        </div>
        <div className="grid grid-cols-5 gap-2 w-full">
          {stages.map((_, i) => (
            <div key={i} className={`h-1 rounded-full ${i <= stage ? 'bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.5)]' : 'bg-slate-800'}`}></div>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 italic">"Imagining the final dish for your menu..."</p>
      </div>
    </div>
  );
};

export default ProcessingVisualizer;
