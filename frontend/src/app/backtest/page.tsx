"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { backtestApi } from "@/lib/api";
import { BacktestSummaryCards } from "@/components/backtest/BacktestSummaryCards";
import { HistoricalPredictionsTable } from "@/components/backtest/HistoricalPredictionsTable";
import { AccuracyChart } from "@/components/backtest/AccuracyChart";
import { CalibrationChart } from "@/components/backtest/CalibrationChart";
import { Skeleton } from "@/components/ui/Skeleton";

const MARKETS = [
  { label: "All", value: "" },
  { label: "Home Win (1)", value: "1" },
  { label: "Draw (X)", value: "X" },
  { label: "Away Win (2)", value: "2" },
  { label: "Over 2.5", value: "over_2.5" },
  { label: "Under 2.5", value: "under_2.5" },
  { label: "BTTS Yes", value: "btts_yes" },
];

interface Filters {
  min_confidence: number;
  league_id: number | undefined;
  market: string;
  date_from: string;
  date_to: string;
  odds_min: string;
  odds_max: string;
}

export default function BacktestPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>({
    min_confidence: 0,
    league_id: undefined,
    market: "",
    date_from: "",
    date_to: "",
    odds_min: "",
    odds_max: "",
  });

  const apiParams = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== "" && v !== undefined && v !== 0)
  );

  const { data: summary, isLoading } = useQuery({
    queryKey: ["backtest", "summary", apiParams],
    queryFn: () => backtestApi.getSummary(apiParams).then((r) => r.data),
  });

  const { data: calibration } = useQuery({
    queryKey: ["backtest", "calibration"],
    queryFn: () => backtestApi.getCalibration().then((r) => r.data),
  });

  const reconcileMutation = useMutation({
    mutationFn: () => backtestApi.reconcile().then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backtest"] });
    },
  });

  const ingestMutation = useMutation({
    mutationFn: (days: number) => backtestApi.ingestRange(days).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["backtest"] });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">
            Backtest <span className="gradient-text-green">Engine</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Historical prediction accuracy, ROI tracking, and AI model performance analysis
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => ingestMutation.mutate(60)}
            disabled={ingestMutation.isPending || reconcileMutation.isPending}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-neon-blue/10 text-neon-blue border border-neon-blue/30 hover:bg-neon-blue/20 transition-all disabled:opacity-50"
          >
            {ingestMutation.isPending ? "Loading..." : "Load Last 60 Days"}
          </button>
          <button
            onClick={() => reconcileMutation.mutate()}
            disabled={reconcileMutation.isPending || ingestMutation.isPending}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-neon-green/10 text-neon-green border border-neon-green/30 hover:bg-neon-green/20 transition-all disabled:opacity-50"
          >
            {reconcileMutation.isPending ? "Reconciling..." : "Reconcile Results"}
          </button>
        </div>
      </motion.div>

      {/* Status flashes */}
      {ingestMutation.isSuccess && (
        <div className="text-xs text-neon-blue glass-card px-4 py-2 border border-neon-blue/20">
          Loaded {(ingestMutation.data as any)?.ingested_days ?? 0} days —{" "}
          Reconciled {(ingestMutation.data as any)?.reconcile?.updated ?? 0} predictions
        </div>
      )}
      {reconcileMutation.isSuccess && (
        <div className="text-xs text-neon-green glass-card px-4 py-2 border border-neon-green/20">
          Reconciled {(reconcileMutation.data as any)?.updated ?? 0} predictions —{" "}
          {(reconcileMutation.data as any)?.wins ?? 0} wins / {(reconcileMutation.data as any)?.losses ?? 0} losses
        </div>
      )}

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Market */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Market</label>
            <select
              value={filters.market}
              onChange={(e) => setFilters((f) => ({ ...f, market: e.target.value }))}
              className="w-full bg-surface-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-foreground"
            >
              {MARKETS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Min Confidence */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Min Confidence</label>
            <input
              type="number"
              min={0}
              max={100}
              value={filters.min_confidence}
              onChange={(e) => setFilters((f) => ({ ...f, min_confidence: +e.target.value }))}
              className="w-full bg-surface-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-foreground"
              placeholder="0"
            />
          </div>

          {/* Odds Min */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Odds Min</label>
            <input
              type="number"
              min={1}
              step={0.1}
              value={filters.odds_min}
              onChange={(e) => setFilters((f) => ({ ...f, odds_min: e.target.value }))}
              className="w-full bg-surface-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-foreground"
              placeholder="1.50"
            />
          </div>

          {/* Odds Max */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Odds Max</label>
            <input
              type="number"
              min={1}
              step={0.1}
              value={filters.odds_max}
              onChange={(e) => setFilters((f) => ({ ...f, odds_max: e.target.value }))}
              className="w-full bg-surface-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-foreground"
              placeholder="5.00"
            />
          </div>

          {/* Date From */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">From</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
              className="w-full bg-surface-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-foreground"
            />
          </div>

          {/* Date To */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">To</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
              className="w-full bg-surface-elevated border border-border rounded-lg px-2 py-1.5 text-xs text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : summary ? (
        <>
          <BacktestSummaryCards summary={summary} />

          {/* Charts row */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <AccuracyChart data={summary.monthly_performance} />
            <CalibrationChart data={calibration ?? []} />
          </div>

          {/* Confidence tier + By Market */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Confidence Tier */}
            <div className="glass-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">By Confidence Tier</h3>
              {Object.keys(summary.by_confidence_tier ?? {}).length === 0 && (
                <p className="text-xs text-muted-foreground">No data</p>
              )}
              {Object.entries(summary.by_confidence_tier ?? {}).map(([tier, stats]: [string, any]) => (
                <div key={tier} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="capitalize text-muted-foreground">
                      {tier} <span className="text-foreground/40">({stats.count})</span>
                    </span>
                    <span className="font-mono text-foreground">
                      {(stats.accuracy * 100).toFixed(1)}%
                      <span className={`ml-2 text-[10px] ${stats.roi >= 0 ? "text-neon-green" : "text-red-400"}`}>
                        ROI {stats.roi >= 0 ? "+" : ""}{stats.roi.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                  <div className="w-full bg-surface-elevated rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-neon-green to-neon-blue transition-all duration-700"
                      style={{ width: `${stats.accuracy * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* By Market */}
            <div className="glass-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">By Market</h3>
              {Object.keys(summary.by_market ?? {}).length === 0 && (
                <p className="text-xs text-muted-foreground">No data</p>
              )}
              <div className="space-y-2">
                {Object.entries(summary.by_market ?? {}).map(([mkt, stats]: [string, any]) => (
                  <div key={mkt} className="flex items-center justify-between text-xs border-b border-border/30 pb-1">
                    <span className="font-mono text-muted-foreground">{mkt}</span>
                    <div className="flex gap-3 text-right">
                      <span>{stats.count} bets</span>
                      <span className="font-semibold text-foreground">{(stats.accuracy * 100).toFixed(1)}%</span>
                      <span className={stats.roi >= 0 ? "text-neon-green" : "text-red-400"}>
                        {stats.roi >= 0 ? "+" : ""}{stats.roi.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <HistoricalPredictionsTable />
        </>
      ) : (
        <div className="glass-card p-16 text-center space-y-3">
          <p className="text-muted-foreground">Please log in to view backtest data.</p>
          <a href="/login" className="inline-block px-4 py-2 text-xs font-semibold rounded-lg bg-neon-green/10 text-neon-green border border-neon-green/30 hover:bg-neon-green/20 transition-all">
            Go to Login
          </a>
        </div>
      )}
    </div>
  );
}
