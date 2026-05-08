"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { predictionsApi } from "@/lib/api";
import { PredictionCard } from "@/components/predictions/PredictionCard";
import { PredictionFilters } from "@/components/predictions/PredictionFilters";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Prediction } from "@/types";

export default function PredictionsPage() {
  const [filters, setFilters] = useState({
    min_confidence: 0,
    value_bets_only: false,
    upcoming_only: true,
    league_id: undefined as number | undefined,
    limit: 30,
    offset: 0,
  });

  const { data: predictions, isLoading } = useQuery({
    queryKey: ["predictions", filters],
    queryFn: () => predictionsApi.getAll(filters).then((r) => r.data as Prediction[]),
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">
          AI Predictions <span className="gradient-text-green">Engine</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Advanced statistical models with confidence scoring & value bet detection
        </p>
      </motion.div>

      <PredictionFilters filters={filters} onChange={(f) => setFilters({ ...filters, ...f })} />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {(predictions ?? []).map((pred) => (
            <motion.div
              key={pred.id}
              variants={{ hidden: { opacity: 0, scale: 0.96 }, show: { opacity: 1, scale: 1 } }}
            >
              <PredictionCard prediction={pred} compact />
            </motion.div>
          ))}
        </motion.div>
      )}

      {predictions?.length === 0 && (
        <div className="glass-card p-16 text-center space-y-3">
          <p className="text-4xl">🔍</p>
          <p className="text-muted-foreground">No predictions match your current filters.</p>
        </div>
      )}
    </div>
  );
}
