"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { Prediction } from "@/types";
import { formatConfidence, formatProbability } from "@/lib/utils";
import { Brain, Zap, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Props {
  prediction: Prediction;
  compact?: boolean;
}

export function PredictionCard({ prediction: p, compact }: Props) {
  const { label: confLabel, className: confClass } = formatConfidence(p.confidence_score);
  const bestProb = Math.max(p.home_win_prob, p.draw_prob, p.away_win_prob);
  const bestLabel =
    bestProb === p.home_win_prob
      ? { text: p.match.home_team.name, side: "home" }
      : bestProb === p.away_win_prob
      ? { text: p.match.away_team.name, side: "away" }
      : { text: "Draw", side: "draw" };

  return (
    <Link href={`/predictions/${p.id}`}>
      <motion.div
        whileHover={{ y: -2 }}
        className="match-card"
      >
        {/* League & date */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground">{p.match.league.name} · {p.match.league.country}</span>
          <span className="text-xs text-muted-foreground">{format(new Date(p.match.match_date), "dd MMM, HH:mm")}</span>
        </div>

        {/* Teams */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex-1 text-center">
            <p className="font-semibold text-foreground text-sm md:text-base truncate">{p.match.home_team.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">ELO {p.match.home_team.elo_rating.toFixed(0)}</p>
          </div>
          <div className="text-center flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-surface-elevated flex items-center justify-center">
              <span className="text-lg font-bold text-muted-foreground">VS</span>
            </div>
          </div>
          <div className="flex-1 text-center">
            <p className="font-semibold text-foreground text-sm md:text-base truncate">{p.match.away_team.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">ELO {p.match.away_team.elo_rating.toFixed(0)}</p>
          </div>
        </div>

        {/* Probability bars */}
        <div className="space-y-2 mb-4">
          <ProbRow label={p.match.home_team.short_name ?? "Home"} prob={p.home_win_prob} color="bg-neon-green" />
          <ProbRow label="Draw" prob={p.draw_prob} color="bg-amber-400" />
          <ProbRow label={p.match.away_team.short_name ?? "Away"} prob={p.away_win_prob} color="bg-neon-blue" />
        </div>

        {/* Footer badges */}
        {!compact && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className={confClass}><Brain className="w-3 h-3" /> {confLabel} {p.confidence_score.toFixed(0)}%</span>
            {p.value_bet && (
              <span className="value-bet-badge"><Zap className="w-3 h-3" /> Value Bet</span>
            )}
            <span className="stat-badge bg-surface-elevated text-muted-foreground ml-auto">
              xG {p.home_xg.toFixed(1)} – {p.away_xg.toFixed(1)}
            </span>
          </div>
        )}

        {compact && (
          <div className="flex items-center justify-between">
            <span className={confClass}>{p.confidence_score.toFixed(0)}%</span>
            {p.value_bet && <span className="value-bet-badge text-[10px]"><Zap className="w-2.5 h-2.5" /> Value</span>}
          </div>
        )}

        {/* AI summary excerpt */}
        {!compact && p.ai_summary && (
          <p className="mt-3 text-xs text-muted-foreground line-clamp-2 border-t border-surface-border pt-3">
            <Brain className="w-3 h-3 inline mr-1 text-neon-purple" />
            {p.ai_summary}
          </p>
        )}
      </motion.div>
    </Link>
  );
}

function ProbRow({ label, prob, color }: { label: string; prob: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-16 truncate">{label}</span>
      <div className="flex-1 bg-surface-elevated rounded-full h-1.5">
        <motion.div
          className={cn("h-1.5 rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${prob * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs font-mono text-foreground w-10 text-right">{formatProbability(prob)}</span>
    </div>
  );
}
