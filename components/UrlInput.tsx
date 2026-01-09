// components/UrlInput.tsx
import React, { useMemo, useState } from "react";

interface UrlInputProps {
  onExtract: (url: string, caption?: string) => void;
  isLoading: boolean;

  // NEW (additive, non-breaking)
  isCooldown?: boolean;
  cooldownRemainingMs?: number;
}

function extractTikTokUrl(text: string): string | null {
  const t = (text || "").trim();
  if (!t) return null;

  const match = t.match(/https?:\/\/(www\.)?tiktok\.com\/[^\s]+/i);
  return match ? match[0].trim() : null;
}

const UrlInput: React.FC<UrlInputProps> = ({
  onExtract,
  isLoading,
  isCooldown = false,
  cooldownRemainingMs = 0,
}) => {
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");

  const inferredUrlFromCaption = useMemo(() => extractTikTokUrl(caption), [caption]);

  const effectiveUrl = useMemo(() => {
    const u = url.trim();
    if (u) return u;
    return inferredUrlFromCaption || "";
  }, [url, inferredUrlFromCaption]);

  const canSubmit = !!effectiveUrl && !isLoading && !isCooldown;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const u = effectiveUrl.trim();
    if (!u) return;

    let c = caption.trim();
    if (!url.trim() && inferredUrlFromCaption) {
      const onlyUrl = c.replace(inferredUrlFromCaption, "").trim();
      c = onlyUrl.length === 0 ? "" : onlyUrl;
    }

    onExtract(u, c ? c : undefined);
  };

  const cooldownSeconds = Math.ceil(Math.max(0, cooldownRemainingMs) / 1000);

  return (
    <div className="max-w-3xl mx-auto mb-12">
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 to-cyan-500 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-1000"></div>

        <div className="relative bg-slate-900 rounded-2xl p-2 border border-white/10">
          <div className="flex items-center">
            <div className="pl-4 text-slate-400">
              <i className="fa-brands fa-tiktok text-xl"></i>
            </div>

            <input
              type="text"
              placeholder="Paste TikTok URL..."
              className="w-full bg-transparent border-none focus:ring-0 text-white px-4 py-3 placeholder:text-slate-600"
              value={url}
              onChange={(e) => {
                const next = e.target.value;

                // ✅ Prevent stale caption leaking between different URL extracts
                // Only reset when the actual URL input changes to a non-empty, different value.
                if (next.trim() && next.trim() !== url.trim()) {
                  setCaption("");
                }

                setUrl(next);
              }}
              disabled={isLoading || isCooldown}
            />

            <button
              type="submit"
              disabled={!canSubmit}
              className="tiktok-gradient px-8 py-3 rounded-xl font-bold text-white transition-all shadow-lg shadow-pink-500/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
              title={
                !effectiveUrl
                  ? "Paste a TikTok URL first"
                  : isCooldown
                    ? "Please wait before extracting again"
                    : undefined
              }
            >
              {isCooldown ? (
                `Try again in ${cooldownSeconds}s`
              ) : isLoading ? (
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  Analyzing...
                </span>
              ) : (
                "Extract Recipe"
              )}
            </button>
          </div>

          {/* Caption / Description (optional) */}
          <div className="px-4 pb-3 pt-1">
            <div className="mt-2 text-[11px] text-slate-400">Caption / notes (optional)</div>
            <textarea
              placeholder="Paste the TikTok caption / ingredients / notes here (optional)"
              className="w-full mt-2 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-pink-500/40"
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={isLoading || isCooldown}
            />
            <div className="mt-2 text-[11px] text-slate-500">
              Tip: als je per ongeluk de URL hierboven niet plakt maar hier, dan fixen we dat automatisch.
            </div>
          </div>
        </div>
      </form>

      <div className="mt-4 flex justify-center gap-4 text-xs text-slate-500 font-medium">
        <span className="flex items-center gap-1">
          <i className="fa-solid fa-check text-emerald-500"></i>
          OCR Visual Analysis
        </span>
        <span className="flex items-center gap-1">
          <i className="fa-solid fa-check text-emerald-500"></i>
          Whisper Audio ASR
        </span>
        <span className="flex items-center gap-1">
          <i className="fa-solid fa-check text-emerald-500"></i>
          LLM Synthesis
        </span>
      </div>
    </div>
  );
};

export default UrlInput;
