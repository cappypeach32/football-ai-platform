"use client";

import { Command } from "cmdk";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { predictionsApi, teamsApi } from "@/lib/api";
import type { Prediction } from "@/types";
import {
  Search, Brain, Activity, BarChart3, History,
  LayoutDashboard, Zap, X, ArrowRight, Users,
} from "lucide-react";
import { format } from "date-fns";

// ── Static nav shortcuts ──────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "nav-dash",        label: "Dashboard",    href: "/",            icon: LayoutDashboard },
  { id: "nav-predictions", label: "Predictions",  href: "/predictions", icon: Brain },
  { id: "nav-live",        label: "Live Matches",  href: "/live",       icon: Activity },
  { id: "nav-analytics",  label: "Analytics",    href: "/analytics",   icon: BarChart3 },
  { id: "nav-backtest",   label: "Backtest",     href: "/backtest",    icon: History },
];

// ── SearchPalette ─────────────────────────────────────────────────────────────
export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  // Fetch predictions for search (cached)
  const { data: predictions = [] } = useQuery<Prediction[]>({
    queryKey: ["predictions", "search"],
    queryFn: () => predictionsApi.getAll({ limit: 50 }).then((r) => r.data as Prediction[]),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  // Fetch teams for search (cached)
  const { data: teamsRaw } = useQuery<any[]>({
    queryKey: ["teams", "search"],
    queryFn: () => teamsApi.getAll({ limit: 50 }).then((r) => r.data),
    staleTime: 10 * 60 * 1000,
    enabled: open,
  });

  const navigate = useCallback((href: string) => {
    router.push(href);
    onClose();
    setQuery("");
  }, [router, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Reset query on open
  useEffect(() => { if (open) setQuery(""); }, [open]);

  const q = query.toLowerCase();

  const matchedNav = NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(q) || q === "");

  const matchedPreds = predictions
    .filter((p) => {
      if (!q) return true;
      return (
        p.match.home_team.name.toLowerCase().includes(q) ||
        p.match.away_team.name.toLowerCase().includes(q) ||
        p.match.league.name.toLowerCase().includes(q)
      );
    })
    .slice(0, 5);

  const matchedTeams = (teamsRaw ?? [])
    .filter((t: any) => !q || t.name.toLowerCase().includes(q))
    .slice(0, 4);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed top-[12vh] left-1/2 -translate-x-1/2 w-full max-w-xl z-50 px-4"
          >
            <div
              className="rounded-2xl overflow-hidden border border-surface-border/80 shadow-2xl"
              style={{ background: "rgba(13,17,23,0.92)", backdropFilter: "blur(24px)" }}
            >
              {/* Search input row */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-border/60">
                <Search className="w-4 h-4 text-neon-green flex-shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search teams, matches, leagues…"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
                <div className="flex items-center gap-1.5">
                  <kbd className="text-[10px] text-muted-foreground bg-surface-card px-1.5 py-0.5 rounded border border-surface-border">ESC</kbd>
                  <button onClick={onClose} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Results */}
              <div className="max-h-[60vh] overflow-y-auto py-2">
                <Command>
                  <Command.List>
                    {/* Navigation */}
                    {matchedNav.length > 0 && (
                      <Command.Group>
                        <div className="px-4 py-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Navigation</p>
                        </div>
                        {matchedNav.map((n) => (
                          <Command.Item
                            key={n.id}
                            value={n.label}
                            onSelect={() => navigate(n.href)}
                            className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface-card transition-colors rounded-none aria-selected:bg-neon-green/8 aria-selected:text-neon-green group"
                          >
                            <div className="p-1.5 rounded-lg bg-surface-card group-aria-selected:bg-neon-green/15">
                              <n.icon className="w-3.5 h-3.5 text-muted-foreground group-aria-selected:text-neon-green" />
                            </div>
                            <span className="text-sm text-foreground group-aria-selected:text-neon-green">{n.label}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto opacity-0 group-aria-selected:opacity-100 transition-opacity" />
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}

                    {/* Predictions */}
                    {matchedPreds.length > 0 && (
                      <Command.Group>
                        <div className="px-4 py-1.5 mt-1">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Predictions</p>
                        </div>
                        {matchedPreds.map((p) => (
                          <Command.Item
                            key={p.id}
                            value={`${p.match.home_team.name} vs ${p.match.away_team.name}`}
                            onSelect={() => navigate(`/predictions/${p.id}`)}
                            className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface-card transition-colors aria-selected:bg-neon-green/8 group"
                          >
                            <div className="p-1.5 rounded-lg bg-neon-purple/10">
                              <Brain className="w-3.5 h-3.5 text-neon-purple" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground truncate">
                                {p.match.home_team.name}
                                <span className="text-muted-foreground mx-1.5">vs</span>
                                {p.match.away_team.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                {p.match.league.name} · {format(new Date(p.match.match_date), "dd MMM")}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p
                                className="text-xs font-mono font-bold"
                                style={{ color: p.confidence_score >= 70 ? "#00FF87" : p.confidence_score >= 50 ? "#F5A623" : "#F87171" }}
                              >
                                {p.confidence_score.toFixed(0)}%
                              </p>
                              {p.value_bet && <Zap className="w-3 h-3 text-neon-green ml-auto" />}
                            </div>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}

                    {/* Teams */}
                    {matchedTeams.length > 0 && (
                      <Command.Group>
                        <div className="px-4 py-1.5 mt-1">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Teams</p>
                        </div>
                        {matchedTeams.map((t: any) => (
                          <Command.Item
                            key={t.id}
                            value={t.name}
                            onSelect={() => navigate(`/predictions?team=${encodeURIComponent(t.name)}`)}
                            className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface-card transition-colors aria-selected:bg-neon-blue/8 group"
                          >
                            <div className="p-1.5 rounded-lg bg-neon-blue/10">
                              <Users className="w-3.5 h-3.5 text-neon-blue" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground truncate">{t.name}</p>
                              {t.country && <p className="text-[10px] text-muted-foreground">{t.country}</p>}
                            </div>
                            <p className="text-[10px] text-muted-foreground font-mono flex-shrink-0">
                              ELO {t.elo_rating?.toFixed(0)}
                            </p>
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}

                    {/* Empty state */}
                    {matchedNav.length === 0 && matchedPreds.length === 0 && matchedTeams.length === 0 && (
                      <div className="px-4 py-8 text-center space-y-2">
                        <p className="text-2xl">🔍</p>
                        <p className="text-sm text-muted-foreground">No results for "<span className="text-foreground">{query}</span>"</p>
                      </div>
                    )}
                  </Command.List>
                </Command>
              </div>

              {/* Footer hint */}
              <div className="px-4 py-2 border-t border-surface-border/40 flex items-center gap-3 text-[10px] text-muted-foreground/60">
                <span><kbd className="bg-surface-card border border-surface-border px-1 rounded">↑↓</kbd> navigate</span>
                <span><kbd className="bg-surface-card border border-surface-border px-1 rounded">↵</kbd> open</span>
                <span><kbd className="bg-surface-card border border-surface-border px-1 rounded">ESC</kbd> close</span>
                <span className="ml-auto flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                  AI Search
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
