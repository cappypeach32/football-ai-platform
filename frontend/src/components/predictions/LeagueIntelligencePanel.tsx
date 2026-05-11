"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { analyticsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { BarChart2, Target, TrendingUp, AlertTriangle, Layers } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface LeagueStats {
  avg_goals_per_game: number;
  draw_rate: number;
  btts_rate: number;
  goals_variance: number;
  home_win_rate: number;
  away_win_rate: number;
}

interface Insight {
  icon: string;
  text: string;
  type: "positive" | "warning" | "info";
}

interface LeagueIntelligence {
  name: string;
  country: string;
  seasons_computed: string | null;
  stats: LeagueStats;
  insights: Insight[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className={cn("text-[11px] font-bold font-mono", color)}>{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", color.replace("text-", "bg-"))}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function LeagueIntelligencePanel({ externalId }: { externalId: string }) {
  const { data, isLoading, isError } = useQuery<LeagueIntelligence>({
    queryKey: ["league-intelligence", externalId],
    queryFn: () => analyticsApi.getLeagueIntelligence(externalId).then((r) => r.data),
    staleTime: 60 * 60 * 1000,  // 1 hour — static data
    enabled: !!externalId,
  });

  if (isLoading) {
    return (
      <div className="glass-card p-5 animate-pulse space-y-3">
        <div className="h-4 bg-white/5 rounded w-2/5" />
        <div className="h-20 bg-white/5 rounded" />
      </div>
    );
  }

  if (isError || !data || !data.stats) return null;

  const { stats, insights, name, seasons_computed } = data;
  const seasonLabel = seasons_computed ? `Seasons: ${seasons_computed}` : "Historical data";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
            <Layers className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">League Intelligence</h3>
            <p className="text-[10px] text-muted-foreground">{name} · {seasonLabel}</p>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground/40 font-mono uppercase tracking-wider">Historical</span>
      </div>

      {/* 3 headline numbers */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 text-center">
          <p className="text-xl font-black font-mono tabular-nums text-neon-green">{stats.avg_goals_per_game.toFixed(2)}</p>
          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide mt-0.5">Goals/Game</p>
        </div>
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 text-center">
          <p className="text-xl font-black font-mono tabular-nums text-sky-400">{(stats.btts_rate * 100).toFixed(0)}%</p>
          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide mt-0.5">BTTS Rate</p>
        </div>
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 text-center">
          <p className="text-xl font-black font-mono tabular-nums text-amber-400">{(stats.draw_rate * 100).toFixed(0)}%</p>
          <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide mt-0.5">Draw Rate</p>
        </div>
      </div>

      {/* Win distribution bars */}
      <div className="space-y-3">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/40">Outcome Distribution</p>
        <StatBar label="Home Win" value={stats.home_win_rate} max={0.6} color="text-neon-green" />
        <StatBar label="Draw"     value={stats.draw_rate}     max={0.4} color="text-amber-400"  />
        <StatBar label="Away Win" value={stats.away_win_rate} max={0.6} color="text-sky-400"    />
        <StatBar label="BTTS"     value={stats.btts_rate}     max={0.8} color="text-violet-400" />
      </div>

      {/* AI Insights */}
      {insights.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/40">AI Insights</p>
          {insights.map((ins, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
              className={cn(
                "flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-xs border",
                ins.type === "positive" ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-300/80" :
                ins.type === "warning"  ? "bg-amber-500/5  border-amber-500/10  text-amber-300/80"   :
                                          "bg-sky-500/5    border-sky-500/10    text-sky-300/80"
              )}
            >
              <span className="text-base leading-none flex-shrink-0">{ins.icon}</span>
              <span className="leading-snug">{ins.text}</span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
