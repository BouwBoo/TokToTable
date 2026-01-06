// components/CleanupDrawer.tsx

import React from 'react';
import type { CleanupSuggestion } from '../services/cleanupService';

type Props = {
  open: boolean;
  onClose: () => void;
  suggestions: CleanupSuggestion[];
};

const sevDot = (sev: CleanupSuggestion['severity']) => {
  if (sev === 'high') return 'bg-red-500';
  if (sev === 'medium') return 'bg-amber-500';
  return 'bg-slate-400';
};

const CleanupDrawer: React.FC<Props> = ({ open, onClose, suggestions }) => {
  if (!open) return null;

  const copyChecklist = async () => {
    const text =
      `TokToTable — Opschoonlijst (read-only)\n` +
      `Generated: ${new Date().toLocaleString()}\n\n` +
      suggestions
        .map(s => {
          const n = typeof s.affectedCount === 'number' ? ` (${s.affectedCount})` : '';
          return `- [ ] ${s.title}${n}\n${s.detail ? '  ' + s.detail.replace(/\n/g, '\n  ') : ''}`.trim();
        })
        .join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      alert('Checklist copied to clipboard.');
    } catch {
      alert('Copy failed (browser permissions).');
    }
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-slate-950 border-l border-slate-800 shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Opschoonlijst</h2>
            <p className="text-xs text-slate-400">
              Alleen suggesties (v1). Nog geen automatische fixes.
            </p>
          </div>

          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-bold"
          >
            Close
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-auto h-[calc(100%-120px)]">
          {suggestions.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <p className="font-bold">Geen suggesties 🎉</p>
              <p className="text-sm text-slate-400 mt-1">
                (Of er is nog geen shopping list data om te analyseren.)
              </p>
            </div>
          ) : (
            suggestions.map(s => (
              <div key={s.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-start gap-3">
                  <div className={`mt-1 h-3 w-3 rounded-full ${sevDot(s.severity)}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold">
                        {s.title}
                        {typeof s.affectedCount === 'number' ? (
                          <span className="text-slate-400 font-semibold"> · {s.affectedCount}</span>
                        ) : null}
                      </div>
                      <span className="text-[11px] uppercase tracking-wider text-slate-400">
                        {s.category}
                      </span>
                    </div>

                    {s.detail ? (
                      <pre className="mt-2 text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {s.detail}
                      </pre>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={copyChecklist}
            className="flex-1 px-4 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 font-bold"
          >
            Copy checklist
          </button>

          <button
            onClick={onClose}
            className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default CleanupDrawer;
