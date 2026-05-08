"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Filter, Zap, Clock, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { leaguesApi } from "@/lib/api";
import type { League } from "@/types";

interface Filters {
  min_confidence: number;
  value_bets_only: boolean;
  upcoming_only: boolean;
  league_id?: number;
  limit: number;
  offset: number;
}

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
}

const CONFIDENCE_PRESETS = [
  { label: "All", value: 0 },
  { label: "50%+", value: 50 },
  { label: "65%+", value: 65 },
  { label: "75%+", value: 75 },
];

export function PredictionFilters({ filters, onChange }: Props) {
  const { data: leagues } = useQuery<League[]>({
    queryKey: ["leagues"],
    queryFn: () => leaguesApi.getAll().then((r) => r.data as League[]),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-4 flex flex-wrap items-center gap-4"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="w-4 h-4" />
        <span>Filters</span>
      </div>

      {/* Confidence presets */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Min confidence:</span>
        <div className="flex gap-1">
          {CONFIDENCE_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => onChange({ ...filters, min_confidence: p.value, offset: 0 })}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium transition-all",
                filters.min_confidence === p.value
                  ? "bg-neon-green/20 text-neon-green border border-neon-green/30"
                  : "bg-surface-elevated text-muted-foreground hover:text-foreground border border-surface-border"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Value bets toggle */}
      <button
        onClick={() => onChange({ ...filters, value_bets_only: !filters.value_bets_only, offset: 0 })}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-all",
          filters.value_bets_only
            ? "bg-neon-green/20 text-neon-green border-neon-green/30"
            : "bg-surface-elevated text-muted-foreground border-surface-border hover:text-foreground"
        )}
      >
        <Zap className="w-3 h-3" />
        Value Bets Only
      </button>

      {/* Upcoming only toggle */}
      <button
        onClick={() => onChange({ ...filters, upcoming_only: !filters.upcoming_only, offset: 0 })}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-all",
          filters.upcoming_only
            ? "bg-neon-blue/15 text-neon-blue border-neon-blue/30"
            : "bg-surface-elevated text-muted-foreground border-surface-border hover:text-foreground"
        )}
      >
        <Clock className="w-3 h-3" />
        {filters.upcoming_only ? "Upcoming" : "All Matches"}
      </button>

      {/* League picker */}
      {leagues && leagues.length > 0 && (
        <div className="flex items-center gap-2 w-full border-t border-surface-border pt-3 mt-1">
          <Trophy className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground flex-shrink-0">League:</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onChange({ ...filters, league_id: undefined, offset: 0 })}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-medium border transition-all",
                filters.league_id === undefined
                  ? "bg-neon-green/20 text-neon-green border-neon-green/30"
                  : "bg-surface-elevated text-muted-foreground border-surface-border hover:text-foreground"
              )}
            >
              All
            </button>
            {leagues.map((league) => (
              <button
                key={league.id}
                onClick={() => onChange({ ...filters, league_id: league.id, offset: 0 })}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium border transition-all",
                  filters.league_id === league.id
                    ? "bg-neon-green/20 text-neon-green border-neon-green/30"
                    : "bg-surface-elevated text-muted-foreground border-surface-border hover:text-foreground"
                )}
              >
                {league.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
