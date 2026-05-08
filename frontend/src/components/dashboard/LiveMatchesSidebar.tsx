"use client";

import { useQuery } from "@tanstack/react-query";
import { matchesApi, analyticsApi } from "@/lib/api";
import type { Match } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Activity, AlertTriangle, TrendingUp, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useState } from "react";

type Tab = "matches" | "injuries" | "odds";

export function LiveMatchesSidebar() {
  const [tab, setTab] = useState<Tab>("matches");

  const { data: todayMatches } = useQuery({
    queryKey: ["matches", "today"],
    queryFn: () => matchesApi.getToday().then((r) => r.data as Match[]),
    refetchInterval: 60 * 1000,
  });

  const { data: alerts = [] } = useQuery<any[]>({
    queryKey: ["analytics", "alerts"],
    queryFn: () => analyticsApi.getAlerts().then((r) => r.data),
    refetchInterval: 5 * 60 * 1000,
  });

  const liveMatches = (todayMatches ?? []).filter((m) => m.status === "live");
  const upcomingMatches = (todayMatches ?? []).filter((m) => m.status === "scheduled");
  const injuryAlerts = alerts.filter((a) => a.type === "injury");
  const valueAlerts = alerts.filter((a) => a.type === "value");

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "matches", label: "Matches", count: (todayMatches ?? []).length },
    { id: "injuries", label: "Injuries", count: injuryAlerts.length },
    { id: "odds", label: "Value", count: valueAlerts.length },
  ];

  return (
    <div className="glass-card overflow-hidden h-fit">
      {/* Header */}
      <div className="px-4 pt-4 pb-0 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            {liveMatches.length > 0 ? (
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-red-500 inline-block"
              />
            ) : (
              <Activity className="w-3.5 h-3.5 text-neon-blue" />
            )}
            Live Intelligence
          </h3>
          <Link href="/live" className="text-[10px] text-neon-blue hover:underline flex items-center gap-0.5">
            All <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 text-[10px] font-semibold py-1.5 rounded-md transition-all flex items-center justify-center gap-1 ${
                tab === t.id
                  ? "bg-neon-green/20 text-neon-green"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {!!t.count && (
                <span className={`text-[9px] px-1 rounded-full ${tab === t.id ? "bg-neon-green/30" : "bg-surface-elevated"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pt-3 space-y-2 max-h-[600px] overflow-y-auto">
        <AnimatePresence mode="wait">
          {tab === "matches" && (
            <motion.div key="matches" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {!todayMatches?.length ? (
                <EmptyPanel icon={<Calendar className="w-6 h-6" />} text="No matches today" />
              ) : (
                <>
                  {liveMatches.length > 0 && (
                    <Section label="LIVE" pulse>
                      {liveMatches.map((m) => <MatchRow key={m.id} match={m} />)}
                    </Section>
                  )}
                  {upcomingMatches.length > 0 && (
                    <Section label="Upcoming">
                      {upcomingMatches.slice(0, 8).map((m) => <MatchRow key={m.id} match={m} />)}
                    </Section>
                  )}
                </>
              )}
            </motion.div>
          )}

          {tab === "injuries" && (
            <motion.div key="injuries" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {!injuryAlerts.length ? (
                <EmptyPanel icon={<AlertTriangle className="w-6 h-6" />} text="No injury alerts" />
              ) : (
                injuryAlerts.map((a) => (
                  <div key={a.id} className="flex gap-3 p-2.5 rounded-lg bg-amber-400/5 border border-amber-400/15">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground leading-tight">{a.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{a.text}</p>
                      <span className="text-[9px] text-amber-400/70">{a.league}</span>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {tab === "odds" && (
            <motion.div key="odds" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {!valueAlerts.length ? (
                <EmptyPanel icon={<TrendingUp className="w-6 h-6" />} text="No value bets detected" />
              ) : (
                valueAlerts.map((a) => (
                  <Link key={a.id} href={a.prediction_id ? `/predictions/${a.prediction_id}` : "#"}>
                    <div className="flex gap-3 p-2.5 rounded-lg bg-neon-green/5 border border-neon-green/15 hover:border-neon-green/30 transition-colors cursor-pointer">
                      <TrendingUp className="w-3.5 h-3.5 text-neon-green flex-shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-foreground leading-tight">{a.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{a.text}</p>
                        <span className="text-[9px] text-neon-green/70">{a.league}</span>
                      </div>
                      <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0 self-center" />
                    </div>
                  </Link>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Section({ label, children, pulse }: { label: string; children: React.ReactNode; pulse?: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1.5">
        {pulse && (
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"
          />
        )}
        {label}
      </p>
      {children}
    </div>
  );
}

function MatchRow({ match: m }: { match: Match }) {
  const isLive = m.status === "live";
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-elevated transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-foreground truncate font-medium">
          {m.home_team.short_name ?? m.home_team.name}
          <span className="text-muted-foreground mx-1">vs</span>
          {m.away_team.short_name ?? m.away_team.name}
        </p>
        <p className="text-[9px] text-muted-foreground truncate">{m.league.name}</p>
      </div>
      <div className="text-right flex-shrink-0">
        {isLive ? (
          <div className="space-y-0.5">
            <p className="text-[11px] font-mono font-bold text-foreground">{m.home_score ?? 0}–{m.away_score ?? 0}</p>
            {m.minute && (
              <motion.p
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-[9px] text-red-400"
              >
                {m.minute}'
              </motion.p>
            )}
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />
            {format(new Date(m.match_date), "HH:mm")}
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyPanel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-center py-8 space-y-2 text-muted-foreground">
      <div className="w-8 h-8 mx-auto opacity-40">{icon}</div>
      <p className="text-xs">{text}</p>
    </div>
  );
}

