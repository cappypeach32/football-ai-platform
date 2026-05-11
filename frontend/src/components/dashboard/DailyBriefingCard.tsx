"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { analyticsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Brain, Zap, AlertTriangle, TrendingUp, Shield,
  ChevronRight, Activity, Target,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface PickSummary {
  id: number;
  home: string;
  away: string;
  league: string;
  pick: string;
  odds: number | null;
  confidence: number;
  risk: number;
  risk_category: "Safe" | "Balanced" | "Aggressive" | "High Variance";
  ev: number | null;
  model_agreement: number | null;
  value_bet: boolean;
}

interface DailyReport {
  generated_at: string;
  total_predictions: number;
  value_bets_count: number;
  high_variance_count: number;
  model_full_agreement_count: number;
  avg_expected_value: number | null;
  top_confidence_picks: PickSummary[];
  strongest_value_bet: PickSummary | null;
  high_variance_warnings: PickSummary[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

const RISK_STYLE = {
  "Safe":          { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", dot: "bg-emerald-400" },
  "Balanced":      { text: "text-sky-400",     bg: "bg-sky-500/10",     border: "border-sky-500/20",     dot: "bg-sky-400"     },
  "Aggressive":    { text: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/20",   dot: "bg-amber-400"   },
  "High Variance": { text: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/20",     dot: "bg-red-400"     },
} as const;

function RiskBadge({ cat }: { cat: PickSummary["risk_category"] }) {
  const s = RISK_STYLE[cat];
  return (
    <span className={cn("inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border", s.text, s.bg, s.border)}>
      <span className={cn("w-1 h-1 rounded-full", s.dot)} />
      {cat}
    </span>
  );
}

function PickRow({ p, rank }: { p: PickSummary; rank?: number }) {
  return (
    <Link href={`/predictions/${p.id}`} className="block group">
      <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors">
        {rank != null && (
          <span className="text-[10px] font-black text-muted-foreground/40 w-4 text-center flex-shrink-0">
            {rank}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">
            {p.home} <span className="text-muted-foreground/40">vs</span> {p.away}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground truncate">{p.league} · {p.pick}</span>
            {p.odds && <span className="text-[10px] font-mono text-neon-green">{p.odds.toFixed(2)}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <RiskBadge cat={p.risk_category} />
          <span className={cn("text-[10px] font-mono font-bold",
            p.confidence >= 65 ? "text-emerald-400" :
            p.confidence >= 50 ? "text-amber-400" : "text-orange-400"
          )}>{p.confidence.toFixed(0)}% conf</span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-neon-green transition-colors flex-shrink-0" />
      </div>
    </Link>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function DailyBriefingCard() {
  const { data, isLoading, isError } = useQuery<DailyReport>({
    queryKey: ["analytics", "daily-report"],
    queryFn: () => analyticsApi.getDailyReport().then((r) => r.data),
    refetchInterval: 5 * 60 * 1000,  // 5 min
    staleTime: 4 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="glass-card p-5 animate-pulse space-y-3">
        <div className="h-4 bg-white/5 rounded w-1/3" />
        <div className="h-14 bg-white/5 rounded" />
        <div className="h-14 bg-white/5 rounded" />
      </div>
    );
  }

  if (isError || !data) {
    return null;
  }

  const {
    total_predictions,
    value_bets_count,
    high_variance_count,
    model_full_agreement_count,
    avg_expected_value,
    top_confidence_picks,
    strongest_value_bet,
    high_variance_warnings,
  } = data;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-neon-green/10 border border-neon-green/20 flex items-center justify-center">
            <Brain className="w-4 h-4 text-neon-green" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Daily AI Briefing</h3>
            <p className="text-[10px] text-muted-foreground">Today&apos;s intelligence report</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
          <span className="text-[10px] text-muted-foreground font-mono">Live</span>
        </div>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: Target,        label: "Predictions",  value: total_predictions,          color: "text-foreground" },
          { icon: Zap,           label: "Value Bets",   value: value_bets_count,            color: "text-neon-green" },
          { icon: Shield,        label: "Full Agree",   value: model_full_agreement_count,  color: "text-sky-400" },
          { icon: AlertTriangle, label: "High Risk",    value: high_variance_count,         color: high_variance_count > 0 ? "text-red-400" : "text-muted-foreground" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-2.5 text-center">
            <Icon className={cn("w-3.5 h-3.5 mx-auto mb-1", color)} />
            <p className={cn("text-lg font-black leading-none tabular-nums", color)}>{value}</p>
            <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wide mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {avg_expected_value !== null && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
          <Activity className="w-3.5 h-3.5 text-neon-green flex-shrink-0" />
          <span className="text-[11px] text-muted-foreground">Avg Expected Value today:</span>
          <span className={cn("text-sm font-bold font-mono ml-auto",
            avg_expected_value > 0 ? "text-neon-green" : "text-red-400"
          )}>
            {avg_expected_value > 0 ? "+" : ""}{avg_expected_value}%
          </span>
        </div>
      )}

      {/* Top confidence picks */}
      {top_confidence_picks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-neon-green" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Top Confidence Picks</h4>
          </div>
          <div className="space-y-1.5">
            {top_confidence_picks.map((p, i) => (
              <PickRow key={p.id} p={p} rank={i + 1} />
            ))}
          </div>
        </div>
      )}

      {/* Strongest value bet */}
      {strongest_value_bet && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-neon-green" />
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Strongest Value Bet</h4>
            {strongest_value_bet.ev !== null && (
              <span className={cn("ml-auto text-xs font-bold font-mono",
                strongest_value_bet.ev > 0 ? "text-neon-green" : "text-red-400"
              )}>
                EV {strongest_value_bet.ev > 0 ? "+" : ""}{strongest_value_bet.ev}%
              </span>
            )}
          </div>
          <PickRow p={strongest_value_bet} />
        </div>
      )}

      {/* High variance warnings */}
      <AnimatePresence>
        {high_variance_warnings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="space-y-2"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-red-400/70">
                High Variance Warnings
              </h4>
            </div>
            <div className="rounded-xl bg-red-500/5 border border-red-500/10 px-3 py-2 space-y-1.5">
              {high_variance_warnings.slice(0, 3).map((p) => (
                <Link key={p.id} href={`/predictions/${p.id}`} className="flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  <span className="text-xs text-muted-foreground flex-1 truncate">
                    {p.home} vs {p.away}
                  </span>
                  <span className="text-[10px] font-mono text-red-400">{p.risk.toFixed(0)}% risk</span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
