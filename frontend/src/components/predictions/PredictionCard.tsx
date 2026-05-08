"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { Prediction } from "@/types";
import { formatConfidence, formatProbability } from "@/lib/utils";
import { Brain, Zap, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Props {
  prediction: Prediction;
  compact?: boolean;
}

export function PredictionCard({ prediction: p, compact }: Props) {
  const { label: confLabel, className: confClass } = formatConfidence(p.confidence_score);
  const isHighConf = p.confidence_score >= 70;

  return (
    <Link href={`/predictions/${p.id}`}>
      <motion.div
        whileHover={{ y: -3, scale: 1.005 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={cn(
          "match-card group",
          isHighConf && "border-neon-green/15"
        )}
      >
        {/* Top accent line for high-confidence predictions */}
        {isHighConf && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-neon-green/60 to-transparent rounded-t-xl" />
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
            <span className={confClass}>
              <Brain className="w-3 h-3" />
              {confLabel} {p.confidence_score.toFixed(0)}%
            </span>
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
          <p className="mt-3 text-xs text-muted-foreground line-clamp-2 border-t border-surface-border/60 pt-3
                        group-hover:text-muted-foreground/80 transition-colors">
            <Brain className="w-3 h-3 inline mr-1 text-neon-purple" />
            {p.ai_summary}
          </p>
        )}
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
