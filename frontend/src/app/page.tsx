"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { predictionsApi, analyticsApi } from "@/lib/api";
import { StatsOverviewBar } from "@/components/dashboard/StatsOverviewBar";

import { AIAlertsBanner } from "@/components/dashboard/AIAlertsBanner";
import { IntelligenceFeed } from "@/components/dashboard/IntelligenceFeed";
import { DailyOverviewCard } from "@/components/dashboard/DailyOverviewCard";
import { DailyBriefingCard } from "@/components/dashboard/DailyBriefingCard";
import { HeroPickCard, HeroPickCardSkeleton } from "@/components/dashboard/HeroPickCard";
import type { Prediction } from "@/types";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD local date

  const { data: heroPred, isLoading: heroLoading } = useQuery({
    queryKey: ["predictions", "hero", today],
    queryFn: () => predictionsApi.getHero(today).then((r) => r.data as Prediction | null),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: false,
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

      {/* Live Intelligence Feed */}
      <IntelligenceFeed />

      {/* AI Alerts */}
      <AIAlertsBanner />

      {/* Hero Pick */}
      {heroLoading ? (
        <HeroPickCardSkeleton />
      ) : heroPred ? (
        <HeroPickCard prediction={heroPred} />
      ) : null}

      {/* Stats + Daily Overview + AI Briefing */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-3">
          {overview && <StatsOverviewBar overview={overview} />}
          <div className="mt-4">
            <DailyBriefingCard />
          </div>
        </div>
        <div className="xl:col-span-1">
          <DailyOverviewCard daily={daily} />
        </div>
      </div>
    </div>
  );
}

