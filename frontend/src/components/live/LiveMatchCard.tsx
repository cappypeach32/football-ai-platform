"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import type { Match, LiveUpdate } from "@/types";
import { useLiveMatch } from "@/hooks/useLiveMatch";

interface Props { match: Match }

export function LiveMatchCard({ match }: Props) {
  const [live, setLive] = useState<Partial<LiveUpdate>>({
    home_win_prob: 0.45,
    draw_prob: 0.25,
    away_win_prob: 0.30,
  });

  const onUpdate = useCallback((data: LiveUpdate) => setLive(data), []);
  useLiveMatch(match.id, onUpdate);

  const hwProb = live.home_win_prob ?? 0.45;
  const dProb  = live.draw_prob  ?? 0.25;
  const awProb = live.away_win_prob ?? 0.30;

  return (
    <motion.div whileHover={{ y: -2 }} className="glass-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{match.league.name}</span>
        <span className="live-badge animate-pulse">{match.minute ?? 0}'</span>
      </div>

      {/* Score */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 text-center">
          <p className="font-bold text-foreground">{match.home_team.name}</p>
        </div>
        <div className="text-3xl font-black font-mono gradient-text-green">
          {match.home_score ?? 0} — {match.away_score ?? 0}
        </div>
        <div className="flex-1 text-center">
          <p className="font-bold text-foreground">{match.away_team.name}</p>
        </div>
      </div>

      {/* Live win probability */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Live Win Probability</p>
        <div className="flex rounded-lg overflow-hidden h-6 gap-px">
          <motion.div
            style={{ width: `${hwProb * 100}%` }}
            className="bg-neon-green/80 flex items-center justify-center text-[10px] font-mono text-surface font-bold"
            transition={{ duration: 0.5 }}
          >
            {(hwProb * 100).toFixed(0)}%
          </motion.div>
          <motion.div
            style={{ width: `${dProb * 100}%` }}
            className="bg-amber-400/80 flex items-center justify-center text-[10px] font-mono text-surface font-bold"
            transition={{ duration: 0.5 }}
          >
            {(dProb * 100).toFixed(0)}%
          </motion.div>
          <motion.div
            style={{ width: `${awProb * 100}%` }}
            className="bg-neon-blue/80 flex items-center justify-center text-[10px] font-mono text-surface font-bold"
            transition={{ duration: 0.5 }}
          >
            {(awProb * 100).toFixed(0)}%
          </motion.div>
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{match.home_team.short_name ?? "Home"}</span>
          <span>Draw</span>
          <span>{match.away_team.short_name ?? "Away"}</span>
        </div>
      </div>

      {/* xG */}
      {live.home_xg !== undefined && (
        <div className="flex justify-between text-xs border-t border-surface-border pt-3">
          <span className="text-muted-foreground">xG:</span>
          <span className="font-mono text-foreground">
            {live.home_xg?.toFixed(2)} — {live.away_xg?.toFixed(2)}
          </span>
        </div>
      )}
    </motion.div>
  );
}
