import React, { useState, useEffect } from 'react';

interface SettingsProps {
  onClearRecipes: () => void;
  onClearPlanner: () => void;
}

const Settings: React.FC<SettingsProps> = ({ onClearRecipes, onClearPlanner }) => {
  const [hasKey, setHasKey] = useState<boolean>(false);

  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      if (window.aistudio?.hasSelectedApiKey) {
        // @ts-ignore
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    // @ts-ignore
    if (window.aistudio?.openSelectKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-black mb-2">System <span className="text-pink-500">Settings</span></h2>
        <p className="text-slate-400 font-medium">Configure your AI extraction engine and manage your local data.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* AI CONFIGURATION */}
        <section className="glass-panel p-8 rounded-[32px] border-white/5 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <i className="fa-solid fa-microchip text-2xl"></i>
            </div>
            <div>
              <h3 className="font-bold text-xl">AI Engine</h3>
              <p className="text-xs text-slate-500">Gemini 3 Pro Integration</p>
            </div>
          </div>

          <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-slate-300">API Key Status</span>
              {hasKey ? (
                <span className="text-[10px] font-black uppercase px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20">Active</span>
              ) : (
                <span className="text-[10px] font-black uppercase px-2 py-1 bg-amber-500/10 text-amber-400 rounded-md border border-amber-500/20">Not Configured</span>
              )}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              TokToTable utilizes high-quality multimodal models. To ensure the best extraction results, you must select an API key from a paid GCP project.
            </p>
            <button 
              onClick={handleSelectKey}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/20"
            >
              <i className="fa-solid fa-key"></i> {hasKey ? 'Update API Key' : 'Configure API Key'}
            </button>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-center text-[10px] text-cyan-500 hover:underline font-bold"
            >
              <i className="fa-solid fa-circle-info mr-1"></i> Learn about API Billing
            </a>
          </div>
        </section>

        {/* DATA MANAGEMENT */}
        <section className="glass-panel p-8 rounded-[32px] border-white/5 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-pink-500/10 flex items-center justify-center text-pink-400">
              <i className="fa-solid fa-database text-2xl"></i>
            </div>
            <div>
              <h3 className="font-bold text-xl">Data Vault</h3>
              <p className="text-xs text-slate-500">Local Storage Management</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">Recipe Vault</p>
                <p className="text-[10px] text-slate-500">Remove all extracted recipes</p>
              </div>
              <button 
                onClick={() => { if(confirm('Delete all recipes?')) onClearRecipes(); }}
                className="p-3 text-slate-400 hover:text-red-400 transition-colors"
              >
                <i className="fa-solid fa-trash-can"></i>
              </button>
            </div>

            <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">Meal Planner</p>
                <p className="text-[10px] text-slate-500">Clear your weekly schedule</p>
              </div>
              <button 
                onClick={() => { if(confirm('Clear meal planner?')) onClearPlanner(); }}
                className="p-3 text-slate-400 hover:text-red-400 transition-colors"
              >
                <i className="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
            <p className="text-[10px] text-amber-500 leading-tight">
              <i className="fa-solid fa-triangle-exclamation mr-1"></i>
              Data is stored locally in your browser. Clearing your browser cache or switching devices will result in data loss unless you've backed it up.
            </p>
          </div>
        </section>
      </div>

      <div className="text-center pt-8 border-t border-white/5">
        <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">TokToTable AI v2.4.0-Stable</p>
      </div>
    </div>
  );
};

export default Settings;