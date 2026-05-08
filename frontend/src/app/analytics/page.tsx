"use client";

import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { LeagueStatsTable } from "@/components/analytics/LeagueStatsTable";
import { OverviewCharts } from "@/components/analytics/OverviewCharts";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";

const XGTrendChart = dynamic(
  () => import("@/components/charts/xGTrendChart").then((m) => ({ default: m.XGTrendChart })),
  { ssr: false, loading: () => <div className="h-32 rounded-xl bg-surface-elevated animate-pulse" /> }
);
const WinProbabilityGauge = dynamic(
  () => import("@/components/charts/WinProbabilityGauge").then((m) => ({ default: m.WinProbabilityGauge })),
  { ssr: false, loading: () => <div className="h-40 rounded-xl bg-surface-elevated animate-pulse" /> }
);
import { BarChart2, Activity } from "lucide-react";

export default function AnalyticsPage() {
  const { data: overview, isLoading } = useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: () => analyticsApi.getOverview().then((r) => r.data),
  });

  // Build illustrative xG trend from accuracy_by_market if available, or show model confidence
  const xgTrend = overview?.recent_form?.length
    ? overview.recent_form.map((r: any, i: number) => ({
        match: r.label ?? `W${i + 1}`,
        home_xg: r.avg_home_xg ?? r.home_xg ?? 0,
        away_xg: r.avg_away_xg ?? r.away_xg ?? 0,
      }))
    : null;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">
          Advanced <span className="gradient-text-green">Analytics</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Statistical insights, performance trends, and AI model evaluation
        </p>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Overview + model win probability distribution */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            <div className="xl:col-span-3">
              {overview && <OverviewCharts overview={overview} />}
            </div>
            <div className="xl:col-span-1">
              {overview && (
                <WinProbabilityGauge
                  homeName="Home Win"
                  awayName="Away Win"
                  homeProb={overview.overall_accuracy}
                  drawProb={Math.max(0, 1 - overview.overall_accuracy - 0.28)}
                  awayProb={0.28}
                  className="h-full"
                />
              )}
            </div>
          </div>

          {/* xG trend — shown only if backend provides recent_form with xG */}
          {xgTrend && xgTrend.length > 0 && (
            <XGTrendChart
              data={xgTrend}
              homeName="Home xG avg"
              awayName="Away xG avg"
            />
          )}

          {/* League breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 className="w-4 h-4 text-neon-blue" />
              <h2 className="text-base font-semibold text-foreground">League Breakdown</h2>
            </div>
            <LeagueStatsTable />
          </motion.div>
        </>
      )}
    </div>
  );
}

