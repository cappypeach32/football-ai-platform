"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Filter, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Filters {
  min_confidence: number;
  value_bets_only: boolean;
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
    </motion.div>
  );
}
