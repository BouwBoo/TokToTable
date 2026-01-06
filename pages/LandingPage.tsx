import React from "react";
import { Link } from "react-router-dom";

/**
 * ✅ Compile-safe LogoMark:
 * - This is a clean placeholder that matches TikTok-ish neon (pink/cyan) on dark.
 * - If you already have a real logo component or SVG, replace <LogoMark /> usage 1:1.
 */
function LogoMark({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="TokToTable logo"
    >
      <defs>
        <linearGradient id="tt_neon" x1="6" y1="42" x2="42" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#25F4EE" />
          <stop offset="0.52" stopColor="#FFFFFF" stopOpacity="0.65" />
          <stop offset="1" stopColor="#FE2C55" />
        </linearGradient>
        <filter id="tt_glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="6" y="6" width="36" height="36" rx="12" fill="url(#tt_neon)" opacity="0.22" />
      <path
        d="M17 16h14v4h-5v12.5c0 3.6-2.7 6.2-6.3 6.2-3.1 0-5.7-2.2-6-5.2-.3-3.4 2.4-6.2 5.8-6.2.9 0 1.8.2 2.5.6V20h-5v-4z"
        stroke="url(#tt_neon)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#tt_glow)"
      />
    </svg>
  );
}

const Section: React.FC<{ id?: string; title?: string; eyebrow?: string; children: React.ReactNode }> = ({
  id,
  title,
  eyebrow,
  children,
}) => (
  <section id={id} className="py-12 md:py-16">
    <div className="max-w-6xl mx-auto px-6">
      {eyebrow ? (
        <p className="text-[10px] uppercase font-black tracking-widest text-slate-500 mb-2">{eyebrow}</p>
      ) : null}
      {title ? <h2 className="text-2xl md:text-3xl font-black mb-6">{title}</h2> : null}
      {children}
    </div>
  </section>
);

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black border border-white/10 bg-white/[0.04] text-slate-200">
      {children}
    </span>
  );
}

function NeonButton({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="relative inline-flex items-center justify-center px-6 py-3 rounded-2xl font-black text-white transition-all
                 bg-gradient-to-r from-[#25F4EE] via-pink-500 to-[#FE2C55]
                 hover:brightness-110 active:brightness-95
                 shadow-[0_12px_40px_rgba(254,44,85,0.18)]"
    >
      <span className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-[#25F4EE] via-pink-500 to-[#FE2C55] blur opacity-35" />
      <span className="relative">{children}</span>
    </Link>
  );
}

function GhostButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center px-6 py-3 rounded-2xl font-black
                 bg-white/[0.04] hover:bg-white/[0.07]
                 border border-white/10 hover:border-white/20
                 text-slate-100 transition-all"
    >
      {children}
    </a>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen text-slate-100 bg-[#070A18]">
      {/* background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[880px] h-[880px] rounded-full bg-[#25F4EE] opacity-[0.08] blur-[120px]" />
        <div className="absolute top-10 right-[-120px] w-[640px] h-[640px] rounded-full bg-[#FE2C55] opacity-[0.10] blur-[120px]" />
        <div className="absolute bottom-[-200px] left-[-120px] w-[720px] h-[720px] rounded-full bg-pink-500 opacity-[0.06] blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),rgba(0,0,0,0)_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.03),rgba(255,255,255,0)_20%,rgba(0,0,0,0)_80%,rgba(0,0,0,0.4))]" />
      </div>

      {/* NAV */}
      <header className="sticky top-0 z-40 bg-[#070A18]/75 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <LogoMark />
            <span className="font-black tracking-tight text-lg">TokToTable</span>
            <span className="hidden sm:inline-flex ml-1 px-2 py-0.5 rounded-lg text-[10px] font-black border border-white/10 bg-white/[0.04] text-slate-300">
              local-first
            </span>
          </Link>

          <nav className="flex items-center gap-2">
            <a
              href="#how"
              className="hidden sm:inline-flex px-3 py-2 rounded-xl text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
            >
              How it works
            </a>
            <a
              href="#principles"
              className="hidden sm:inline-flex px-3 py-2 rounded-xl text-sm font-bold text-slate-300 hover:text-white hover:bg-white/5 transition-all"
            >
              Principles
            </a>

            {/* V2: replace with real /login */}
            <button
              type="button"
              className="px-3 py-2 rounded-xl text-sm font-bold bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 hover:border-white/20 transition-all"
              onClick={() => alert("Login comes in V2 (sync). For now: use the app locally.")}
              title="Login will be added in V2"
            >
              Login
            </button>

            <NeonButton to="/app">Try for free</NeonButton>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <main>
        <section className="pt-14 md:pt-20 pb-10 md:pb-12">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-10 items-center">
              <div className="max-w-2xl">
                <div className="flex flex-wrap gap-2 mb-6">
                  <Badge>
                    <span className="w-2 h-2 rounded-full bg-[#25F4EE]" />
                    Paste link → structured recipe
                  </Badge>
                  <Badge>
                    <span className="w-2 h-2 rounded-full bg-[#FE2C55]" />
                    Weekly shopping ritual
                  </Badge>
                  <Badge>
                    <span className="w-2 h-2 rounded-full bg-white/40" />
                    No silent automation
                  </Badge>
                </div>

                <h1 className="text-4xl md:text-6xl font-black leading-tight">
                  From TikTok recipe to a{" "}
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#25F4EE] via-pink-400 to-[#FE2C55]">
                    calm
                  </span>{" "}
                  shopping list in minutes.
                </h1>

                <p className="mt-5 text-slate-300 text-lg md:text-xl leading-relaxed">
                  TokToTable turns short food videos into clear recipes and a reliable shopping list.
                  It’s a tool — not a feed. You stay in control.
                </p>

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <NeonButton to="/app">Try for free</NeonButton>
                  <GhostButton href="#how">See how it works</GhostButton>
                </div>

                <p className="mt-4 text-[12px] text-slate-500">
                  No account needed to try. Accounts are for sync & backup (V2).
                </p>
              </div>

              {/* right hero panel */}
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
                <div className="p-5 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl border border-white/10 bg-black/20 grid place-items-center">
                      <LogoMark className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-black">Shopping List v2</p>
                      <p className="text-[11px] text-slate-500">Aisles • Pantry • Prices • Keyboard</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">preview</span>
                </div>

                <div className="p-5 space-y-3">
                  {[
                    { label: "Cherry tomatoes", meta: "Produce • 500 g", price: "€ —", neon: "bg-[#25F4EE]/20" },
                    { label: "Mozzarella", meta: "Dairy • 2 pcs", price: "€ 2.99", neon: "bg-pink-500/20" },
                    { label: "Olive oil", meta: "Dry • 250 ml", price: "€ 4.49", neon: "bg-[#FE2C55]/20" },
                  ].map((it) => (
                    <div
                      key={it.label}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="font-black truncate">{it.label}</p>
                        <p className="text-[11px] text-slate-500 mt-1">{it.meta}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`w-2.5 h-2.5 rounded-full ${it.neon}`} />
                        <span className="text-[12px] font-black text-slate-200">{it.price}</span>
                      </div>
                    </div>
                  ))}

                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">Why it works</p>
                    <p className="mt-2 text-slate-300">
                      The list is designed for weekly repetition: quick checks, fast prices, no context switching.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PROBLEM */}
        <Section eyebrow="Problem" title="Recognizable?">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <ul className="space-y-3 text-slate-300 leading-relaxed">
                <li>• You see a great recipe on TikTok</li>
                <li>• You think: “I’ll make this”</li>
                <li>• Later you can’t remember ingredients, quantities, or what you already have</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-slate-300 leading-relaxed">
                TokToTable is built for the moment{" "}
                <span className="font-black text-white">after</span> scrolling:
                turning inspiration into groceries without chaos.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Badge>no notes</Badge>
                <Badge>no screenshots</Badge>
                <Badge>no messy lists</Badge>
              </div>
            </div>
          </div>
        </Section>

        {/* SOLUTION */}
        <Section eyebrow="Solution" title="What TokToTable does">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
              <p className="font-black mb-2">1) Structure from short videos</p>
              <p className="text-slate-300 leading-relaxed">
                Paste a TikTok link. TokToTable extracts ingredients and steps.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
              <p className="font-black mb-2">2) One calm shopping list</p>
              <p className="text-slate-300 leading-relaxed">
                Everything grouped by aisle, optimized for weekly use.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
              <p className="font-black mb-2">3) You stay in control</p>
              <p className="text-slate-300 leading-relaxed">
                No silent fixes. Prices, pantry, edits are explicit actions.
              </p>
            </div>
          </div>

          <div className="mt-8">
            <NeonButton to="/app">Make your first shopping list</NeonButton>
          </div>
        </Section>

        {/* HOW IT WORKS */}
        <Section id="how" eyebrow="Workflow" title="How it works">
          <ol className="grid md:grid-cols-3 gap-4">
            <li className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Step 1</p>
              <p className="font-black mt-2">Paste a link</p>
              <p className="text-slate-300 mt-2 leading-relaxed">
                Start with a recipe you actually want to cook.
              </p>
            </li>
            <li className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Step 2</p>
              <p className="font-black mt-2">Review & save</p>
              <p className="text-slate-300 mt-2 leading-relaxed">
                Make edits if needed. Nothing happens automatically.
              </p>
            </li>
            <li className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Step 3</p>
              <p className="font-black mt-2">Shop with one list</p>
              <p className="text-slate-300 mt-2 leading-relaxed">
                Aisles, pantry, prices — built for weekly repetition.
              </p>
            </li>
          </ol>
        </Section>

        {/* PRINCIPLES */}
        <Section id="principles" eyebrow="Principles" title="Built like a tool">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
              <p className="font-black mb-2">Local-first</p>
              <p className="text-slate-300 leading-relaxed">
                Use TokToTable without an account. Sync comes later.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
              <p className="font-black mb-2">No silent automation</p>
              <p className="text-slate-300 leading-relaxed">
                The system assists; you decide.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
              <p className="font-black mb-2">Utility over engagement</p>
              <p className="text-slate-300 leading-relaxed">
                This is a tool, not a feed.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-6">
              <p className="font-black mb-2">Stability before scale</p>
              <p className="text-slate-300 leading-relaxed">
                Weekly ritual first. Growth later.
              </p>
            </div>
          </div>
        </Section>

        {/* FINAL CTA */}
        <section className="py-14 md:py-16 border-t border-white/10">
          <div className="max-w-6xl mx-auto px-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 md:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">Ready</p>
                <h3 className="text-2xl md:text-3xl font-black mt-2">Try TokToTable locally — no account needed.</h3>
                <p className="text-slate-300 mt-3 leading-relaxed max-w-2xl">
                  Start with one TikTok link. Build your pantry & prices over time. Sync comes later (V2).
                </p>
              </div>
              <div className="flex gap-3">
                <NeonButton to="/app">Try for free</NeonButton>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-white/10 py-10">
          <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p className="text-slate-500 text-sm">© {new Date().getFullYear()} TokToTable</p>
            <div className="flex flex-wrap gap-3">
              <a className="text-sm text-slate-400 hover:text-white underline underline-offset-4" href="#">
                Privacy
              </a>
              <a className="text-sm text-slate-400 hover:text-white underline underline-offset-4" href="#">
                Terms
              </a>
              <a className="text-sm text-slate-400 hover:text-white underline underline-offset-4" href="#">
                Contact
              </a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
