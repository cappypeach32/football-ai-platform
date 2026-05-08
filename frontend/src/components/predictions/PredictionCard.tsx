"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { Prediction } from "@/types";
import { formatConfidence, formatProbability } from "@/lib/utils";
import { Brain, Zap, Activity, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Props {
  prediction: Prediction;
  compact?: boolean;
}

/** Kelly Criterion: f* = (b·p − q) / b, clamped [0, 0.5] */
function computeKelly(prob: number, decimalOdds: number | null): number {
  if (!decimalOdds || decimalOdds <= 1.01) return 0;
  const b = decimalOdds - 1;
  const f = (b * prob - (1 - prob)) / b;
  return Math.max(0, Math.min(f, 0.5));
}

function KellyBar({ prediction: p }: { prediction: Prediction }) {
  // Pick best positive kelly market
  const candidates: { label: string; kelly: number; color: string }[] = [
    { label: "Home", kelly: computeKelly(p.home_win_prob, p.odds_home), color: "bg-neon-green" },
    { label: "Draw", kelly: computeKelly(p.draw_prob, p.odds_draw), color: "bg-neon-yellow" },
    { label: "Away", kelly: computeKelly(p.away_win_prob, p.odds_away), color: "bg-neon-blue" },
  ];

  // Use recommended_bet preference if set
  let best = candidates.filter((c) => c.kelly > 0).sort((a, b) => b.kelly - a.kelly)[0];
  if (p.recommended_bet) {
    const name = p.recommended_bet.toLowerCase();
    const match = candidates.find((c) => c.label.toLowerCase() === name && c.kelly > 0);
    if (match) best = match;
  }

  if (!best || best.kelly <= 0) return null;

  const pct = best.kelly * 100;
  const barWidth = Math.min(pct * 2, 100); // scale display: 50% kelly = full bar

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.35 }}
      className="mt-3 pt-3 border-t border-surface-border/50"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <TrendingUp className="w-3 h-3 text-neon-green" />
          Kelly Stake · {best.label}
        </span>
        <span className="text-[11px] font-mono font-bold text-neon-green">{pct.toFixed(1)}%</span>
      </div>
      <div className="w-full h-1.5 bg-surface-navy rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", best.color)}
          style={{ boxShadow: `0 0 8px rgba(0,255,135,0.5)` }}
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ duration: 0.9, delay: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      </div>
    </motion.div>
  );
}

export function PredictionCard({ prediction: p, compact }: Props) {
  const { label: confLabel, className: confClass } = formatConfidence(p.confidence_score);
  const isHighConf = p.confidence_score >= 70;

  return (
    <Link href={`/predictions/${p.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        whileHover={{ y: -4, scale: 1.008 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 380, damping: 24, opacity: { duration: 0.35 }, filter: { duration: 0.35 } }}
        className={cn(
          "match-card group",
          isHighConf && "border-neon-green/15"
        )}
      >
        {/* Top accent line for high-confidence predictions */}
        {isHighConf && (
          <motion.div
            className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl"
            style={{ background: "linear-gradient(90deg, transparent, rgba(0,255,135,0.7), transparent)" }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        {/* League & date */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {p.match.league.name} · {p.match.league.country}
          </span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {format(new Date(p.match.match_date), "dd MMM, HH:mm")}
          </span>
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex-1 text-center">
            <p className="font-bold text-foreground text-sm md:text-base truncate font-display">
              {p.match.home_team.name}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
              ELO {p.match.home_team.elo_rating.toFixed(0)}
            </p>
          </div>

          <div className="text-center flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-surface-navy border border-surface-border flex items-center justify-center
                            group-hover:border-neon-green/20 transition-colors duration-300">
              <span className="text-xs font-bold text-muted-foreground font-display tracking-wider">VS</span>
            </div>
          </div>

          <div className="flex-1 text-center">
            <p className="font-bold text-foreground text-sm md:text-base truncate font-display">
              {p.match.away_team.name}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
              ELO {p.match.away_team.elo_rating.toFixed(0)}
            </p>
          </div>
        </div>

        {/* Probability bars */}
        <div className="space-y-2 mb-4">
          <ProbRow label={p.match.home_team.short_name ?? "Home"} prob={p.home_win_prob} color="bg-neon-green" glowColor="rgba(0,255,135,0.5)" />
          <ProbRow label="Draw" prob={p.draw_prob} color="bg-neon-yellow" glowColor="rgba(245,230,66,0.5)" />
          <ProbRow label={p.match.away_team.short_name ?? "Away"} prob={p.away_win_prob} color="bg-neon-blue" glowColor="rgba(0,212,255,0.5)" />
        </div>

        {/* Footer badges */}
        {!compact && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Neural glow confidence badge */}
            <motion.span
              className={confClass}
              animate={isHighConf ? {
                boxShadow: [
                  "0 0 0px rgba(0,255,135,0)",
                  "0 0 10px rgba(0,255,135,0.35)",
                  "0 0 0px rgba(0,255,135,0)",
                ],
              } : {}}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Brain className="w-3 h-3" />
              {confLabel} {p.confidence_score.toFixed(0)}%
            </motion.span>
            {p.value_bet && (
              <motion.span
                className="value-bet-badge"
                animate={{ boxShadow: ["0 0 0 rgba(0,255,135,0)", "0 0 8px rgba(0,255,135,0.4)", "0 0 0 rgba(0,255,135,0)"] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Zap className="w-3 h-3" /> Value Bet
              </motion.span>
            )}
            <span className="stat-badge bg-surface-elevated text-muted-foreground ml-auto tabular-nums">
              <Activity className="w-3 h-3" />
              xG {p.home_xg.toFixed(1)}–{p.away_xg.toFixed(1)}
            </span>
          </div>
        )}

        {compact && (
          <div className="flex items-center justify-between">
            <span className={confClass}>{p.confidence_score.toFixed(0)}%</span>
            {p.value_bet && (
              <span className="value-bet-badge text-[10px]">
                <Zap className="w-2.5 h-2.5" /> Value
              </span>
            )}
          </div>
        )}

        {/* AI summary excerpt */}
        {!compact && p.ai_summary && (
          <div className="scan-container mt-3 border-t border-surface-border/60 pt-3">
            <p className="text-xs text-muted-foreground line-clamp-2 group-hover:text-muted-foreground/80 transition-colors">
              <Brain className="w-3 h-3 inline mr-1 text-neon-purple" />
              {p.ai_summary}
            </p>
          </div>
        )}

        {/* Kelly fraction bar – only for value bets with odds */}
        {!compact && p.value_bet && <KellyBar prediction={p} />}
      </motion.div>
    </Link>
  );
}

function ProbRow({ label, prob, color, glowColor }: { label: string; prob: number; color: string; glowColor: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-16 truncate">{label}</span>
      <div className="flex-1 bg-surface-navy rounded-full h-1.5 overflow-hidden">
        <motion.div
          className={cn("h-1.5 rounded-full", color)}
          style={{ boxShadow: `0 0 6px ${glowColor}` }}
          initial={{ width: 0 }}
          animate={{ width: `${prob * 100}%` }}
          transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      </div>
      <span className="text-xs font-mono text-foreground w-10 text-right tabular-nums">
        {formatProbability(prob)}
      </span>
    </div>
  );
}
