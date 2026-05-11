"use client";

import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, Activity } from "lucide-react";

type IntelSignal = {
  id: string;
  type: "odds_movement" | "injury" | "goals_signal";
  priority: "high" | "medium";
  match: string;
  league: string;
  title: string;
  detail: string;
  prob_delta: number;
  match_time: string | null;
};

const TYPE_CONFIG: Record<string, { color: string; bg: string; Icon: React.ElementType; label: string }> = {
  odds_movement: { color: "text-neon-green",  bg: "bg-neon-green/10",  Icon: TrendingUp,    label: "ODDS"   },
  injury:        { color: "text-red-400",      bg: "bg-red-500/10",     Icon: AlertTriangle, label: "INJURY" },
  goals_signal:  { color: "text-sky-400",      bg: "bg-sky-500/10",     Icon: Activity,      label: "GOALS"  },
};

export function IntelligenceFeed() {
  const today = new Date().toLocaleDateString("en-CA");
  const [activeIdx, setActiveIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  const { data: signals = [], isLoading } = useQuery<IntelSignal[]>({
    queryKey: ["analytics", "intelligence", today],
    queryFn: () => analyticsApi.getIntelligence(today).then((r) => r.data),
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (paused || signals.length <= 1) return;
    const t = setInterval(() => setActiveIdx((i) => (i + 1) % signals.length), 4000);
    return () => clearInterval(t);
  }, [paused, signals.length]);

  if (isLoading) return <IntelligenceFeedSkeleton />;
  if (!signals.length) return null;

  const current = signals[activeIdx];
  const cfg = TYPE_CONFIG[current.type] ?? TYPE_CONFIG.odds_movement;
  const Icon = cfg.Icon;
  const isPositive = current.prob_delta > 0;

  return (
    <div
      className="glass-card overflow-hidden border border-surface-border"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Header bar */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-surface-border bg-black/30">
        <span className="relative flex h-2 w-2 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-green opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-neon-green" />
        </span>
        <span className="text-[10px] font-bold tracking-[0.15em] text-neon-green uppercase font-mono">
          Live Intelligence Feed
        </span>
        <span className="ml-auto text-[9px] text-muted-foreground font-mono tabular-nums">
          {signals.length} signal{signals.length !== 1 ? "s" : ""} · {paused ? "paused" : "auto"}
        </span>
      </div>

      {/* Ticker */}
      <div className="relative h-[4.5rem] overflow-hidden bg-black/20">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="absolute inset-0 flex items-center px-4 gap-3"
          >
            {/* Type icon */}
            <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${cfg.color}`} />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-semibold text-foreground truncate leading-tight">
                  ⚡ {current.title}
                </span>
                <span
                  className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                    isPositive ? "bg-neon-green/20 text-neon-green" : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {isPositive ? "+" : ""}{current.prob_delta.toFixed(1)}%
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono truncate leading-tight">
                → {current.detail}
              </p>
            </div>

            {/* Meta */}
            <div className="flex-shrink-0 text-right space-y-0.5">
              <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} font-mono`}>
                {cfg.label}
              </div>
              <div className="text-[9px] text-muted-foreground font-mono">
                {current.league}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress bar + dots */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-t border-surface-border/50 bg-black/10">
        {/* Auto-progress bar */}
        {!paused && (
          <motion.div
            key={activeIdx}
            className="h-0.5 bg-neon-green/40 rounded-full flex-shrink-0"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 4, ease: "linear" }}
            style={{ maxWidth: "40px" }}
          />
        )}
        {/* Signal dots */}
        <div className="flex gap-1 flex-1">
          {signals.slice(0, Math.min(signals.length, 15)).map((s, i) => {
            const dotCfg = TYPE_CONFIG[s.type] ?? TYPE_CONFIG.odds_movement;
            return (
              <button
                key={s.id}
                onClick={() => setActiveIdx(i)}
                title={s.title}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === activeIdx
                    ? `w-5 ${dotCfg.color.replace("text-", "bg-")}`
                    : "w-1.5 bg-surface-border hover:bg-muted-foreground"
                }`}
              />
            );
          })}
        </div>
        <span className="text-[9px] text-muted-foreground font-mono flex-shrink-0">
          {activeIdx + 1}/{signals.length}
        </span>
      </div>
    </div>
  );
}

function IntelligenceFeedSkeleton() {
  return (
    <div className="glass-card overflow-hidden border border-surface-border animate-pulse">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-surface-border bg-black/30">
        <div className="w-2 h-2 rounded-full bg-surface-elevated" />
        <div className="h-2.5 w-44 bg-surface-elevated rounded" />
      </div>
      <div className="h-[4.5rem] bg-black/20" />
      <div className="px-4 py-2 border-t border-surface-border/50 flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-1 w-1.5 bg-surface-elevated rounded-full" />
        ))}
      </div>
    </div>
  );
}
