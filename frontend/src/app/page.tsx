"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { predictionsApi, analyticsApi } from "@/lib/api";
import { PredictionCard } from "@/components/predictions/PredictionCard";
import { StatsOverviewBar } from "@/components/dashboard/StatsOverviewBar";
import { LiveMatchesSidebar } from "@/components/dashboard/LiveMatchesSidebar";
import { AIAlertsBanner } from "@/components/dashboard/AIAlertsBanner";
import { DailyOverviewCard } from "@/components/dashboard/DailyOverviewCard";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Prediction } from "@/types";
import Link from "next/link";
import { Brain, ArrowRight } from "lucide-react";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function DashboardPage() {
  const { data: topPreds, isLoading: predsLoading } = useQuery({
    queryKey: ["predictions", "top"],
    queryFn: () => predictionsApi.getTop().then((r) => r.data as Prediction[]),
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: overview } = useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: () => analyticsApi.getOverview().then((r) => r.data),
  });

  const { data: daily } = useQuery({
    queryKey: ["analytics", "daily"],
    queryFn: () => analyticsApi.getDailySummary().then((r) => r.data),
    refetchInterval: 5 * 60 * 1000,
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between relative">
        {/* Gradient mesh behind title */}
        <div className="absolute -inset-6 -z-10 pointer-events-none overflow-hidden">
          <div
            className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse 70% 120% at 15% 60%, rgba(0,255,135,0.10) 0%, rgba(0,212,255,0.06) 45%, transparent 72%)" }}
          />
        </div>
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold text-foreground">
            Dashboard <span className="gradient-text-green text-xl">— Intelligence Feed</span>
          </h1>
          <p className="text-sm text-muted-foreground">AI-powered picks, live data and daily insights</p>
        </div>
        <Link
          href="/predictions"
          className="hidden md:flex items-center gap-1.5 text-xs text-neon-green border border-neon-green/30 px-3 py-1.5 rounded-lg hover:bg-neon-green/10 transition-all"
        >
          All Predictions <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </motion.div>

      {/* AI Alerts */}
      <AIAlertsBanner />

      {/* Stats + Daily Overview */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-3">
          {overview && <StatsOverviewBar overview={overview} />}
        </div>
        <div className="xl:col-span-1">
          <DailyOverviewCard daily={daily} />
        </div>
      </div>

      {/* Main — 3 cols predictions + 1 col right panel */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* Predictions column */}
        <div className="xl:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Brain className="w-4 h-4 text-neon-purple" />
              Today's Best Predictions
            </h2>
            <Link href="/predictions" className="text-xs text-neon-green hover:underline flex items-center gap-0.5">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {predsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : (
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
              {(topPreds ?? []).map((pred) => (
                <motion.div key={pred.id} variants={item}>
                  <PredictionCard prediction={pred} />
                </motion.div>
              ))}
              {!topPreds?.length && <EmptyState />}
            </motion.div>
          )}
        </div>

        {/* Right panel */}
        <div className="xl:col-span-1">
          <LiveMatchesSidebar />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass-card p-12 text-center space-y-3">
      <div className="w-16 h-16 rounded-2xl bg-surface-elevated flex items-center justify-center mx-auto">
        <Brain className="w-8 h-8 text-muted-foreground/50" />
      </div>
      <p className="text-muted-foreground text-sm">No high-confidence predictions for today yet.</p>
      <Link href="/predictions" className="inline-flex items-center gap-1 text-xs text-neon-green hover:underline">
        Browse all predictions <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

