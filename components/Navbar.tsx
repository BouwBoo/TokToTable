import React from 'react';

interface NavbarProps {
  onSetView: (view: 'dashboard' | 'planner' | 'shopping' | 'settings') => void;
  currentView: string;
}

const Navbar: React.FC<NavbarProps> = ({ onSetView, currentView }) => {
  return (
    <nav className="sticky top-0 z-50 glass-panel border-b border-white/10 px-6 py-4 flex justify-between items-center">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 tiktok-gradient rounded-xl flex items-center justify-center shadow-lg shadow-pink-500/20 cursor-pointer"
          onClick={() => onSetView('dashboard')}
        >
          <i className="fa-solid fa-concierge-bell text-white text-xl"></i>
        </div>
        <div>
          <h1
            className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 cursor-pointer"
            onClick={() => onSetView('dashboard')}
          >
            TokToTable
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">Multimodal Extraction</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button
          onClick={() => onSetView('dashboard')}
          className={`text-sm font-medium transition-colors ${
            currentView === 'dashboard' ? 'text-pink-400' : 'text-slate-300 hover:text-white'
          }`}
        >
          Dashboard
        </button>

        <button
          onClick={() => onSetView('planner')}
          className={`text-sm font-medium transition-colors ${
            currentView === 'planner' ? 'text-pink-400' : 'text-slate-300 hover:text-white'
          }`}
        >
          Planner
        </button>

        <button
          onClick={() => onSetView('shopping')}
          className={`text-sm font-medium transition-colors ${
            currentView === 'shopping' ? 'text-pink-400' : 'text-slate-300 hover:text-white'
          }`}
        >
          Shopping
        </button>

        <button
          onClick={() => onSetView('settings')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
            currentView === 'settings'
              ? 'bg-pink-500 text-white shadow-lg shadow-pink-500/20'
              : 'bg-white/10 text-slate-300 hover:bg-white/20'
          }`}
        >
          <i className="fa-solid fa-gear"></i> Settings
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
