
import React, { useState } from 'react';

interface UrlInputProps {
  onExtract: (url: string) => void;
  isLoading: boolean;
}

const UrlInput: React.FC<UrlInputProps> = ({ onExtract, isLoading }) => {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) onExtract(url);
  };

  return (
    <div className="max-w-3xl mx-auto mb-12">
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 to-cyan-500 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-1000"></div>
        <div className="relative flex items-center bg-slate-900 rounded-2xl p-2 border border-white/10">
          <div className="pl-4 text-slate-400">
            <i className="fa-brands fa-tiktok text-xl"></i>
          </div>
          <input
            type="text"
            placeholder="Paste TikTok URL to extract recipe..."
            className="w-full bg-transparent border-none focus:ring-0 text-white px-4 py-3 placeholder:text-slate-600"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="submit"
            disabled={isLoading || !url}
            className={`tiktok-gradient px-8 py-3 rounded-xl font-bold text-white transition-all shadow-lg shadow-pink-500/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95`}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <i className="fa-solid fa-spinner fa-spin"></i> Analyzing...
              </span>
            ) : 'Extract Recipe'}
          </button>
        </div>
      </form>
      <div className="mt-4 flex justify-center gap-4 text-xs text-slate-500 font-medium">
        <span className="flex items-center gap-1"><i className="fa-solid fa-check text-emerald-500"></i> OCR Visual Analysis</span>
        <span className="flex items-center gap-1"><i className="fa-solid fa-check text-emerald-500"></i> Whisper Audio ASR</span>
        <span className="flex items-center gap-1"><i className="fa-solid fa-check text-emerald-500"></i> LLM Synthesis</span>
      </div>
    </div>
  );
};

export default UrlInput;
